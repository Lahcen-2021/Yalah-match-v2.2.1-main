import React, { useEffect, useMemo, useState } from 'react';
import { H2HMatch, Match, MatchStatus } from '../types';
import { translateTeam, translateLeague } from '../utils/translations';
import OptimizedImage from './OptimizedImage';
import { subscribeVotes, castVote, VoteChoice, VoteCounts } from '../services/votes.ts';

/**
 * "سجل المواجهات والتوقعات" — the head-to-head record plus the numbers derived
 * from it. Two views share one card: the meeting log, and a prediction read of
 * the same five results. Everything here is computed from `h2h`; nothing is
 * invented, and with no prior meetings the card says so plainly.
 */

const LAST_N = 5;

const norm = (s: string) =>
    (s || '')
        .toLowerCase()
        .replace(/[ً-ْـ]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const sameTeam = (a: string, b: string) => {
    const x = norm(a);
    const y = norm(b);
    if (!x || !y) return false;
    return x === y || x.includes(y) || y.includes(x);
};

interface Props {
    match: Match;
    h2h: H2HMatch[];
    recentA?: H2HMatch[];
    recentB?: H2HMatch[];
}

const VOTE_KEY = (id: number) => `yalla_vote_${id}`;

const VoteView: React.FC<{ match: Match }> = ({ match }) => {
    const matchId = String(match.id);
    const [counts, setCounts] = useState<VoteCounts>({ a: 0, draw: 0, b: 0 });
    const [myVote, setMyVote] = useState<VoteChoice | null>(() => {
        try { return (localStorage.getItem(VOTE_KEY(match.id)) as VoteChoice) || null; } catch { return null; }
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsub = subscribeVotes(matchId, setCounts);
        return unsub;
    }, [matchId]);

    const total = counts.a + counts.draw + counts.b;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

    const submit = async (choice: VoteChoice) => {
        if (myVote || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await castVote(matchId, choice);
            try { localStorage.setItem(VOTE_KEY(match.id), choice); } catch { /* ignore */ }
            setMyVote(choice);
        } catch {
            setError('تعذّر تسجيل صوتك، حاول مرة أخرى');
        } finally {
            setSubmitting(false);
        }
    };

    // RTL display order: teamB, draw, teamA (matches the reference screenshot).
    const options: { choice: VoteChoice; label: string; logo?: string; bar: string }[] = [
        { choice: 'b', label: translateTeam(match.teamB.name), logo: match.teamB.logoUrl, bar: 'bg-indigo-500' },
        { choice: 'draw', label: 'تعادل', logo: undefined, bar: 'bg-gray-400' },
        { choice: 'a', label: translateTeam(match.teamA.name), logo: match.teamA.logoUrl, bar: 'bg-blue-600' },
    ];

    return (
        <div className="px-4 sm:px-5 pb-5">
            <h4 className="text-gray-800 font-black text-base sm:text-lg mb-4 text-right">صوّت لمن سيفوز</h4>

            {!myVote ? (
                <div className="flex items-stretch justify-center gap-2.5 sm:gap-4">
                    {options.map((o) => (
                        <button
                            key={o.choice}
                            onClick={() => submit(o.choice)}
                            disabled={submitting}
                            className="group flex-1 max-w-[150px] flex flex-col items-center gap-2.5 rounded-2xl border border-gray-100 bg-gray-50/50 p-3 sm:p-4 hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-sm transition-all disabled:opacity-50 active:scale-95"
                        >
                            <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white border border-gray-100 shadow-sm grid place-items-center p-2 group-hover:border-emerald-200 transition-colors">
                                {o.logo ? (
                                    <OptimizedImage src={o.logo} alt={o.label} width={56} className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-gray-400 font-black text-xl leading-none">=</span>
                                )}
                            </span>
                            <span className="text-gray-800 font-black text-[10px] sm:text-xs text-center leading-tight line-clamp-2">{o.label}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {options.map((o) => (
                        <div key={o.choice} className="flex items-center gap-3" dir="rtl">
                            <span className={`w-12 text-left font-black text-sm tabular-nums shrink-0 ${myVote === o.choice ? 'text-emerald-600' : 'text-gray-500'}`} dir="ltr">
                                {pct(counts[o.choice])}%
                            </span>
                            <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                                <div className={`h-full rounded-full ${o.bar} transition-all`} style={{ width: `${pct(counts[o.choice])}%` }} />
                            </div>
                            <span className={`w-24 sm:w-32 font-black text-[11px] sm:text-sm truncate shrink-0 ${myVote === o.choice ? 'text-emerald-700' : 'text-gray-700'}`}>
                                {o.label}
                            </span>
                        </div>
                    ))}
                    <p className="text-gray-400 font-bold text-[10px] text-center pt-1">
                        إجمالي الأصوات: <span className="tabular-nums" dir="ltr">{total}</span>
                    </p>
                </div>
            )}

            {error && <p className="text-red-500 font-bold text-[11px] text-center mt-3">{error}</p>}
        </div>
    );
};

const Crest: React.FC<{ src?: string; alt: string; size?: string }> = ({ src, alt, size = 'w-6 h-6' }) => (
    <span className={`${size} shrink-0 inline-flex items-center justify-center`}>
        <OptimizedImage src={src || null} alt={alt} width={28} className="w-full h-full object-contain" />
    </span>
);

// Map one recent match onto `teamName` and classify the result for that team.
const resultFor = (m: H2HMatch, teamName: string): 'W' | 'D' | 'L' => {
    const isHome = sameTeam(m.homeTeam, teamName);
    const own = isHome ? m.homeScore : m.awayScore;
    const opp = isHome ? m.awayScore : m.homeScore;
    if (own > opp) return 'W';
    if (own < opp) return 'L';
    return 'D';
};
const RESULT_DOT: Record<'W' | 'D' | 'L', string> = {
    W: 'bg-emerald-500', D: 'bg-gray-400', L: 'bg-red-500',
};
const RESULT_PILL: Record<'W' | 'D' | 'L', string> = {
    W: 'bg-emerald-500', D: 'bg-gray-400', L: 'bg-red-500',
};
const RESULT_AR: Record<'W' | 'D' | 'L', string> = { W: 'ف', D: 'ت', L: 'خ' };

const RecentColumn: React.FC<{ teamName: string; teamLogo?: string; matches: H2HMatch[] }> = ({ teamName, teamLogo, matches }) => {
    const last5 = (matches || []).slice(0, 5);
    return (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-3 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Crest src={teamLogo} alt={teamName} size="w-6 h-6" />
                    <span className="font-black text-gray-900 text-xs sm:text-sm truncate">{translateTeam(teamName)}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {last5.map((m, i) => {
                        const r = resultFor(m, teamName);
                        return (
                            <span key={i} className={`w-5 h-5 rounded-md ${RESULT_PILL[r]} text-white font-black text-[9px] grid place-items-center`}>
                                {RESULT_AR[r]}
                            </span>
                        );
                    })}
                </div>
            </div>
            {last5.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white py-6 text-center text-gray-400 font-bold text-[11px]">لا توجد بيانات</div>
            ) : (
                <div className="space-y-2">
                    {last5.map((m, i) => {
                        const r = resultFor(m, teamName);
                        const isHome = sameTeam(m.homeTeam, teamName);
                        const opponent = isHome ? m.awayTeam : m.homeTeam;
                        const oppLogo = isHome ? m.awayLogo : m.homeLogo;
                        return (
                            <div key={`${m.date}-${i}`} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-2.5 py-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${RESULT_DOT[r]}`} />
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Crest src={oppLogo} alt={opponent} size="w-5 h-5" />
                                    <span className="text-gray-700 font-bold text-[11px] truncate">{translateTeam(opponent)}</span>
                                </div>
                                <span className="rounded-lg bg-gray-800 text-white font-black text-[11px] px-2 py-0.5 tabular-nums shrink-0" dir="ltr">
                                    {m.homeScore} - {m.awayScore}
                                </span>
                                <span className="text-gray-400 font-bold text-[9px] shrink-0 hidden sm:inline" dir="ltr">{m.date}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const H2HInsights: React.FC<Props> = ({ match, h2h, recentA = [], recentB = [] }) => {
    const [tab, setTab] = useState<'log' | 'analysis' | 'recent' | 'vote'>('log');

    const data = useMemo(() => {
        const last = (h2h || []).slice(0, LAST_N);
        let winsA = 0;
        let winsB = 0;
        let draws = 0;
        let goalsA = 0;
        let goalsB = 0;
        let over25 = 0;

        for (const m of last) {
            // Each row lists its own home/away, which may be either of our two
            // teams — map the score onto teamA/teamB before counting.
            const aIsHome = sameTeam(m.homeTeam, match.teamA.name);
            const aScore = aIsHome ? m.homeScore : m.awayScore;
            const bScore = aIsHome ? m.awayScore : m.homeScore;
            goalsA += aScore;
            goalsB += bScore;
            if (aScore > bScore) winsA++;
            else if (bScore > aScore) winsB++;
            else draws++;
            if (aScore + bScore > 2.5) over25++;
        }

        const total = last.length;
        const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
        return {
            last,
            total,
            winsA,
            winsB,
            draws,
            pctA: pct(winsA),
            pctB: pct(winsB),
            pctDraw: pct(draws),
            avgGoals: total ? ((goalsA + goalsB) / total).toFixed(1) : '0.0',
            projA: total ? Math.round(goalsA / total) : 0,
            projB: total ? Math.round(goalsB / total) : 0,
            over25Pct: pct(over25),
            totalGoals: goalsA + goalsB,
        };
    }, [h2h, match.teamA.name]);

    return (
        <section className="rounded-[22px] bg-white border border-gray-100 shadow-[0_10px_30px_rgba(15,23,42,0.06)] overflow-hidden">
            {/* Header: title + the two views */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <span className="mt-1 w-1.5 h-8 rounded-full bg-orange-500 shrink-0" />
                    <div>
                        <h3 className="text-gray-900 font-black text-base sm:text-lg leading-tight">سجل المواجهات والتوقعات</h3>
                        <p className="text-gray-400 font-bold text-[10px] sm:text-xs mt-0.5">
                            نتائج اللقاءات المباشرة وتحليلات الأرقام للتوقع
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full p-1 self-start md:self-auto">
                    <button
                        onClick={() => setTab('log')}
                        className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black transition-colors ${
                            tab === 'log' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        سجل المواجهات المباشرة{data.total > 0 ? ` (آخر ${data.total})` : ''}
                    </button>
                    <button
                        onClick={() => setTab('analysis')}
                        className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black transition-colors ${
                            tab === 'analysis' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        تحليل التوقع
                    </button>
                    <button
                        onClick={() => setTab('recent')}
                        className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black transition-colors ${
                            tab === 'recent' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        آخر المباريات
                    </button>
                    {match.status !== MatchStatus.FINISHED && (
                        <button
                            onClick={() => setTab('vote')}
                            className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black transition-colors ${
                                tab === 'vote' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            التصويت
                        </button>
                    )}
                </div>
            </div>

            {tab === 'recent' ? (
                <div className="px-4 sm:px-5 pb-5">
                    <h4 className="text-gray-800 font-black text-sm mb-3">آخر مباريات الفريقين ({translateLeague(match.league)})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <RecentColumn teamName={match.teamA.name} teamLogo={match.teamA.logoUrl} matches={recentA} />
                        <RecentColumn teamName={match.teamB.name} teamLogo={match.teamB.logoUrl} matches={recentB} />
                    </div>
                </div>
            ) : tab === 'vote' && match.status !== MatchStatus.FINISHED ? (
                <VoteView match={match} />
            ) : data.total === 0 ? (
                <div className="px-4 sm:px-5 pb-5">
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 py-8 text-center">
                        <p className="text-gray-500 font-black text-sm">لا توجد مواجهات سابقة بين الفريقين</p>
                        <p className="text-gray-400 font-bold text-[11px] mt-1">أول لقاء مباشر بينهما</p>
                    </div>
                </div>
            ) : tab === 'log' ? (
                <div className="px-4 sm:px-5 pb-5 space-y-3">
                    {/* Wins / draws / wins */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {[
                            { crest: match.teamB.logoUrl, name: translateTeam(match.teamB.name), value: data.winsB, caption: `انتصارات آخر ${data.total} مواجهات` },
                            { crest: undefined, name: 'التعادلات', value: data.draws, caption: `في آخر ${data.total} مباريات` },
                            { crest: match.teamA.logoUrl, name: translateTeam(match.teamA.name), value: data.winsA, caption: `انتصارات آخر ${data.total} مواجهات` },
                        ].map((tile, i) => (
                            <div key={i} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    {tile.crest && <Crest src={tile.crest} alt={tile.name} size="w-5 h-5" />}
                                    <span className="text-gray-800 font-black text-[10px] sm:text-xs truncate">{tile.name}</span>
                                </div>
                                <div className="text-gray-900 font-black text-2xl leading-none tabular-nums">{tile.value}</div>
                                <div className="text-gray-400 font-bold text-[9px] mt-1">{tile.caption}</div>
                            </div>
                        ))}
                    </div>

                    {/* The meetings themselves */}
                    <div className="space-y-2">
                        {data.last.map((m, i) => (
                            <div
                                key={`${m.date}-${i}`}
                                className="flex items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-2.5 hover:border-orange-200 transition-colors"
                            >
                                <div className="min-w-0">
                                    <p className="text-gray-700 font-black text-[10px] sm:text-xs truncate">{translateLeague(m.league)}</p>
                                    <p className="text-gray-400 font-bold text-[9px] sm:text-[10px] mt-0.5" dir="ltr">{m.date}</p>
                                </div>

                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    <span className="hidden sm:inline text-gray-700 font-bold text-[11px] truncate max-w-[110px]">
                                        {translateTeam(m.homeTeam)}
                                    </span>
                                    <Crest src={m.homeLogo} alt={m.homeTeam} size="w-5 h-5" />
                                    <span className="rounded-lg bg-orange-500 text-white font-black text-xs px-2.5 py-1 tabular-nums" dir="ltr">
                                        {m.homeScore} - {m.awayScore}
                                    </span>
                                    <Crest src={m.awayLogo} alt={m.awayTeam} size="w-5 h-5" />
                                    <span className="hidden sm:inline text-gray-700 font-bold text-[11px] truncate max-w-[110px]">
                                        {translateTeam(m.awayTeam)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="px-4 sm:px-5 pb-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-800 font-black text-[11px] sm:text-sm">
                            مؤشرات فرص الفوز والتعادل (بناءً على المواجهات المباشرة)
                        </span>
                        <span className="rounded-full bg-orange-50 border border-orange-100 text-orange-600 font-black text-[9px] sm:text-[10px] px-2 py-1">
                            توقع احتمالي
                        </span>
                    </div>

                    {/* One bar, three shares — the split is the story */}
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100" dir="ltr">
                        <div className="bg-blue-600" style={{ width: `${data.pctA}%` }} />
                        <div className="bg-gray-300" style={{ width: `${data.pctDraw}%` }} />
                        <div className="bg-indigo-500" style={{ width: `${data.pctB}%` }} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {[
                            { label: translateTeam(match.teamB.name), value: data.pctB, tone: 'text-indigo-600' },
                            { label: 'تعادل', value: data.pctDraw, tone: 'text-gray-500' },
                            { label: translateTeam(match.teamA.name), value: data.pctA, tone: 'text-blue-600' },
                        ].map((t, i) => (
                            <div key={i} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 text-center">
                                <div className="text-gray-500 font-bold text-[10px] truncate">{t.label}</div>
                                <div className={`font-black text-lg mt-0.5 ${t.tone}`}>{t.value}%</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 text-center">
                            <div className="text-gray-400 font-bold text-[9px] sm:text-[10px]">النتيجة المتوقعة</div>
                            <div className="mt-1 inline-block rounded-lg bg-orange-500 text-white font-black text-sm px-2.5 py-1 tabular-nums" dir="ltr">
                                {data.projA} - {data.projB}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 text-center">
                            <div className="text-gray-400 font-bold text-[9px] sm:text-[10px]">معدل الأهداف المتوقع</div>
                            <div className="text-gray-900 font-black text-lg mt-1 tabular-nums">{data.avgGoals}</div>
                            <div className="text-gray-400 font-bold text-[9px]">هدف/مباراة</div>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 text-center">
                            <div className="text-gray-400 font-bold text-[9px] sm:text-[10px]">احتمالية أكثر من 2.5 أهداف</div>
                            <div className="text-emerald-600 font-black text-lg mt-1 tabular-nums">{data.over25Pct}%</div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 flex items-start gap-2">
                        <span className="text-base leading-none">💡</span>
                        <p className="text-[10px] sm:text-xs font-bold text-gray-700 leading-relaxed">
                            <span className="text-gray-500">ملخص تحليل المواجهات: </span>
                            تُظهر نتائج آخر {data.total} مواجهات مباشرة تسجيل إجمالي{' '}
                            <span className="text-gray-900 font-black">{data.totalGoals}</span> أهداف
                            {data.winsA !== data.winsB && (
                                <>
                                    ، مع رجحان كفة{' '}
                                    <span className="text-gray-900 font-black">
                                        {translateTeam(data.winsA > data.winsB ? match.teamA.name : match.teamB.name)}
                                    </span>{' '}
                                    بـ <span className="text-gray-900 font-black">{Math.max(data.winsA, data.winsB)}</span> انتصارات
                                </>
                            )}
                            {data.winsA === data.winsB && <> ، مع تعادل الكفتين في الانتصارات</>}.
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
};

export default React.memo(H2HInsights);
