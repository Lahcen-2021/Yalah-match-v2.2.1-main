import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    fetchThreeDayMatches, setMatchOverride, removeMatchOverride, setLeagueHidden, setLeagueShown,
    saveCustomMatch, deleteCustomMatch,
    AdminApiError, type AdminStatus, type CustomMatch, type DatedRawMatch,
} from '../../../services/adminApi';
import AdminMatchCard from '../AdminMatchCard';
import { isMajorLeague } from '../../../utils/translations';

interface Props {
    status: AdminStatus | null;
    onRefresh: () => void;
    onUnauthorized: () => void;
}

// Match-Status strings the client's mapStingMatchToMatch() understands.
const STATUS_OPTIONS = ['لم تبدأ', 'مباشر', 'الإستراحة', 'انتهت', 'مؤجلة'];

const emptyCustom = (): CustomMatch => ({
    id: '',
    date: new Date().toISOString().slice(0, 10),
    time: '20:00',
    competition: '',
    competitionLogo: '',
    homeName: '',
    homeLogo: '',
    homeScore: null,
    awayName: '',
    awayLogo: '',
    awayScore: null,
    status: 'لم تبدأ',
    tv: '',
});

// Plain function, not React.FC<Props> — see OverviewTab.tsx comment.
function MatchesTab({ status, onRefresh, onUnauthorized }: Props) {
    const [rows, setRows] = useState<DatedRawMatch[]>([]);
    // Starts true: the mount effect fetches immediately, and flipping the flag
    // synchronously inside that effect would be a cascading render.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [savedMsg, setSavedMsg] = useState('');

    // Feed filters
    const [dayFilter, setDayFilter] = useState<'all' | 'yesterday' | 'today' | 'tomorrow'>('all');
    const [leagueFilter, setLeagueFilter] = useState<string>('all');

    // Custom-match editor
    const [form, setForm] = useState<CustomMatch>(emptyCustom());
    const [editing, setEditing] = useState(false);

    // Declared before loadFeed: loadFeed calls it, and a `const` referenced
    // before its declaration is a temporal-dead-zone throw, not a hoist.
    const handleErr = useCallback((e: unknown, fallback: string) => {
        if (e instanceof AdminApiError && e.status === 401) return onUnauthorized();
        setError(e instanceof Error ? e.message : fallback);
    }, [onUnauthorized]);

    const loadFeed = useCallback(() => {
        let cancelled = false;
        fetchThreeDayMatches()
            .then(({ matches }) => { if (!cancelled) setRows(matches); })
            .catch(e => { if (!cancelled) handleErr(e, 'Failed to load matches'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [handleErr]);

    // onUnauthorized is a stable useCallback in AdminApp, so handleErr and
    // loadFeed are stable too and this effect still runs once per mount.
    useEffect(() => loadFeed(), [loadFeed]);

    // Manual Reload button: show the spinner again, then refetch.
    const reloadFeed = useCallback(() => { setLoading(true); loadFeed(); }, [loadFeed]);

    const overrides = status?.settings.matchOverrides || {};
    const hiddenLeagues = status?.settings.hiddenLeagues || [];
    const shownLeagues = status?.settings.shownLeagues || [];
    const customMatches = status?.settings.customMatches || [];

    // Mirror the public site's visibility exactly (same precedence the server applies):
    //   match hidden → off · match shown → on · league hidden → off · league shown → on · else major-league.
    const isMatchOnSite = (matchId: string, league: string): boolean => {
        const ov = overrides[matchId];
        if (ov?.hidden) return false;
        if (ov?.shown) return true;
        if (hiddenLeagues.includes(league)) return false;
        if (shownLeagues.includes(league)) return true;
        return isMajorLeague(league);
    };

    // A league contributes to the site unless hidden, when it's either force-shown or major.
    const isLeagueOnSite = (league: string): boolean =>
        !hiddenLeagues.includes(league) && (shownLeagues.includes(league) || isMajorLeague(league));

    const flash = (msg: string) => { setSavedMsg(msg); setError(''); setTimeout(() => setSavedMsg(''), 2500); };

    const apply = async (matchId: number | string, fields: Parameters<typeof setMatchOverride>[1]) => {
        try {
            await setMatchOverride(String(matchId), fields);
            onRefresh();
            flash('Saved ✓');
        } catch (e) { handleErr(e, 'Failed to save override'); }
    };

    const remove = async (matchId: string) => {
        try { await removeMatchOverride(matchId); onRefresh(); flash('Cleared ✓'); }
        catch (e) { handleErr(e, 'Failed to remove override'); }
    };

    // Show a match ON THE SITE: force it visible (beats a non-major league AND a hidden
    // league) by setting shown:true and clearing hidden.
    const showMatch = async (matchId: string) => {
        try { await setMatchOverride(matchId, { hidden: false, shown: true }); onRefresh(); flash('Match shown ✓'); }
        catch (e) { handleErr(e, 'Failed to show match'); }
    };

    // Hide a match from the site. If nothing else was overridden, drop the record entirely.
    const hideMatch = async (matchId: string) => {
        try {
            const ov = overrides[matchId] || {};
            const rest: Record<string, unknown> = { ...ov };
            delete rest.hidden; delete rest.shown;
            if (Object.keys(rest).length > 0) await setMatchOverride(matchId, { hidden: true, shown: false });
            else await setMatchOverride(matchId, { hidden: true });
            onRefresh(); flash('Match hidden ✓');
        } catch (e) { handleErr(e, 'Failed to hide match'); }
    };

    const showLeague = async (league: string) => {
        try { await setLeagueShown(league, true); onRefresh(); flash('League shown ✓'); }
        catch (e) { handleErr(e, 'Failed to show league'); }
    };

    const hideLeague = async (league: string) => {
        try { await setLeagueHidden(league, true); onRefresh(); flash('League hidden ✓'); }
        catch (e) { handleErr(e, 'Failed to hide league'); }
    };

    // Distinct league names present in the loaded feed (for the filter dropdown).
    const leagueNames = useMemo(() => {
        const set = new Set<string>();
        for (const r of rows) set.add((r.match['Cup-Name'] || '—').trim() || '—');
        return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
    }, [rows]);

    // Filtered rows, then grouped by league (each group keeps its day order).
    const groups = useMemo(() => {
        const filtered = rows.filter(r => {
            if (dayFilter !== 'all' && r.day !== dayFilter) return false;
            const lg = (r.match['Cup-Name'] || '—').trim() || '—';
            if (leagueFilter !== 'all' && lg !== leagueFilter) return false;
            return true;
        });
        const map = new Map<string, DatedRawMatch[]>();
        const order: ('yesterday' | 'today' | 'tomorrow')[] = ['yesterday', 'today', 'tomorrow'];
        for (const r of filtered) {
            const lg = (r.match['Cup-Name'] || '—').trim() || '—';
            if (!map.has(lg)) map.set(lg, []);
            map.get(lg)!.push(r);
        }
        for (const list of map.values()) list.sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day));
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ar'));
    }, [rows, dayFilter, leagueFilter]);

    const setField = (k: keyof CustomMatch, v: string) => {
        setForm(prev => ({
            ...prev,
            [k]: (k === 'homeScore' || k === 'awayScore') ? (v === '' ? null : Number(v)) : v,
        }));
    };

    const submitCustom = async () => {
        if (!form.homeName.trim() || !form.awayName.trim()) { setError('Both team names are required'); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) { setError('A valid date is required'); return; }
        try {
            await saveCustomMatch(form);
            onRefresh();
            flash(editing ? 'Match updated ✓' : 'Match created ✓');
            setForm(emptyCustom());
            setEditing(false);
        } catch (e) { handleErr(e, 'Failed to save match'); }
    };

    const editCustom = (cm: CustomMatch) => {
        setForm({ ...emptyCustom(), ...cm });
        setEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const removeCustom = async (id: string) => {
        try { await deleteCustomMatch(id); onRefresh(); if (form.id === id) { setForm(emptyCustom()); setEditing(false); } }
        catch (e) { handleErr(e, 'Failed to delete match'); }
    };

    const input = 'border border-gray-300 rounded px-2 py-1.5 text-sm';

    return (
        <div className="space-y-6">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}
            {savedMsg && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">{savedMsg}</div>}

            {/* ------------------------------------------------------------------ */}
            {/* Create / edit a custom match                                        */}
            {/* ------------------------------------------------------------------ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        {editing ? 'Edit custom match' : 'Create a match'}
                    </h3>
                    {editing && (
                        <button onClick={() => { setForm(emptyCustom()); setEditing(false); }} className="text-xs text-gray-500 hover:underline">
                            Cancel edit / new match
                        </button>
                    )}
                </div>
                <p className="text-xs text-gray-500">
                    Manually added matches appear on the site for their date alongside the live feed. Set the status to
                    <span className="font-semibold"> مباشر </span>for a live match, then attach watch servers in the <span className="font-semibold">Live</span> tab (pick it by its id).
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Date
                        <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} className={input} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Kickoff (local)
                        <input type="time" value={form.time} onChange={e => setField('time', e.target.value)} className={input} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Status
                        <select value={form.status} onChange={e => setField('status', e.target.value)} className={input}>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-500">TV channel
                        <input value={form.tv || ''} onChange={e => setField('tv', e.target.value)} placeholder="beIN 1" className={input} />
                    </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Competition (Cup-Name)
                        <input value={form.competition} onChange={e => setField('competition', e.target.value)} placeholder="كأس أمم أفريقيا للسيدات" className={input} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Competition logo URL
                        <input value={form.competitionLogo || ''} onChange={e => setField('competitionLogo', e.target.value)} dir="ltr" className={`${input} font-mono text-xs`} />
                    </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Home */}
                    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase">Home (فريق يمين)</p>
                        <input value={form.homeName} onChange={e => setField('homeName', e.target.value)} placeholder="Team name" className={`${input} w-full`} />
                        <input value={form.homeLogo || ''} onChange={e => setField('homeLogo', e.target.value)} placeholder="Logo URL" dir="ltr" className={`${input} w-full font-mono text-xs`} />
                        <input type="number" value={form.homeScore ?? ''} onChange={e => setField('homeScore', e.target.value)} placeholder="Score (blank = —)" className={`${input} w-full`} />
                    </div>
                    {/* Away */}
                    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase">Away (فريق يسار)</p>
                        <input value={form.awayName} onChange={e => setField('awayName', e.target.value)} placeholder="Team name" className={`${input} w-full`} />
                        <input value={form.awayLogo || ''} onChange={e => setField('awayLogo', e.target.value)} placeholder="Logo URL" dir="ltr" className={`${input} w-full font-mono text-xs`} />
                        <input type="number" value={form.awayScore ?? ''} onChange={e => setField('awayScore', e.target.value)} placeholder="Score (blank = —)" className={`${input} w-full`} />
                    </div>
                </div>

                <button onClick={submitCustom} className="bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg px-4 py-2">
                    {editing ? 'Update match' : 'Create match'}
                </button>
            </div>

            {/* List of custom matches */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Custom matches ({customMatches.length})</h3>
                {customMatches.length === 0 ? (
                    <p className="text-sm text-gray-400">None yet — create one above.</p>
                ) : (
                    <ul className="text-sm divide-y divide-gray-100">
                        {customMatches.map(cm => (
                            <li key={cm.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                <span className="text-gray-800">
                                    {cm.homeName} {cm.homeScore ?? ''}{(cm.homeScore != null || cm.awayScore != null) ? ' - ' : 'vs '}{cm.awayScore ?? ''} {cm.awayName}
                                    <span className="text-xs text-gray-400"> · {cm.competition || '—'} · {cm.date} {cm.time} · {cm.status}</span>
                                    <span className="text-[10px] text-gray-300"> · id: {cm.id}</span>
                                </span>
                                <span className="space-x-3">
                                    <button onClick={() => editCustom(cm)} className="text-green-700 hover:underline">Edit</button>
                                    <button onClick={() => removeCustom(cm.id)} className="text-red-600 hover:underline">Delete</button>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* Edit feed matches — yesterday / today / tomorrow, grouped by league */}
            {/* ------------------------------------------------------------------ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Edit feed matches (yesterday · today · tomorrow)</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={dayFilter} onChange={e => setDayFilter(e.target.value as any)} className={input}>
                            <option value="all">All days</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="today">Today</option>
                            <option value="tomorrow">Tomorrow</option>
                        </select>
                        <select value={leagueFilter} onChange={e => setLeagueFilter(e.target.value)} className={`${input} max-w-[220px]`}>
                            <option value="all">All leagues ({leagueNames.length})</option>
                            {leagueNames.map(lg => <option key={lg} value={lg}>{lg}</option>)}
                        </select>
                        <button onClick={reloadFeed} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded px-3 py-2">Reload</button>
                    </div>
                </div>

                {loading ? (
                    <p className="text-sm text-gray-400">Loading…</p>
                ) : groups.length === 0 ? (
                    <p className="text-sm text-gray-400">No matches found for these days.</p>
                ) : (
                    <div className="space-y-5">
                        {groups.map(([league, list]) => {
                            const leagueOnSite = isLeagueOnSite(league);
                            const logo = list[0]?.match['Cup-Logo'];
                            return (
                                <div key={league} className={`rounded-xl border ${leagueOnSite ? 'border-gray-200' : 'border-amber-300 bg-amber-50/40'}`}>
                                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100" dir="rtl">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {logo
                                                ? <img src={logo} alt="" className="w-6 h-6 object-contain" />
                                                : <span className="w-6 h-6 rounded bg-gray-100 inline-block" />}
                                            <span className="font-bold text-sm text-gray-800 truncate">{league}</span>
                                            <span className="text-xs text-gray-400">({list.length})</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${leagueOnSite ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-100 text-amber-700'}`}>
                                                {leagueOnSite ? 'ظاهر بالموقع' : 'غير ظاهر'}
                                            </span>
                                        </div>
                                        {leagueOnSite ? (
                                            <button onClick={() => hideLeague(league)}
                                                className="text-xs rounded px-3 py-1 whitespace-nowrap bg-gray-100 text-gray-700 hover:bg-gray-200">
                                                إخفاء الدوري
                                            </button>
                                        ) : (
                                            <button onClick={() => showLeague(league)}
                                                className="text-xs rounded px-3 py-1 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                                                إظهار الدوري
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {list.map(({ match, day }) => {
                                            const id = String(match['Match-id']);
                                            return (
                                                <AdminMatchCard
                                                    key={`${id}-${day}`}
                                                    match={match}
                                                    day={day}
                                                    override={overrides[id]}
                                                    onSite={isMatchOnSite(id, league)}
                                                    onSave={(fields) => apply(id, fields)}
                                                    onClear={() => remove(id)}
                                                    onShow={() => showMatch(id)}
                                                    onHide={() => hideMatch(id)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MatchesTab;
