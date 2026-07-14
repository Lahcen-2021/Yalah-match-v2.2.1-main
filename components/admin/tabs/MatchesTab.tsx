import React, { useEffect, useState } from 'react';
import { fetchRawMatches, setMatchOverride, removeMatchOverride, AdminApiError, type AdminStatus, type RawMatch } from '../../../services/adminApi';

interface Props {
    status: AdminStatus | null;
    onRefresh: () => void;
    onUnauthorized: () => void;
}

// Plain function, not React.FC<Props> — see OverviewTab.tsx comment.
function MatchesTab({ status, onRefresh, onUnauthorized }: Props) {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [matches, setMatches] = useState<RawMatch[]>([]);
    const [loading, setLoading] = useState(false);
    const [tvDrafts, setTvDrafts] = useState<Record<string, string>>({});
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        // Deferred into a .then() rather than called synchronously, so this doesn't trip
        // react-hooks/set-state-in-effect (see AdminDashboard.tsx for the same pattern).
        Promise.resolve().then(() => { if (!cancelled) setLoading(true); });
        fetchRawMatches(date)
            .then(data => { if (!cancelled) setMatches(data); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [date]);

    const overrides = status?.settings.matchOverrides || {};

    const apply = async (matchId: number, fields: { Tv?: string; hidden?: boolean }) => {
        try {
            await setMatchOverride(String(matchId), fields);
            onRefresh();
            setError('');
        } catch (e) {
            if (e instanceof AdminApiError && e.status === 401) return onUnauthorized();
            setError(e instanceof Error ? e.message : 'Failed to save override');
        }
    };

    const remove = async (matchId: string) => {
        try {
            await removeMatchOverride(matchId);
            onRefresh();
        } catch (e) {
            if (e instanceof AdminApiError && e.status === 401) return onUnauthorized();
            setError(e instanceof Error ? e.message : 'Failed to remove override');
        }
    };

    return (
        <div className="space-y-6">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Matches on a date</h3>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                </div>
                {loading ? (
                    <p className="text-sm text-gray-400">Loading…</p>
                ) : matches.length === 0 ? (
                    <p className="text-sm text-gray-400">No matches found for this date.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-400">
                                <th className="py-2">Match</th>
                                <th className="py-2">Channel (Tv)</th>
                                <th className="py-2 text-right">Override</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matches.map((m) => {
                                const id = String(m['Match-id']);
                                const override = overrides[id];
                                return (
                                    <tr key={id} className="border-t border-gray-100">
                                        <td className="py-2.5 text-gray-800">
                                            {m['Team-Right']?.Name} vs {m['Team-Left']?.Name}
                                            <div className="text-xs text-gray-400">{m['Cup-Name']} · #{id}</div>
                                        </td>
                                        <td className="py-2.5 text-gray-600">{override?.Tv || m.Tv || '—'}</td>
                                        <td className="py-2.5 text-right space-x-2">
                                            <input
                                                placeholder="New channel"
                                                value={tvDrafts[id] ?? ''}
                                                onChange={(e) => setTvDrafts(prev => ({ ...prev, [id]: e.target.value }))}
                                                className="border border-gray-300 rounded px-2 py-1 text-xs w-28"
                                            />
                                            <button
                                                onClick={() => apply(m['Match-id'], { Tv: tvDrafts[id] })}
                                                disabled={!tvDrafts[id]}
                                                className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded px-2 py-1"
                                            >
                                                Set
                                            </button>
                                            <button
                                                onClick={() => apply(m['Match-id'], { hidden: !override?.hidden })}
                                                className={`text-xs rounded px-2 py-1 ${override?.hidden ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}
                                            >
                                                {override?.hidden ? 'Hidden' : 'Hide'}
                                            </button>
                                            {override && (
                                                <button onClick={() => remove(id)} className="text-xs text-red-600 hover:underline">
                                                    Clear
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">All active overrides</h3>
                {Object.keys(overrides).length === 0 ? (
                    <p className="text-sm text-gray-400">No overrides set.</p>
                ) : (
                    <ul className="text-sm space-y-1">
                        {Object.entries(overrides).map(([id, ov]) => (
                            <li key={id} className="flex justify-between border-t border-gray-100 py-1.5">
                                <span className="text-gray-700">#{id}: {ov.Tv ? `Tv = ${ov.Tv}` : ''} {ov.hidden ? '(hidden)' : ''}</span>
                                <button onClick={() => remove(id)} className="text-red-600 hover:underline">Clear</button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default MatchesTab;
