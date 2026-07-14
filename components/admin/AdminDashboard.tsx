import React, { useCallback, useEffect, useState } from 'react';
import { getStatus, AdminApiError, type AdminStatus } from '../../services/adminApi';
import OverviewTab from './tabs/OverviewTab';
import CacheTab from './tabs/CacheTab';
import SourcesTab from './tabs/SourcesTab';
import MatchesTab from './tabs/MatchesTab';
import SettingsTab from './tabs/SettingsTab';

type TabId = 'overview' | 'cache' | 'sources' | 'matches' | 'settings';

const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'cache', label: 'Cache' },
    { id: 'sources', label: 'Sources' },
    { id: 'matches', label: 'Matches' },
    { id: 'settings', label: 'Settings' },
];

interface Props {
    onLogout: () => void;
    onUnauthorized: () => void;
}

// Plain function, not React.FC<Props> — see tabs/OverviewTab.tsx comment.
function AdminDashboard({ onLogout, onUnauthorized }: Props) {
    const [tab, setTab] = useState<TabId>('overview');
    const [status, setStatus] = useState<AdminStatus | null>(null);
    const [error, setError] = useState('');
    // Bumped to re-trigger the fetch effect below — kept separate from the fetch itself so
    // the effect's setState calls stay inside promise callbacks, not the effect body
    // (react-hooks/set-state-in-effect flags synchronous setState calls in an effect).
    const [refreshKey, setRefreshKey] = useState(0);
    const refreshStatus = useCallback(() => setRefreshKey(k => k + 1), []);

    useEffect(() => {
        let cancelled = false;
        getStatus()
            .then(s => {
                if (cancelled) return;
                setStatus(s);
                setError('');
            })
            .catch(e => {
                if (cancelled) return;
                if (e instanceof AdminApiError && e.status === 401) return onUnauthorized();
                setError(e instanceof Error ? e.message : 'Failed to load status');
            });
        const id = setInterval(() => {
            getStatus().then(s => { if (!cancelled) setStatus(s); }).catch(() => {});
        }, 15000);
        return () => { cancelled = true; clearInterval(id); };
    }, [refreshKey, onUnauthorized]);

    return (
        <div dir="ltr" className="min-h-screen bg-gray-100">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h1 className="text-lg font-bold text-gray-900">Yalla Match Admin</h1>
                <button onClick={onLogout} className="text-sm text-gray-600 hover:text-red-600 transition-colors">
                    Log out
                </button>
            </header>

            <nav className="bg-white border-b border-gray-200 px-6 flex gap-1 overflow-x-auto">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                            tab === t.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>

            <main className="max-w-5xl mx-auto px-6 py-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>
                )}
                {tab === 'overview' && <OverviewTab status={status} onRefresh={refreshStatus} />}
                {tab === 'cache' && <CacheTab status={status} onRefresh={refreshStatus} onUnauthorized={onUnauthorized} />}
                {tab === 'sources' && <SourcesTab onUnauthorized={onUnauthorized} />}
                {tab === 'matches' && <MatchesTab status={status} onRefresh={refreshStatus} onUnauthorized={onUnauthorized} />}
                {tab === 'settings' && <SettingsTab status={status} onRefresh={refreshStatus} onUnauthorized={onUnauthorized} />}
            </main>
        </div>
    );
}

export default AdminDashboard;
