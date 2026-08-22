import React, { useEffect, useState } from 'react';
import { dayLabel } from '../../services/adminApi';
import type { RawMatch, MatchOverrideFields, AdminChannel } from '../../services/adminApi';

// Match-Status strings the client's mapStingMatchToMatch() understands.
const STATUS_OPTIONS = ['لم تبدأ', 'مباشر', 'الإستراحة', 'انتهت', 'مؤجلة'];



interface Props {
    match: RawMatch;
    // A feed date (YYYY-MM-DD), not one of three fixed days: the admin now spans an
    // arbitrary range, so the label is derived from the date itself.
    date: string;
    override?: MatchOverrideFields;
    // Whether this match is currently visible on the public site (computed by the tab).
    onSite: boolean;
    onSave: (fields: MatchOverrideFields) => Promise<void> | void;
    onClear: () => Promise<void> | void;
    onShow: () => Promise<void> | void;
    onHide: () => Promise<void> | void;
}

const TrophyIcon = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
);

// Colour + wording for the status pill, mirroring the public MatchCard.
function statusStyle(status: string): string {
    if (status.includes('مباشر') || status.includes('جارية')) return 'bg-red-50 text-red-600 border-red-100';
    if (status.includes('الإستراحة') || status.includes('استراحة')) return 'bg-orange-50 text-orange-600 border-orange-100';
    if (status.includes('انتهت') || status.includes('مؤجلة')) return 'bg-gray-100 text-gray-600 border-gray-200';
    return 'bg-green-50 text-green-600 border-green-100';
}

const Logo = ({ src, alt, className, fallback }: { src?: string; alt: string; className: string; fallback: React.ReactNode }) => {
    const [broken, setBroken] = useState(false);
    if (!src || broken) return <>{fallback}</>;
    return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setBroken(true)} />;
};

// Parse a flat "beIN 1 - SSC 2" / "a | b" TV string into channel rows.
function parseTv(tv?: string): AdminChannel[] {
    if (!tv) return [];
    return tv.split(/\s*\|\s*|\s+-\s+/).map(s => s.trim()).filter(Boolean).map(name => ({ name }));
}

