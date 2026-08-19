# Recent-form & Voting tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two tabs — "آخر مباريات الفريقين" (both teams' recent form) and "صوّت لمن سيفوز" (real Firestore-aggregated voting) — inside the existing `H2HInsights` ("سجل المواجهات والتوقعات") card.

**Architecture:** Extend `H2HInsights`'s segmented control from 2 to 4 tabs. Recent-form reuses `MatchDetails.recentMatchesA/B` (already populated by `services/api.ts`). Voting talks to Firestore directly from the client via a new `services/votes.ts` (live `onSnapshot` + transactional `increment`), guarded by localStorage and Firestore security rules.

**Tech Stack:** React 19 + TypeScript, Tailwind 4, Firebase Firestore (`firebase/firestore`), Vite 6.

## Global Constraints

- Working directory for all paths below: `Yalah-match-v2.2.1-main/`.
- All UI is RTL, Arabic copy, font-black Tajawal styling — match existing `H2HInsights` visual language (rounded-2xl tiles, `bg-gray-50/70`, emerald/blue/orange accents).
- `npm run lint` runs with **max-warnings: 0** — code must lint clean.
- Not a git repo: replace "commit" verification with `npm run lint` + `npm run build`. Do not run `git`.
- No auth; voting is anonymous. `matchId` for Firestore = `String(match.id)` and must match `^[a-zA-Z0-9_\-]+$`.
- After all tasks, rebuild the WordPress theme bundle per project memory: `vite build --base=./`.

---

### Task 1: Voting service (`services/votes.ts`)

**Files:**
- Create: `services/votes.ts`

**Interfaces:**
- Consumes: `db` from `services/firebase.ts`; `handleFirestoreError`, `OperationType` from `services/firestoreCache.ts`.
- Produces:
  - `type VoteChoice = 'a' | 'draw' | 'b'`
  - `interface VoteCounts { a: number; draw: number; b: number }`
  - `function subscribeVotes(matchId: string, cb: (v: VoteCounts) => void): () => void`
  - `function castVote(matchId: string, choice: VoteChoice): Promise<void>`

- [ ] **Step 1: Create the module**

```ts
import { doc, onSnapshot, runTransaction, increment } from 'firebase/firestore';
import { db } from './firebase.ts';
import { handleFirestoreError, OperationType } from './firestoreCache.ts';

export type VoteChoice = 'a' | 'draw' | 'b';
export interface VoteCounts { a: number; draw: number; b: number; }

const ZERO: VoteCounts = { a: 0, draw: 0, b: 0 };

/** Live subscription to a match's vote tallies. Emits {0,0,0} when the doc is absent. */
export function subscribeVotes(matchId: string, cb: (v: VoteCounts) => void): () => void {
  const ref = doc(db, 'votes', matchId);
  return onSnapshot(
    ref,
    (snap) => {
      const d = snap.data();
      if (!d) { cb({ ...ZERO }); return; }
      cb({ a: Number(d.a) || 0, draw: Number(d.draw) || 0, b: Number(d.b) || 0 });
    },
    (error) => {
      try { handleFirestoreError(error, OperationType.GET, `votes/${matchId}`); } catch { /* non-fatal */ }
      cb({ ...ZERO });
    }
  );
}

/** Cast one vote. Creates the doc on first vote, otherwise increments the chosen counter by 1. */
export async function castVote(matchId: string, choice: VoteChoice): Promise<void> {
  const ref = doc(db, 'votes', matchId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const now = new Date().toISOString();
      if (!snap.exists()) {
        tx.set(ref, {
          a: choice === 'a' ? 1 : 0,
          draw: choice === 'draw' ? 1 : 0,
          b: choice === 'b' ? 1 : 0,
          updatedAt: now,
        });
      } else {
        tx.update(ref, { [choice]: increment(1), updatedAt: now });
      }
    });
  } catch (error) {
    try { handleFirestoreError(error, OperationType.WRITE, `votes/${matchId}`); } catch { /* surfaced by caller */ }
    throw error;
  }
}
```

- [ ] **Step 2: Typecheck/lint the new file**

Run: `npm run lint`
Expected: PASS (no warnings). If `handleFirestoreError` re-throws, the `catch`/`throw` keeps `castVote` rejecting so the UI can show an inline error.

---

