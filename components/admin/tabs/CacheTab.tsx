import React, { useState } from 'react';
import { clearMemoryCache, refreshMatches, AdminApiError, type AdminStatus } from '../../../services/adminApi';

interface Props {
    status: AdminStatus | null;
    onRefresh: () => void;
    onUnauthorized: () => void;
}

// Plain function, not React.FC<Props> — see OverviewTab.tsx comment.
function CacheTab({ status, onRefresh, onUnauthorized }: Props) {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    const run = async (fn: () => Promise<unknown>, successMsg: string) => {
        setBusy(true);
        setMessage('');
        try {
            await fn();
            setMessage(successMsg);
            onRefresh();
        } catch (e) {
            if (e instanceof AdminApiError && e.status === 401) return onUnauthorized();
            setMessage(e instanceof Error ? e.message : 'Failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">In-memory match cache (10s TTL)</h3>
                {status?.memoryCache.matches.length ? (
                    <table className="w-full text-sm mb-4">
                        <tbody>
                            {status.memoryCache.matches.map(m => (
                                <tr key={m.key} className="border-t border-gray-100">
                                    <td className="py-1.5 text-gray-700">{m.key}</td>
                                    <td className="py-1.5 text-gray-400 text-right">{Math.round(m.ageMs / 1000)}s old</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-sm text-gray-400 mb-4">No dates currently cached in memory.</p>
                )}
                <button
                    disabled={busy}
                    onClick={() => run(() => clearMemoryCache(), 'In-memory cache cleared.')}
                    className="text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-800 rounded-lg px-4 py-2"
                >
                    Clear all in-memory cache
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Force-refresh a date</h3>
                <p className="text-sm text-gray-500 mb-3">
                    Bypasses both the in-memory and Firestore cache, re-fetches from upstream sources, and re-saves the result.
                </p>
                <div className="flex gap-3">
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                        disabled={busy}
                        onClick={() => run(() => refreshMatches(date), `Refreshed matches for ${date}.`)}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2"
                    >
                        Force refresh
                    </button>
                </div>
            </div>

            {message && <p className="text-sm text-gray-700">{message}</p>}
        </div>
    );
}

export default CacheTab;
