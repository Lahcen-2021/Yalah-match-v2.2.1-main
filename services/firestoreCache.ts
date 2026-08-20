// Read-through cache backed by the Firestore `cache` collection.
//
// SERVER-ONLY. Every consumer is server-side (server.ts, server/adminSettings.ts,
// server/adminChannels.ts, server/killSwitch.ts) and writes now go through the
// firebase-admin SDK, which bypasses firestore.rules.
//
// That matters because firestore.rules previously had to allow UNAUTHENTICATED
// writes to /cache/{cacheId} for these writes to land - which meant anyone on
// the internet could overwrite cache/matches_YYYY-MM-DD and the app would render
// it. The rules are now read-only for clients; the server writes as an admin.
//
// If FIREBASE_ADMIN_CREDENTIALS is not configured, writes are skipped with a
// warning rather than failing: the app degrades to its in-memory cache plus a
// live upstream fetch, which is correct behaviour, just slower.
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.ts';
import { getAdminDb } from '../server/firebaseAdmin.ts';
import { handleFirestoreError, OperationType } from './firestoreErrors.ts';

export { OperationType, handleFirestoreError };
export type { FirestoreErrorInfo } from './firestoreErrors.ts';

let warnedNoAdmin = false;

/**
 * Retrieves valid cached data from Firestore.
 * Returns null when the entry is missing or older than `ttlMs`.
 *
 * Reads stay on the client SDK: /cache is world-readable by design, and the
 * admin SDK is not guaranteed to be configured.
 */
export async function getCachedData(cacheId: string, ttlMs: number): Promise<any | null> {
  const docPath = `cache/${cacheId}`;
  try {
    const admin = getAdminDb();
    let data: any | undefined;

    if (admin) {
      const snap = await admin.collection('cache').doc(cacheId).get();
      if (!snap.exists) return null;
      data = snap.data();
    } else {
      const snap = await getDoc(doc(db, 'cache', cacheId));
      if (!snap.exists()) return null;
      data = snap.data();
    }

    if (!data || !data.updatedAt) return null;

    const updatedAt = new Date(data.updatedAt).getTime();
    if (Date.now() - updatedAt > ttlMs) return null;

    return data.data;
  } catch (error) {
    // Cache reads must never block the caller — log and fall through to a live fetch.
    try {
      handleFirestoreError(error, OperationType.GET, docPath);
    } catch {
      /* swallowed deliberately */
    }
    return null;
  }
}

/**
 * Saves or updates a cache entry. Requires the admin SDK; see the file header
 * for why, and what happens when it is not configured.
 */
export async function setCachedData(cacheId: string, data: any): Promise<void> {
  const docPath = `cache/${cacheId}`;
  const admin = getAdminDb();

  if (!admin) {
    if (!warnedNoAdmin) {
      warnedNoAdmin = true;
      console.warn(
        '[Cache] FIREBASE_ADMIN_CREDENTIALS is not set, so the Firestore cache is read-only. ' +
        'The app still works (in-memory cache + live upstream), just without the persistent layer. ' +
        'Set it to restore Firestore caching — client writes are denied by firestore.rules by design.',
      );
    }
    return;
  }

  try {
    await admin.collection('cache').doc(cacheId).set({
      data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    } catch {
      /* swallowed deliberately — a cache write failure must not crash the caller */
    }
  }
}
