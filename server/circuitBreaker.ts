// Per-source circuit breaker so a blocked/failing scraper falls through to the
// next fallback tier immediately instead of being retried on every single request.
import { config } from "./config.ts";

type BreakerState = 'closed' | 'open' | 'half-open';

interface SourceState {
    failureCount: number;
    lastFailureAt: number;
    state: BreakerState;
}

// Sources known to actively block scrapers get a shorter trip threshold and a
// longer cooldown than the global default.
const PER_SOURCE_OVERRIDES: Record<string, { threshold?: number; cooldownMs?: number }> = {
    kooora: { threshold: 3, cooldownMs: 10 * 60 * 1000 },
};

const sources: Record<string, SourceState> = {};

function getState(source: string): SourceState {
    if (!sources[source]) {
        sources[source] = { failureCount: 0, lastFailureAt: 0, state: 'closed' };
    }
    return sources[source];
}

function thresholdFor(source: string): number {
    return PER_SOURCE_OVERRIDES[source]?.threshold ?? config.circuitBreaker.threshold;
}

function cooldownFor(source: string): number {
    return PER_SOURCE_OVERRIDES[source]?.cooldownMs ?? config.circuitBreaker.cooldownMs;
}

export function canAttempt(source: string): boolean {
    const s = getState(source);
    if (s.state === 'closed') return true;

    const cooledDown = Date.now() - s.lastFailureAt >= cooldownFor(source);
    if (s.state === 'open' && cooledDown) {
        s.state = 'half-open';
        return true; // allow exactly one trial call
    }
    if (s.state === 'half-open') {
        // A trial call is already in flight conceptually; allow it through.
        // recordSuccess/recordFailure resolve the half-open state.
        return true;
    }
    return false; // open, still cooling down
}

export function recordSuccess(source: string): void {
    const s = getState(source);
    s.failureCount = 0;
    s.state = 'closed';
}

export function recordFailure(source: string): void {
    const s = getState(source);
    s.failureCount += 1;
    s.lastFailureAt = Date.now();
    if (s.state === 'half-open' || s.failureCount >= thresholdFor(source)) {
        s.state = 'open';
    }
}

export function getStatus(): Record<string, SourceState & { threshold: number; cooldownMs: number }> {
    const out: Record<string, SourceState & { threshold: number; cooldownMs: number }> = {};
    for (const [source, s] of Object.entries(sources)) {
        out[source] = { ...s, threshold: thresholdFor(source), cooldownMs: cooldownFor(source) };
    }
    return out;
}
