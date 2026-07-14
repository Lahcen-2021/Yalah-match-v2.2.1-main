import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

// Firestore is used only for the read-through cache layer (services/firestoreCache.ts), which the
// server relies on. The auth + messaging that used to live here were removed together with the
// favorites/push-notification features, so this module is now reachable only from the server cache.

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Get Firestore Database with correct custom DB ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
