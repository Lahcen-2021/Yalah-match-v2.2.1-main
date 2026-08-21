// Auth for the /admin panel. Single shared password (ADMIN_PASSWORD env var) — appropriate
// for a single-operator app, not a multi-user system. Issues a short-lived signed token
// (HMAC-SHA256, no external JWT lib needed) instead of sending the password on every request.
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getPassword(): string {
    return process.env.ADMIN_PASSWORD || "";
}

// Derives a signing secret from ADMIN_PASSWORD (or a dedicated ADMIN_TOKEN_SECRET if set),
// so no extra secret needs to be provisioned for a basic setup.
function getSecret(): string {
    const secret = process.env.ADMIN_TOKEN_SECRET || getPassword();
    return crypto.createHash("sha256").update(secret).digest("hex");
}

// Fixed-length digest compare avoids leaking input length via timing, unlike a direct
// string/Buffer length check before timingSafeEqual.
function safeCompare(a: string, b: string): boolean {
    const ah = crypto.createHash("sha256").update(a).digest();
    const bh = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(ah, bh);
}

function sign(payload: string): string {
    return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function isAdminEnabled(): boolean {
    return getPassword().length > 0;
}

export function checkPassword(candidate: string): boolean {
    if (!isAdminEnabled() || typeof candidate !== "string" || !candidate) return false;
    return safeCompare(candidate, getPassword());
}

// Token generation. A leaked token was otherwise valid for its full 12h with no way
// to revoke it short of changing the password (which also changes every other
// operator's session and the derived signing secret). Bumping ADMIN_TOKEN_VERSION
// invalidates every outstanding token immediately, without touching the password.
function getTokenVersion(): number {
    return Number(process.env.ADMIN_TOKEN_VERSION) || 1;
}

interface AdminTokenPayload {
    /** Expiry, ms since epoch. */
    exp: number;
    /** Issued-at, ms since epoch. Lets a leaked token be spotted in logs by age. */
    iat: number;
    /** Generation counter; see getTokenVersion(). */
    v: number;
}

export function createAdminToken(): { token: string; expiresAt: number } {
    const now = Date.now();
    const expiresAt = now + TOKEN_TTL_MS;
    const payload: AdminTokenPayload = { exp: expiresAt, iat: now, v: getTokenVersion() };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return { token: `${payloadB64}.${sign(payloadB64)}`, expiresAt };
}

export function verifyAdminToken(token: string | undefined | null): boolean {
    if (!isAdminEnabled() || !token) return false;
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return false;
    if (!safeCompare(sig, sign(payloadB64))) return false;
    try {
        const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
        if (typeof payload.exp !== "number" || Date.now() >= payload.exp) return false;
        // Tokens issued before this field existed have no `v` and are rejected, which
        // is the intended behaviour: they predate revocation support.
        if (payload.v !== getTokenVersion()) return false;
        // Reject a token claiming to be issued in the future, or one whose lifetime
        // exceeds the configured TTL — both indicate a forged or replayed payload.
        if (typeof payload.iat !== "number" || payload.iat > Date.now() + 60_000) return false;
        if (payload.exp - payload.iat > TOKEN_TTL_MS) return false;
        return true;
    } catch {
        return false;
    }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!isAdminEnabled()) {
        res.status(503).json({ error: "Admin panel disabled. Set ADMIN_PASSWORD on the server to enable it." });
        return;
    }
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!verifyAdminToken(token)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    next();
}