### Task 2: Firestore security rules for `votes/{matchId}`

**Files:**
- Modify: `firestore.rules` (add a block after the `users` match, before the closing braces)

**Interfaces:**
- Consumes: existing `isValidId(id)` and `incoming()` helpers already defined in the file.
- Produces: public-read, increment-only `votes/{matchId}` collection.

- [ ] **Step 1: Add helper functions and the match block**

Insert immediately before the final two closing braces (the `}` that closes `/documents` and the `}` that closes `service`):

```
    function isNewVote(d) {
      return d.keys().hasAll(['a','draw','b','updatedAt']) && d.keys().size() == 4
          && d.a is int && d.draw is int && d.b is int && d.updatedAt is string
          && d.a >= 0 && d.draw >= 0 && d.b >= 0
          && (d.a + d.draw + d.b) == 1;
    }
    function isVoteIncrement(prev, next) {
      return next.keys().hasAll(['a','draw','b','updatedAt']) && next.keys().size() == 4
          && next.updatedAt is string
          && next.a >= prev.a && next.draw >= prev.draw && next.b >= prev.b
          && (next.a + next.draw + next.b) == (prev.a + prev.draw + prev.b) + 1;
    }

    // Anonymous match-winner voting. Public read; writes may only create a
    // single vote or increment exactly one counter by one. No deletes.
    match /votes/{matchId} {
      allow read: if true;
      allow create: if isValidId(matchId) && isNewVote(incoming());
      allow update: if isValidId(matchId) && isVoteIncrement(resource.data, incoming());
      allow delete: if false;
    }
```

- [ ] **Step 2: Sanity-check brace balance**

Read the file back and confirm the two new functions and the `match /votes` block sit inside `match /databases/{database}/documents { ... }`, and the global `match /{document=**} { allow read, write: if false; }` still precedes them (specific rules override the catch-all via `allow` union semantics — the increment-only writes are additive, which is intended).

Note: deploying rules is a manual Firebase step outside this repo; flag to the user that `firestore.rules` must be deployed for voting writes to succeed in production.

---

### Task 3: Pass recent-match data into `H2HInsights`

**Files:**
- Modify: `components/MatchDetailView.tsx` (the `H2HInsights` usage, ~line 562)
- Modify: `components/H2HInsights.tsx` (props interface, ~lines 33-36)

**Interfaces:**
- Consumes: `MatchDetails.recentMatchesA`, `MatchDetails.recentMatchesB` (typed `H2HMatch[]`).
- Produces: `H2HInsights` accepts optional `recentA` / `recentB` props.

- [ ] **Step 1: Widen the props interface in `H2HInsights.tsx`**

Replace the existing `interface Props`:

```tsx
interface Props {
    match: Match;
    h2h: H2HMatch[];
    recentA?: H2HMatch[];
    recentB?: H2HMatch[];
}
```

And update the component signature:

```tsx
const H2HInsights: React.FC<Props> = ({ match, h2h, recentA = [], recentB = [] }) => {
```

- [ ] **Step 2: Pass the arrays from `MatchDetailView.tsx`**

Replace the existing call (currently `<H2HInsights match={match} h2h={h2h} />` at ~line 562):

```tsx
<H2HInsights
    match={match}
    h2h={h2h}
    recentA={details?.recentMatchesA || []}
    recentB={details?.recentMatchesB || []}
/>
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS. `recentA`/`recentB` are unused so far — that's fine because ESLint `no-unused-vars` is relaxed in this repo; they get consumed in Task 4.

---

### Task 4: Recent-form tab (`'recent'`) in `H2HInsights`

**Files:**
- Modify: `components/H2HInsights.tsx`

**Interfaces:**
- Consumes: `recentA`, `recentB` props from Task 3; existing `norm`/`sameTeam` helpers and `Crest` sub-component in this file; `translateTeam`.
- Produces: a `'recent'` value in the tab state union and a rendered two-column recent-form view.

- [ ] **Step 1: Widen the tab state union**

Change:

```tsx
const [tab, setTab] = useState<'log' | 'analysis'>('log');
```
to:
```tsx
const [tab, setTab] = useState<'log' | 'analysis' | 'recent' | 'vote'>('log');
```

- [ ] **Step 2: Add a result helper and a column component above the `return`**

```tsx
// Map one recent match onto `teamName` and classify the result for that team.
const resultFor = (m: H2HMatch, teamName: string): 'W' | 'D' | 'L' => {
    const isHome = sameTeam(m.homeTeam, teamName);
    const own = isHome ? m.homeScore : m.awayScore;
    const opp = isHome ? m.awayScore : m.homeScore;
    if (own > opp) return 'W';
    if (own < opp) return 'L';
    return 'D';
};
const RESULT_DOT: Record<'W' | 'D' | 'L', string> = {
    W: 'bg-emerald-500', D: 'bg-gray-400', L: 'bg-red-500',
};
const RESULT_PILL: Record<'W' | 'D' | 'L', string> = {
    W: 'bg-emerald-500', D: 'bg-gray-400', L: 'bg-red-500',
};
const RESULT_AR: Record<'W' | 'D' | 'L', string> = { W: 'ف', D: 'ت', L: 'خ' };

