import React, { useEffect, useState } from 'react';
import { updateSettings, AdminApiError, type AdminStatus } from '../../../services/adminApi';

interface Props {
    status: AdminStatus | null;
    onRefresh: () => void;
    onUnauthorized: () => void;
}

// Plain function, not React.FC<Props> — see OverviewTab.tsx comment.
function SettingsTab({ status, onRefresh, onUnauthorized }: Props) {
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (status?.settings) {
            setMaintenanceMode(status.settings.maintenanceMode);
            setMessage(status.settings.maintenanceMessage || '');
        }
    }, [status]);

    const save = async () => {
        setSaving(true);
        setError('');
        try {
            await updateSettings({ maintenanceMode, maintenanceMessage: message });
            setSaved('Saved.');
            onRefresh();
        } catch (e) {
            if (e instanceof AdminApiError && e.status === 401) return onUnauthorized();
            setError(e instanceof Error ? e.message : 'Failed to save settings');
        } finally {
            setSaving(false);
            setTimeout(() => setSaved(''), 2000);
        }
    };

    return (
        <div className="space-y-6">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Maintenance mode</h3>
                <p className="text-sm text-gray-500 mb-4">
                    When enabled, /api/matches returns a maintenance response instead of match data for every date.
                </p>
                <label className="flex items-center gap-2 mb-4">
                    <input type="checkbox" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm text-gray-800">Enable maintenance mode</span>
                </label>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Message shown to users while in maintenance mode (optional)"
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
                />
                <div className="flex items-center gap-3">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    {saved && <span className="text-sm text-green-700">{saved}</span>}
                </div>
            </div>
        </div>
    );
}

export default SettingsTab;
