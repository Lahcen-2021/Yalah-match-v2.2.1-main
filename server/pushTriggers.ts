// Companion to prewarmCache() in server.ts: diffs the shared matches cache against the
// previous tick (same in-memory-map style as matchesCache/koooraCache) and, on a real change,
// looks up which users favorited either team and pushes to their devices. This is the
// server-side equivalent of App.tsx's processNewData() diffing — it has to live here because
// only the server sees every user's favorites at once, and only the server runs when no tab is open.
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminMessagingInstance } from "./firebaseAdmin.ts";

const FINISHED_STATUS = "انتهت";
const LIVE_STATUS = "جارية";

interface MatchSnapshot {
    scoreA: number;
    scoreB: number;
    statusText: string;
}

const previousState: Record<string, MatchSnapshot> = {};

async function notifyFavoriteFollowers(
    teamA: string,
    teamB: string,
    snapshot: MatchSnapshot,
    scoreChanged: boolean
): Promise<void> {
    const adminDb = getAdminDb();
    const adminMessaging = getAdminMessagingInstance();
    if (!adminDb || !adminMessaging) return;

    const tokenOwners: { uid: string; token: string }[] = [];
    const seenUids = new Set<string>();

    for (const team of [teamA, teamB]) {
        if (!team) continue;
        const snap = await adminDb.collection("users").where("favoriteTeams", "array-contains", team).get();
        snap.forEach(doc => {
            if (seenUids.has(doc.id)) return;
            seenUids.add(doc.id);
            const tokens: string[] = doc.data().fcmTokens || [];
            for (const token of tokens) tokenOwners.push({ uid: doc.id, token });
        });
    }
    if (tokenOwners.length === 0) return;

    const title = scoreChanged
        ? `⚽ ${teamA} ${snapshot.scoreA} - ${snapshot.scoreB} ${teamB}`
        : `${teamA} ${snapshot.scoreA} - ${snapshot.scoreB} ${teamB}`;
    const body = snapshot.statusText === FINISHED_STATUS ? "انتهت المباراة" : (scoreChanged ? "تحديث في النتيجة!" : snapshot.statusText);

    // sendEachForMulticast caps at 500 tokens per call.
    for (let i = 0; i < tokenOwners.length; i += 500) {
        const batch = tokenOwners.slice(i, i + 500);
        try {
            const response = await adminMessaging.sendEachForMulticast({
                tokens: batch.map(t => t.token),
                notification: { title, body },
            });
            response.responses.forEach((r, idx) => {
                const code = r.error?.code;
                if (!r.success && (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token")) {
                    const { uid, token } = batch[idx];
                    adminDb.collection("users").doc(uid).update({ fcmTokens: FieldValue.arrayRemove(token) }).catch(() => {});
                }
            });
        } catch (e) {
            console.error("[PushTriggers] sendEachForMulticast failed:", e);
        }
    }
}

export async function processMatchUpdates(matchesData: any): Promise<void> {
    if (!getAdminDb() || !getAdminMessagingInstance()) return;

    const rawMatches = matchesData?.["STING-WEB-Matches"];
    if (!Array.isArray(rawMatches)) return;

    for (const match of rawMatches) {
        const id = String(match["Match-id"]);
        const teamA = match["Team-Right"]?.Name || "";
        const teamB = match["Team-Left"]?.Name || "";
        const scoreA = parseInt(match["Team-Right"]?.Goal) || 0;
        const scoreB = parseInt(match["Team-Left"]?.Goal) || 0;
        const statusText = match["Match-Status"] || "";

        const snapshot: MatchSnapshot = { scoreA, scoreB, statusText };
        const prev = previousState[id];
        previousState[id] = snapshot;

        if (!prev) continue; // first sighting this run — nothing to diff against yet

        const scoreChanged = prev.scoreA !== scoreA || prev.scoreB !== scoreB;
        const statusChanged = prev.statusText !== statusText && (statusText === FINISHED_STATUS || statusText === LIVE_STATUS);
        if (!scoreChanged && !statusChanged) continue;

        await notifyFavoriteFollowers(teamA, teamB, snapshot, scoreChanged).catch(e =>
            console.error(`[PushTriggers] Failed to notify followers for match ${id}:`, e)
        );
    }
}