const RecentColumn: React.FC<{ teamName: string; teamLogo?: string; matches: H2HMatch[] }> = ({ teamName, teamLogo, matches }) => {
    const last5 = (matches || []).slice(0, 5);
    return (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-3 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Crest src={teamLogo} alt={teamName} size="w-6 h-6" />
                    <span className="font-black text-gray-900 text-xs sm:text-sm truncate">{translateTeam(teamName)}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {last5.map((m, i) => {
                        const r = resultFor(m, teamName);
                        return (
                            <span key={i} className={`w-5 h-5 rounded-md ${RESULT_PILL[r]} text-white font-black text-[9px] grid place-items-center`}>
                                {RESULT_AR[r]}
                            </span>
                        );
                    })}
                </div>
            </div>
            {last5.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white py-6 text-center text-gray-400 font-bold text-[11px]">لا توجد بيانات</div>
            ) : (
                <div className="space-y-2">
                    {last5.map((m, i) => {
                        const r = resultFor(m, teamName);
                        const isHome = sameTeam(m.homeTeam, teamName);
                        const opponent = isHome ? m.awayTeam : m.homeTeam;
                        const oppLogo = isHome ? m.awayLogo : m.homeLogo;
                        return (
                            <div key={`${m.date}-${i}`} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-2.5 py-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${RESULT_DOT[r]}`} />
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Crest src={oppLogo} alt={opponent} size="w-5 h-5" />
                                    <span className="text-gray-700 font-bold text-[11px] truncate">{translateTeam(opponent)}</span>
                                </div>
                                <span className="rounded-lg bg-gray-800 text-white font-black text-[11px] px-2 py-0.5 tabular-nums shrink-0" dir="ltr">
                                    {m.homeScore} - {m.awayScore}
                                </span>
                                <span className="text-gray-400 font-bold text-[9px] shrink-0 hidden sm:inline" dir="ltr">{m.date}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
```

- [ ] **Step 3: Add the tab button**

In the segmented control (the `div` holding the `log`/`analysis` buttons), add after the `analysis` button:

```tsx
<button
    onClick={() => setTab('recent')}
    className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black transition-colors ${
        tab === 'recent' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
    }`}
>
    آخر المباريات
</button>
```

- [ ] **Step 4: Render the view**

The body currently branches `data.total === 0 ? ... : tab === 'log' ? ... : (analysis)`. Restructure so `recent` and `vote` are handled regardless of `data.total` (they don't depend on h2h). Wrap the recent view like this, added as a branch before the empty-state/h2h logic:

```tsx
{tab === 'recent' ? (
    <div className="px-4 sm:px-5 pb-5">
        <h4 className="text-gray-800 font-black text-sm mb-3">آخر مباريات الفريقين ({match.league})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <RecentColumn teamName={match.teamA.name} teamLogo={match.teamA.logoUrl} matches={recentA} />
            <RecentColumn teamName={match.teamB.name} teamLogo={match.teamB.logoUrl} matches={recentB} />
        </div>
    </div>
) : tab === 'vote' ? (
    <VoteView match={match} />
) : data.total === 0 ? (
    /* ...existing empty state... */
) : tab === 'log' ? (
    /* ...existing log view... */
) : (
    /* ...existing analysis view... */
)}
```

(`VoteView` is added in Task 5. If implementing Task 4 before Task 5, temporarily render `null` for the `vote` branch and the tab button from Task 5 is not yet present — the code still compiles.)

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS. Recent tab shows two columns; empty arrays show "لا توجد بيانات".

---

### Task 5: Voting tab (`'vote'`) with `VoteView`

**Files:**
- Modify: `components/H2HInsights.tsx` (imports, new `VoteView` component, conditional tab button)

**Interfaces:**
- Consumes: `subscribeVotes`, `castVote`, `VoteChoice`, `VoteCounts` from `services/votes.ts`; `MatchStatus` from `types.ts`; `translateTeam`, `Crest`.
- Produces: a `VoteView` component rendered by the `tab === 'vote'` branch from Task 4.

- [ ] **Step 1: Add imports at the top of `H2HInsights.tsx`**

```tsx
import { useEffect } from 'react';
import { MatchStatus } from '../types';
import { subscribeVotes, castVote, VoteChoice, VoteCounts } from '../services/votes.ts';
```

(Merge `useEffect` into the existing `react` import if preferred: `import React, { useEffect, useMemo, useState } from 'react';`)

- [ ] **Step 2: Add the `VoteView` component (module scope, below `H2HInsights` or above it)**

```tsx
const VOTE_KEY = (id: number) => `yalla_vote_${id}`;

const VoteView: React.FC<{ match: Match }> = ({ match }) => {
    const matchId = String(match.id);
    const [counts, setCounts] = useState<VoteCounts>({ a: 0, draw: 0, b: 0 });
    const [myVote, setMyVote] = useState<VoteChoice | null>(() => {
        try { return (localStorage.getItem(VOTE_KEY(match.id)) as VoteChoice) || null; } catch { return null; }
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsub = subscribeVotes(matchId, setCounts);
        return unsub;
    }, [matchId]);

    const total = counts.a + counts.draw + counts.b;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

    const submit = async (choice: VoteChoice) => {
        if (myVote || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await castVote(matchId, choice);
            try { localStorage.setItem(VOTE_KEY(match.id), choice); } catch { /* ignore */ }
            setMyVote(choice);
        } catch {
            setError('تعذّر تسجيل صوتك، حاول مرة أخرى');
        } finally {
            setSubmitting(false);
        }
    };

    // RTL display order: teamB, draw, teamA (matches the reference screenshot).
    const options: { choice: VoteChoice; label: string; logo?: string; bar: string }[] = [
        { choice: 'b', label: translateTeam(match.teamB.name), logo: match.teamB.logoUrl, bar: 'bg-indigo-500' },
        { choice: 'draw', label: 'تعادل', logo: undefined, bar: 'bg-gray-400' },
        { choice: 'a', label: translateTeam(match.teamA.name), logo: match.teamA.logoUrl, bar: 'bg-blue-600' },
    ];

    return (
        <div className="px-4 sm:px-5 pb-5">
            <h4 className="text-gray-800 font-black text-base sm:text-lg mb-4 text-right">صوّت لمن سيفوز</h4>

            {!myVote ? (
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    {options.map((o) => (
                        <button
                            key={o.choice}
                            onClick={() => submit(o.choice)}
                            disabled={submitting}
                            className="flex flex-col items-center justify-center gap-2 aspect-square rounded-full border border-gray-200 bg-gray-50/60 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors disabled:opacity-50"
                        >
                            {o.logo ? (
                                <span className="w-9 h-9 sm:w-11 sm:h-11 grid place-items-center">
                                    <OptimizedImage src={o.logo} alt={o.label} width={44} className="w-full h-full object-contain" />
                                </span>
                            ) : (
                                <span className="w-9 h-9 sm:w-11 sm:h-11 grid place-items-center rounded-full bg-gray-200 text-gray-500 font-black text-lg">=</span>
                            )}
                            <span className="text-gray-800 font-black text-[10px] sm:text-xs text-center px-1 truncate max-w-full">{o.label}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {options.map((o) => (
                        <div key={o.choice} className="flex items-center gap-3" dir="rtl">
                            <span className={`w-12 text-left font-black text-sm tabular-nums shrink-0 ${myVote === o.choice ? 'text-emerald-600' : 'text-gray-500'}`} dir="ltr">
                                {pct(counts[o.choice])}%
                            </span>
                            <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                                <div className={`h-full rounded-full ${o.bar} transition-all`} style={{ width: `${pct(counts[o.choice])}%` }} />
                            </div>
                            <span className={`w-24 sm:w-32 font-black text-[11px] sm:text-sm truncate shrink-0 ${myVote === o.choice ? 'text-emerald-700' : 'text-gray-700'}`}>
                                {o.label}
                            </span>
                        </div>
                    ))}
                    <p className="text-gray-400 font-bold text-[10px] text-center pt-1">
                        إجمالي الأصوات: <span className="tabular-nums" dir="ltr">{total}</span>
                    </p>
                </div>
            )}

            {error && <p className="text-red-500 font-bold text-[11px] text-center mt-3">{error}</p>}
        </div>
    );
};
```

Note: `OptimizedImage` is already imported at the top of `H2HInsights.tsx`.

- [ ] **Step 3: Add the conditional vote tab button**

Only render the vote tab when the match hasn't finished. In the segmented control, after the "آخر المباريات" button:

```tsx
{match.status !== MatchStatus.FINISHED && (
    <button
        onClick={() => setTab('vote')}
        className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black transition-colors ${
            tab === 'vote' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
    >
        التصويت
    </button>
)}
```

Guard against a finished match still holding `tab === 'vote'` (e.g. after status flips): the Task 4 branch renders `VoteView` only via `tab === 'vote'`; add a fallback so a finished match never shows it. In the render branch, change the vote condition to:

```tsx
) : tab === 'vote' && match.status !== MatchStatus.FINISHED ? (
    <VoteView match={match} />
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS. Vote tab absent for FINISHED matches; present otherwise.

---

### Task 6: Manual verification in the browser preview

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server and open a match**

Use the preview tools: `preview_start` with the dev config (`npm run dev`, port 3000), open the app, open an UPCOMING match's detail view, scroll to "سجل المواجهات والتوقعات".

- [ ] **Step 2: Verify recent-form tab**

Click "آخر المباريات". Confirm two columns render with W/D/L pills (ف/ت/خ) and per-row score badges; empty teams show "لا توجد بيانات". Check `read_console_messages` for errors.

- [ ] **Step 3: Verify voting**

Click "التصويت". Confirm three circular options in RTL order (teamB / تعادل / teamA). Click one; confirm it switches to percentage bars, your pick highlighted emerald, and `read_network_requests`/console show a successful Firestore write (or an inline Arabic error if rules aren't deployed yet — expected until Task 2 rules are deployed). Reload; confirm it reopens directly in results mode (localStorage guard).

- [ ] **Step 4: Verify finished-match hiding**

Open a FINISHED match; confirm the "التصويت" tab is absent while "آخر المباريات" still shows.

- [ ] **Step 5: Screenshot the two tabs** and share with the user as proof.

---

### Task 7: Rebuild WordPress theme bundle

**Files:**
- Modify: `wordpress-theme/…` build output (generated)

- [ ] **Step 1: Rebuild with the theme base path**

Run: `vite build --base=./`
(Per project memory `[[wordpress-theme-port]]`; only if the user is shipping the WordPress theme. Confirm the output directory matches the existing theme layout before overwriting.)

- [ ] **Step 2: Confirm build succeeds** with no errors and the new tabs are present in the bundle.

---

## Self-Review

**Spec coverage:**
- Data wiring (recentMatchesA/B → props) → Task 3. ✓
- Recent-form tab, both teams, competition title, empty state → Task 4. ✓
- Voting service (subscribe + transactional cast) → Task 1. ✓
- Vote UI (before/after, RTL order, % bars, total) → Task 5. ✓
- localStorage double-vote guard → Task 5. ✓
- Vote only when not finished → Task 5 (button + render guard). ✓
- Firestore rules `votes/{matchId}` → Task 2. ✓
- WordPress rebuild → Task 7. ✓

**Placeholder scan:** No TBD/TODO; all code blocks concrete. The "existing view" comments in Task 4 Step 4 reference code already present in the file, not omitted new code.

**Type consistency:** `VoteChoice`/`VoteCounts` defined in Task 1, imported in Task 5. `subscribeVotes`/`castVote` signatures match between Task 1 and Task 5. `resultFor` returns `'W'|'D'|'L'` consistently keyed into the three record maps. `tab` union includes `'recent'` and `'vote'` (Task 4 Step 1) before use.
