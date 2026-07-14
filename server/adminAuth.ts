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

export function createAdminToken(): { token: string; expiresAt: number } {
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    const payloadB64 = Buffer.from(JSON.stringify({ exp: expiresAt })).toString("base64url");
    return { token: `${payloadB64}.${sign(payloadB64)}`, expiresAt };
}

export function verifyAdminToken(token: string | undefined | null): boolean {
    if (!isAdminEnabled() || !token) return false;
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return false;
    if (!safeCompare(sig, sign(payloadB64))) return false;
    try {
        const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
        return typeof payload.exp === "number" && Date.now() < payload.exp;
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
