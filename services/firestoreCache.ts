import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.ts';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
    },
    operationType,
    path
  };
  console.error('[Firebase] Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Retrieves valid cached data from Firebase Firestore.
 * If cache is expired or doesn't exist, returns null.
 */
export async function getCachedData(cacheId: string, ttlMs: number): Promise<any | null> {
  const docPath = `cache/${cacheId}`;
  try {
    const docRef = doc(db, 'cache', cacheId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }
    const data = docSnap.data();
    if (!data || !data.updatedAt) {
      return null;
    }
    const updatedAt = new Date(data.updatedAt).getTime();
    if (Date.now() - updatedAt > ttlMs) {
      console.log(`[Cache] Cache expired for document: ${cacheId}`);
      return null;
    }
    console.log(`[Cache] Cache HIT (Firestore) for document: ${cacheId}`);
    return data.data;
  } catch (error) {
    // Gracefully fallback on cache load errors but log them
    try {
      handleFirestoreError(error, OperationType.GET, docPath);
    } catch (e) {
      // Avoid blocking operations on cache read issues
    }
    return null;
  }
}

/**
 * Saves or updates cache entry in Firebase Firestore.
 */
export async function setCachedData(cacheId: string, data: any): Promise<void> {
  const docPath = `cache/${cacheId}`;
  try {
    const docRef = doc(db, 'cache', cacheId);
    await setDoc(docRef, {
      data: data,
      updatedAt: new Date().toISOString()
    });
    console.log(`[Cache] Cache SAVED (Firestore) for document: ${cacheId}`);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    } catch (e) {
      // Avoid crashing caller on cache write issues
    }
  }
}
