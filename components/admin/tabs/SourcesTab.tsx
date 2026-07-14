import React, { useCallback, useEffect, useState } from 'react';
import { getSources, setSourceEnabled, AdminApiError } from '../../../services/adminApi';

interface SourceRow {
    source: string;
    enabled: boolean;
}

interface Props {
    onUnauthorized: () => void;
}

// Plain function, not React.FC<Props> — see OverviewTab.tsx comment.
function SourcesTab({ onUnauthorized }: Props) {
    const [sources, setSources] = useState<SourceRow[]>([]);
    const [breakerStatus, setBreakerStatus] = useState<Record<string, { state: string; failureCount: number }>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const data = await getSources();
            setSources(data.sources);
            setBreakerStatus(data.circuitBreaker as any);
            setError('');
        } catch (e) {
            if (e instanceof AdminApiError && e.status === 401) return onUnauthorized();
            setError(e instanceof Error ? e.message : 'Failed to load sources');
        } finally {
            setLoading(false);
        }
    }, [onUnauthorized]);

    useEffect(() => { load(); }, [load]);

    const toggle = async (source: string, enabled: boolean) => {
        setSources(prev => prev.map(s => s.source === source ? { ...s, enabled } : s));
        try {
            await setSourceEnabled(source, enabled);
        } catch (e) {
            if (e instanceof AdminApiError && e.status === 401) return onUnauthorized();
            setError(e instanceof Error ? e.message : 'Failed to update source');
            load(); // revert optimistic update on failure
        }
    };

    if (loading) return <p className="text-gray-500">Loading…</p>;

    return (
        <div className="space-y-6">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Data source kill switches</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Disabling a source stops the server from attempting it, regardless of the automatic circuit breaker.
                </p>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-400">
                            <th className="py-2">Source</th>
                            <th className="py-2">Breaker state</th>
                            <th className="py-2 text-right">Enabled</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sources.map(s => {
                            const breaker = breakerStatus[s.source];
                            return (
                                <tr key={s.source} className="border-t border-gray-100">
                                    <td className="py-2.5 text-gray-800">{s.source}</td>
                                    <td className="py-2.5">
                                        {breaker ? (
                                            <span className={
                                                breaker.state === 'open' ? 'text-red-600' : breaker.state === 'half-open' ? 'text-amber-600' : 'text-green-700'
                                            }>
                                                {breaker.state} ({breaker.failureCount} failures)
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">closed</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 text-right">
                                        <button
                                            onClick={() => toggle(s.source, !s.enabled)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                s.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}
                                        >
                                            {s.enabled ? 'Enabled' : 'Disabled'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default SourcesTab;
