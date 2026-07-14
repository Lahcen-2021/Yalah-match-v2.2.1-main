// Admin SDK bypasses firestore.rules entirely — required since the push trigger needs to
// read every user's fcmTokens, not just one. Inert (returns null) until
// FIREBASE_ADMIN_CREDENTIALS is set, so it never breaks local dev without that secret.
import fs from "node:fs";
import { initializeApp, getApps, cert, type App, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { config } from "./config.ts";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

let app: App | null = null;
let adminFirestore: Firestore | null = null;
let adminMessaging: Messaging | null = null;
let initAttempted = false;

function loadServiceAccount(): ServiceAccount | null {
    const raw = config.firebaseAdminCredentials;
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        try {
            return JSON.parse(fs.readFileSync(raw, "utf-8"));
        } catch (e) {
            console.error("[FirebaseAdmin] FIREBASE_ADMIN_CREDENTIALS is neither valid JSON nor a readable file path:", e);
            return null;
        }
    }
}

function ensureInitialized(): boolean {
    if (app) return true;
    if (initAttempted) return false;
    initAttempted = true;

    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) return false;

    app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    adminFirestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    adminMessaging = getMessaging(app);
    return true;
}

export function getAdminDb(): Firestore | null {
    return ensureInitialized() ? adminFirestore : null;
}

export function getAdminMessagingInstance(): Messaging | null {
    return ensureInitialized() ? adminMessaging : null;
}
