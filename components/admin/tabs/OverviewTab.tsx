import React from 'react';
import type { AdminStatus } from '../../../services/adminApi';

interface Props {
    status: AdminStatus | null;
    onRefresh: () => void;
}

const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
        {children}
    </div>
);

// Plain function (not React.FC<Props>) — with FC's call-signature typing, TS 5.8 infers
// Object.values()/Object.entries() on a Record<string, number> prop as unknown[] here,
// presumably an inference-order quirk between the contextual FC return type and the
// generic overload; a plain typed function sidesteps it.
function OverviewTab({ status, onRefresh }: Props) {
    if (!status) return <p className="text-gray-500">Loading…</p>;

    const totalRequests = Object.values(status.requestCounts).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">Auto-refreshes every 15s.</p>
                <button onClick={onRefresh} className="text-sm text-green-700 hover:underline">Refresh now</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card title="Uptime">
                    <p className="text-2xl font-bold text-gray-900">{formatUptime(status.uptimeMs)}</p>
                    <p className="text-xs text-gray-400 mt-1">since {new Date(status.startedAt).toLocaleString()}</p>
                </Card>
                <Card title="Requests served">
                    <p className="text-2xl font-bold text-gray-900">{totalRequests}</p>
                    <p className="text-xs text-gray-400 mt-1">since startup</p>
                </Card>
                <Card title="Status codes">
                    <div className="flex gap-3 text-sm">
                        {Object.entries(status.statusCounts).map(([code, count]) => (
                            <span key={code} className={code.startsWith('2') ? 'text-green-700' : code.startsWith('4') || code.startsWith('5') ? 'text-red-600' : 'text-gray-700'}>
                                {code}: {count}
                            </span>
                        ))}
                    </div>
                </Card>
            </div>

            <Card title="Last successful scrape per source">
                <table className="w-full text-sm">
                    <tbody>
                        {Object.entries(status.lastScrapeAt).length === 0 && (
                            <tr><td className="text-gray-400 py-1">No scrapes recorded yet.</td></tr>
                        )}
                        {Object.entries(status.lastScrapeAt).map(([source, at]) => (
                            <tr key={source} className="border-t border-gray-100">
                                <td className="py-1.5 text-gray-700">{source}</td>
                                <td className="py-1.5 text-gray-400 text-right">{new Date(at).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Card title="Recent errors (4xx/5xx)">
                {status.recentErrors.length === 0 ? (
                    <p className="text-sm text-gray-400">No errors recorded.</p>
                ) : (
                    <table className="w-full text-sm">
                        <tbody>
                            {status.recentErrors.map((e, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                    <td className="py-1.5 text-gray-400 whitespace-nowrap">{new Date(e.at).toLocaleTimeString()}</td>
                                    <td className="py-1.5 text-gray-700">{e.route}</td>
                                    <td className="py-1.5 text-red-600 text-right">{e.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            <Card title="Request counts by route">
                <table className="w-full text-sm">
                    <tbody>
                        {Object.entries(status.requestCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([route, count]) => (
                                <tr key={route} className="border-t border-gray-100">
                                    <td className="py-1.5 text-gray-700">{route}</td>
                                    <td className="py-1.5 text-gray-900 text-right font-medium">{count}</td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}

export default OverviewTab;
