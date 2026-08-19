# Design — Recent-form & Voting tabs inside "سجل المواجهات والتوقعات"

Date: 2026-08-12
Component owner: `components/H2HInsights.tsx`

## Goal

Extend the existing "سجل المواجهات والتوقعات" card (`H2HInsights`) from a 2-tab
segmented control to a **4-tab** control, adding:

1. **آخر مباريات الفريقين** — each team's recent form (two columns, W/D/L).
2. **صوّت لمن سيفوز** — real, aggregated match-winner voting backed by Firestore.

The card is rendered at the bottom of `DetailsTabView` (currently
`MatchDetailView.tsx:562`). No new top-level match-detail tab is added.

## Scope decisions (confirmed with user)

- Voting is **real and aggregated** across users via Firestore — not local-only.
- Both new views live **inside** `H2HInsights` as extra segmented tabs.
- The recent-form view shows **both teams' recent form** (last 5), titled with the
  current competition name.
- The vote tab is shown **only when the match has not finished**
  (`match.status !== MatchStatus.FINISHED`). For finished matches the segmented
  control shows only the other three tabs.

## Data wiring

`MatchDetails` already declares and `services/api.ts` already populates
`recentMatchesA: H2HMatch[]` and `recentMatchesB: H2HMatch[]`. No API change.

`H2HInsights` currently receives `{ match, h2h }`. Extend its props:

```ts
interface Props {
    match: Match;
    h2h: H2HMatch[];
    recentA?: H2HMatch[];
    recentB?: H2HMatch[];
}
```

At `MatchDetailView.tsx:562`, pass the new arrays:

```tsx
<H2HInsights
    match={match}
    h2h={h2h}
    recentA={details?.recentMatchesA || []}
    recentB={details?.recentMatchesB || []}
/>
```

The tab state type widens from `'log' | 'analysis'` to
`'log' | 'analysis' | 'recent' | 'vote'`.

## Tab 3 — آخر مباريات الفريقين (recent form)

Two columns side by side (stacked on mobile), one per team, mirroring the
reference screenshot. Each column:

- Header: team crest + `translateTeam(name)` + a row of colored W/D/L pills for
  the last 5 (ف = win/emerald, ت = draw/gray, خ = loss/red).
- List rows: opponent name + crest, score badge (`homeScore - awayScore`, `dir="ltr"`),
  date, and a leading colored dot for the result.

Result is computed per row by mapping the match onto the column's team using the
existing `sameTeam()` name-normalization helper already in this file (home vs away
resolved before comparing the score).

Title: `آخر مباريات الفريقين (${match.league})`.

Empty state per column: `لا توجد بيانات` inside a dashed placeholder when the
team's array is empty.

## Tab 4 — صوّت لمن سيفوز (voting)

### Storage

New Firestore collection document `votes/{matchId}` where `matchId = String(match.id)`:

```
{ a: number, draw: number, b: number, updatedAt: string /* ISO */ }
```

- `a` = votes for teamA (home), `b` = teamB (away), `draw` = tie.

### New module `services/votes.ts`

```ts
export type VoteChoice = 'a' | 'draw' | 'b';
export interface VoteCounts { a: number; draw: number; b: number; }

// Live subscription; returns an unsubscribe fn. Emits {a:0,draw:0,b:0} when absent.
export function subscribeVotes(matchId: string, cb: (v: VoteCounts) => void): () => void;

// One transactional vote. Creates the doc on first vote, otherwise increments.
export function castVote(matchId: string, choice: VoteChoice): Promise<void>;
```

- `subscribeVotes` uses `onSnapshot(doc(db,'votes',matchId))`.
- `castVote` uses `runTransaction`: if the doc doesn't exist, `set` it with the
  chosen counter = 1 and the other two = 0; otherwise `update` with
  `increment(1)` on the chosen field and a fresh `updatedAt`.
- Errors are routed through the existing `handleFirestoreError` pattern but must
  not throw past the UI — a failed vote surfaces a small inline error, the UI
  stays usable.

### Double-vote guard

`localStorage["yalla_vote_" + matchId]` stores the chosen `VoteChoice`. When
present on mount, the tab opens directly in results mode and voting controls are
disabled. This is a client-side deterrent only; anonymous aggregated voting can't
be fully abuse-proofed and that is accepted.

### UI

- **Vote mode** (no stored choice): title `صوّت لمن سيفوز`, three circular
  buttons in RTL order teamB / تعادل / teamA. Clicking one calls `castVote`,
  writes localStorage, switches to results mode optimistically.
- **Results mode**: horizontal percentage bars per option computed from live
  `VoteCounts` (`pct = round(n / total * 100)`, total 0 → all 0%). The user's own
  pick is highlighted. Shows total vote count.

### Firestore rules (`firestore.rules`)

Add alongside the existing `cache` and `users` blocks:

```
function isNewVote(d) {
  return d.keys().hasAll(['a','draw','b','updatedAt']) && d.keys().size() == 4
      && d.a is int && d.draw is int && d.b is int && d.updatedAt is string
      && d.a >= 0 && d.draw >= 0 && d.b >= 0
      && (d.a + d.draw + d.b) == 1;
}
function isIncrement(prev, next) {
  return next.a >= prev.a && next.draw >= prev.draw && next.b >= prev.b
      && (next.a + next.draw + next.b) == (prev.a + prev.draw + prev.b) + 1;
}
match /votes/{matchId} {
  allow read: if true;
  allow create: if isValidId(matchId) && isNewVote(incoming());
  allow update: if isValidId(matchId)
                && incoming().keys().hasAll(['a','draw','b','updatedAt'])
                && incoming().keys().size() == 4
                && incoming().updatedAt is string
                && isIncrement(resource.data, incoming());
  allow delete: if false;
}
```

`isValidId` and `incoming()` already exist in the rules file.

## Files touched

- `components/H2HInsights.tsx` — widen tab state, 2 new tab buttons, 2 new views, new props.
- `components/MatchDetailView.tsx` — pass `recentA`/`recentB` at the `H2HInsights` call.
- `services/votes.ts` — new.
- `firestore.rules` — new `votes/{matchId}` block.
- Rebuild the WordPress theme bundle afterward (`vite build --base=./`) per project memory.

## Out of scope

- No auth/login; voting is anonymous.
- No server/API changes; the client talks to Firestore directly for votes.
- No changes to the recent-form data source.