function AdminMatchCard({ match, date, override, onSite, onSave, onClear, onShow, onHide }: Props) {
    const id = String(match['Match-id']);
    const home = match['Team-Right'] || {};
    const away = match['Team-Left'] || {};

    // Effective (override-applied) display values.
    const status = override?.['Match-Status'] || match['Match-Status'] || 'لم تبدأ';
    const homeScore = override?.homeScore ?? (home.Goal !== '' && home.Goal != null ? Number(home.Goal) : null);
    const awayScore = override?.awayScore ?? (away.Goal !== '' && away.Goal != null ? Number(away.Goal) : null);
    const hasScore = homeScore != null || awayScore != null;

    const kickoff = (() => {
        const t = match['Time-Start'];
        if (!t) return '';
        const d = new Date(t);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hour12: false });
    })();

    const effectiveChannels = override?.channels && override.channels.length > 0 ? override.channels : parseTv(match.Tv);
    // The card is greyed whenever the match is NOT on the public site.
    const hidden = !onSite;

    // --- Edit drawer state ---
    const [open, setOpen] = useState(false);
    const [draftStatus, setDraftStatus] = useState(status);
    const [draftHome, setDraftHome] = useState<string>(homeScore == null ? '' : String(homeScore));
    const [draftAway, setDraftAway] = useState<string>(awayScore == null ? '' : String(awayScore));
    const [channels, setChannels] = useState<AdminChannel[]>(effectiveChannels);
    const [saving, setSaving] = useState(false);

    // Re-seed the drafts whenever the override changes underneath us (e.g. after a save).
    useEffect(() => {
        if (open) return;
        setDraftStatus(status);
        setDraftHome(homeScore == null ? '' : String(homeScore));
        setDraftAway(awayScore == null ? '' : String(awayScore));
        setChannels(effectiveChannels);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [override]);

    const setChannel = (i: number, k: keyof AdminChannel, v: string) =>
        setChannels(prev => prev.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
    const addChannel = () => setChannels(prev => [...prev, { name: '', logo: '', url: '' }]);
    const removeChannel = (i: number) => setChannels(prev => prev.filter((_, idx) => idx !== i));

    const save = async () => {
        setSaving(true);
        try {
            await onSave({
                'Match-Status': draftStatus,
                homeScore: draftHome === '' ? null : Number(draftHome),
                awayScore: draftAway === '' ? null : Number(draftAway),
                channels: channels.map(c => ({ name: c.name.trim(), logo: (c.logo || '').trim(), url: (c.url || '').trim() })).filter(c => c.name),
            });
            setOpen(false);
        } finally { setSaving(false); }
    };

    const input = 'border border-gray-300 rounded px-2 py-1.5 text-sm';

    return (
        <div className={`bg-white rounded-xl shadow-sm border relative overflow-hidden transition ${hidden ? 'border-amber-300 opacity-70' : 'border-gray-100'}`} dir="rtl">
            {/* Header: league · status · channel chip */}
            <div className="px-3 py-2 border-b border-gray-200 flex justify-between items-center bg-[#f8f9fa]">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                        <Logo src={match['Cup-Logo']} alt={match['Cup-Name'] || ''} className="w-full h-full object-contain" fallback={<TrophyIcon className="w-4 h-4 text-gray-300" />} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 truncate">{match['Cup-Name'] || '—'}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${statusStyle(status)}`}>{status}</span>
                <div className="flex items-center gap-1 min-w-0 justify-end" dir="ltr">
                    {effectiveChannels.length > 0 ? (
                        <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-1 rounded-md border border-gray-200" title={effectiveChannels.map(c => c.name).join(' • ')}>
                            {effectiveChannels[0].logo && <img src={effectiveChannels[0].logo} alt="" className="h-4 w-auto max-w-[44px] object-contain" />}
                            <span className="text-[10px] font-bold text-gray-800 truncate max-w-[90px]">{effectiveChannels[0].name}</span>
                            {effectiveChannels.length > 1 && <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 rounded">+{effectiveChannels.length - 1}</span>}
                        </div>
                    ) : <span className="text-[10px] text-gray-300">—</span>}
                </div>
            </div>

            {/* Body: teams + score/time */}
            <div className="p-3">
                <div className="flex items-center justify-between">
                    <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50/50">
                            <Logo src={home.Logo} alt={home.Name || ''} className="w-full h-full object-contain" fallback={<span className="text-[9px] text-gray-300">?</span>} />
                        </div>
                        <span className="font-bold text-[11px] text-gray-800 text-center leading-tight">{home.Name || 'فريق'}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center w-24 shrink-0 mx-1">
                        <div className="bg-white border border-gray-100 shadow-sm rounded-lg px-2 py-1 flex items-center justify-center min-w-[54px]">
                            {hasScore
                                ? <span className="text-xl font-black text-gray-900 tracking-wider" dir="ltr">{awayScore ?? 0} - {homeScore ?? 0}</span>
                                : <span className="text-base font-black text-gray-900" dir="ltr">{kickoff || '—'}</span>}
                        </div>
                        <span className="text-[9px] text-gray-500 mt-1 font-bold" dir="ltr">
                            {dayLabel(date)}{kickoff ? ` · ${kickoff}` : ''}
                        </span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50/50">
                            <Logo src={away.Logo} alt={away.Name || ''} className="w-full h-full object-contain" fallback={<span className="text-[9px] text-gray-300">?</span>} />
                        </div>
                        <span className="font-bold text-[11px] text-gray-800 text-center leading-tight">{away.Name || 'فريق'}</span>
                    </div>
                </div>

                {/* Channels list — only when the match has channels and is on the site */}
                {onSite && effectiveChannels.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-50 flex flex-wrap items-center justify-center gap-1.5" dir="ltr">
                        {effectiveChannels.map((c, i) => {
                            const chip = (
                                <div className={`flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm ${c.url ? 'hover:border-emerald-300 hover:bg-emerald-50' : ''}`}>
                                    {c.logo && <img src={c.logo} alt="" className="h-3.5 w-auto max-w-[40px] object-contain" />}
                                    <span className="text-[10px] font-bold text-gray-700 whitespace-nowrap">{c.name}</span>
                                    {c.url && (
                                        <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    )}
                                </div>
                            );
                            return c.url
                                ? <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="no-underline">{chip}</a>
                                : <span key={i}>{chip}</span>;
                        })}
                    </div>
                )}

                {/* Action row. Off-site cards expose only إظهار (Show). */}
                <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-center gap-2 flex-wrap">
                    {!onSite ? (
                        <>
                            <span className="text-[11px] font-bold text-amber-600">غير ظاهرة بالموقع</span>
                            <button onClick={() => onShow()} className="text-xs rounded px-4 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                                إظهار
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setOpen(o => !o)} className="text-xs bg-green-600 hover:bg-green-700 text-white rounded px-3 py-1">
                                {open ? 'إغلاق' : 'تعديل'}
                            </button>
                            <button onClick={() => onHide()} className="text-xs rounded px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700">
                                إخفاء
                            </button>
                            {override && Object.keys(override).length > 0 && (
                                <button onClick={() => onClear()} className="text-xs text-red-600 hover:underline px-1">مسح التعديل</button>
                            )}
                        </>
                    )}
                    <span className="text-[10px] text-gray-300">#{id}</span>
                </div>

                {/* Edit drawer */}
                {open && onSite && (
                    <div className="mt-2 pt-3 border-t border-gray-100 space-y-3 text-right" dir="rtl">
                        <div className="grid grid-cols-3 gap-2">
                            <label className="flex flex-col gap-1 text-[11px] text-gray-500">الحالة
                                <select value={draftStatus} onChange={e => setDraftStatus(e.target.value)} className={input}>
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </label>
                            <label className="flex flex-col gap-1 text-[11px] text-gray-500">هدف {home.Name || 'يمين'}
                                <input type="number" value={draftHome} onChange={e => setDraftHome(e.target.value)} className={input} placeholder="—" />
                            </label>
                            <label className="flex flex-col gap-1 text-[11px] text-gray-500">هدف {away.Name || 'يسار'}
                                <input type="number" value={draftAway} onChange={e => setDraftAway(e.target.value)} className={input} placeholder="—" />
                            </label>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500">القنوات (اسم · شعار · رابط)</span>
                                <button onClick={addChannel} className="text-xs text-green-700 hover:underline">+ إضافة قناة</button>
                            </div>
                            {channels.length === 0 && <p className="text-[11px] text-gray-400">لا قنوات — أضف واحدة لتظهر على البطاقة.</p>}
                            {channels.map((c, i) => (
                                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center">
                                    <input value={c.name} onChange={e => setChannel(i, 'name', e.target.value)} placeholder="beIN Sports 1" className={`${input} text-xs`} />
                                    <input value={c.logo || ''} onChange={e => setChannel(i, 'logo', e.target.value)} placeholder="Logo URL" dir="ltr" className={`${input} text-xs font-mono`} />
                                    <input value={c.url || ''} onChange={e => setChannel(i, 'url', e.target.value)} placeholder="رابط المشاهدة (اختياري)" dir="ltr" className={`${input} text-xs font-mono`} />
                                    <button onClick={() => removeChannel(i)} className="text-red-600 text-xs px-2">حذف</button>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <button onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded px-4 py-1.5">
                                {saving ? 'جارٍ الحفظ…' : 'حفظ'}
                            </button>
                            <button onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:underline">إلغاء</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminMatchCard;
