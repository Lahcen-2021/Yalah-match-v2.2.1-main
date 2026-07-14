import React, { useCallback, useState } from 'react';
import { getAdminToken, clearAdminToken, login as adminLogin } from '../../services/adminApi';
import AdminDashboard from './AdminDashboard';

// Entry point for the /admin route (wired up in index.tsx). Deliberately not RTL/Arabic
// like the rest of the app — this is an operator tool, not user-facing content.
// Plain function, not React.FC — see components/admin/tabs/OverviewTab.tsx comment.
function AdminApp() {
    const [token, setToken] = useState<string | null>(getAdminToken());
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { token: newToken } = await adminLogin(password);
            setToken(newToken);
            setPassword('');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    }, [password]);

    const handleLogout = useCallback(() => {
        clearAdminToken();
        setToken(null);
    }, []);

    // Surfaced by the dashboard whenever any admin fetch comes back 401 (token expired).
    const handleUnauthorized = useCallback(() => {
        clearAdminToken();
        setToken(null);
        setError('Session expired. Please log in again.');
    }, []);

    if (!token) {
        return (
            <div dir="ltr" className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
                <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
                    <h1 className="text-xl font-bold text-gray-900 mb-1">Yalla Match Admin</h1>
                    <p className="text-sm text-gray-500 mb-6">Sign in with the admin password.</p>
                    <input
                        type="password"
                        autoFocus
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Admin password"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                    {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 transition-colors"
                    >
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>
            </div>
        );
    }

    return <AdminDashboard onLogout={handleLogout} onUnauthorized={handleUnauthorized} />;
}

export default AdminApp;
