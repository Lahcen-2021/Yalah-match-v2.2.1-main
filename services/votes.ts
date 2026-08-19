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
