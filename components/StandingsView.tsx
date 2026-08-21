
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchYanb8Leagues, Yanb8League, fetchYanb8Standings, fetchLeagueTopScorers, fetchLeagueAssists, fetchLeagueMatchList, fetchCompetitionBracket, USER_TIMEZONE } from '../services/api';
import { fetchLeagueStandings, LEAGUES as ESPN_LEAGUES } from '../services/espnService';
import { translateLeague, translateTeam } from '../utils/translations';
import OptimizedImage from './OptimizedImage';
import { StandingGroup, Scorer, Standing, CompetitionBracket, BracketTie, BracketStage, LeagueMatch, Match, MatchStatus } from '../types';
import { useCache } from '../context/CacheContext';
import U17AfconStandings from './U17AfconStandings';

interface StandingsViewProps {
    initialLeagueId?: string | null;
    onMatchClick?: (match: any) => void;
    onBackToTournaments?: () => void;
}

type TabType = 'standings' | 'scorers' | 'assists' | 'upcoming' | 'finished';
type SortDirection = 'asc' | 'desc';
interface SortConfig {
    key: string;
    direction: SortDirection;
}

const TEAM_CREST = (id: number) => `https://imagecache.365scores.com/image/upload/f_png,w_100,h_100,c_limit,q_auto:eco/competitors/${id}`;

const StandingsSkeleton: React.FC = () => (
    <div className="space-y-4 animate-fadeIn">
        <div className="h-14 bg-gray-100 rounded-2xl animate-shimmer"></div>
        <div className="space-y-3">
            {[...Array(12)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-50 rounded-2xl animate-shimmer" style={{ animationDelay: `${i * 0.05}s` }}></div>
            ))}
        </div>
    </div>
);

const SortIcon = ({ direction }: { direction: SortDirection }) => (
    <svg className={`w-3 h-3 text-[#00bfa5] transform transition-transform duration-200 inline-block ${direction === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
    </svg>
);

// Arabic group-name normalization for group titles coming from ESPN ("Group A") or 365scores.
const localizeGroupName = (name: string) => name.replace('Group', 'المجموعة').replace('Table', 'جدول');

/* ------------------------------------------------------------------ */
/*  Knockout bracket                                                    */
/* ------------------------------------------------------------------ */

// Detailed gold championship trophy (self-contained SVG, gradient-shaded) used at
// the center of the knockout bracket instead of a flat line icon.
const GoldTrophy: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
            <linearGradient id="goldCup" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFF3B0" />
                <stop offset="0.45" stopColor="#F5C531" />
                <stop offset="1" stopColor="#B8860B" />
            </linearGradient>
            <linearGradient id="goldBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E8B923" />
                <stop offset="1" stopColor="#9C6A0A" />
            </linearGradient>
        </defs>
        {/* Side handles */}
        <path d="M15 14 H9 a7 7 0 0 0 7 12" fill="none" stroke="url(#goldCup)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M49 14 H55 a7 7 0 0 1 -7 12" fill="none" stroke="url(#goldCup)" strokeWidth="3.5" strokeLinecap="round" />
        {/* Cup bowl */}
        <path d="M16 10 H48 V22 a16 16 0 0 1 -32 0 Z" fill="url(#goldCup)" />
        {/* Bowl highlight */}
        <path d="M21 13 v7 a11 11 0 0 0 5 9 a15 15 0 0 1 -5 -10 Z" fill="#FFFFFF" opacity="0.35" />
        {/* Stem */}
        <rect x="29.5" y="37" width="5" height="8" fill="url(#goldBase)" />
        {/* Base tiers */}
        <rect x="23" y="45" width="18" height="4" rx="1.5" fill="url(#goldBase)" />
        <rect x="19" y="49" width="26" height="5" rx="2" fill="url(#goldBase)" />
    </svg>
);

// The competition's own cup/logo image at the top of the bracket (World Cup shows the
// World Cup cup, Champions League its trophy, …). Falls back to the gold trophy SVG when
// the competition has no logo or the image fails to load.
const CompetitionCup: React.FC<{ logoUrl?: string; className?: string }> = ({ logoUrl, className }) => (
    logoUrl
        ? <OptimizedImage src={logoUrl} alt="" width={128} className={`${className ?? ''} object-contain drop-shadow-md`} fallbackElement={<GoldTrophy className={className} />} />
        : <GoldTrophy className={className} />
);

// A tie's kick-off, formatted in the user's timezone → { time: "20:00", date: "19.07.2026" }.
const formatTieDateTime = (iso: string | null): { time: string; date: string } | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: USER_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    const date = new Intl.DateTimeFormat('en-GB', { timeZone: USER_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d).replace(/\//g, '.');
    return { time, date };
};

// Arabic "5 يوليو" round-date shown next to each round label (like the broadcast graphics).
const formatArabicDay = (iso: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('ar-EG', { timeZone: USER_TIMEZONE, day: 'numeric', month: 'long' }).format(d);
};

// Earliest kick-off across a stage's ties → the round's headline date.
const stageDate = (s: BracketStage): string | null => {
    const times = s.ties.map(t => t.startTime).filter(Boolean).map(x => new Date(x as string).getTime()).filter(n => !isNaN(n));
    return times.length ? formatArabicDay(new Date(Math.min(...times)).toISOString()) : null;
};

// One competitor pill inside a tie card: crest + name + score, winner in gold.
const TieSide: React.FC<{ side: BracketTie['home']; big?: boolean }> = ({ side, big }) => {
    const crest = big ? 26 : 20;
    return (
        <div className="flex items-center justify-between gap-1.5 px-2 py-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
                {side && side.id > 0 ? (
                    <span className={`grid place-items-center rounded-md overflow-hidden bg-white/95 shrink-0 shadow-sm ${big ? 'w-7 h-5' : 'w-6 h-[15px]'}`}>
                        <OptimizedImage src={TEAM_CREST(side.id)} alt={side.name} width={crest} className="w-full h-full object-cover" />
                    </span>
                ) : (
                    <span className={`rounded-md bg-white/10 shrink-0 ${big ? 'w-7 h-5' : 'w-6 h-[15px]'}`}></span>
                )}
                <span className={`truncate ${big ? 'text-sm' : 'text-[11px]'} ${side?.winner ? 'font-black text-amber-300' : 'font-bold text-slate-200/90'}`}>
                    {side?.name ? translateTeam(side.name) : '—'}
                </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {side?.penalties != null && <span className="text-[9px] font-bold text-slate-400">({side.penalties})</span>}
                {side?.score != null && (
                    <span className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded text-[11px] font-black ${
                        side?.winner ? 'bg-amber-400 text-slate-900' : 'bg-white/10 text-slate-300'
                    }`}>{side.score}</span>
                )}
            </div>
        </div>
    );
};

const TieCard: React.FC<{ tie: BracketTie; big?: boolean; fullWidth?: boolean }> = ({ tie, big, fullWidth }) => {
    const dt = formatTieDateTime(tie.startTime);
    return (
        <div className={`relative rounded-xl overflow-hidden bg-white/[0.06] border transition-colors ${
            tie.live ? 'border-red-400/60' : 'border-white/10 hover:border-amber-300/40'
        } ${fullWidth ? 'w-full' : big ? 'w-60' : 'w-40'} backdrop-blur-sm shadow-lg shadow-black/20`}>
            {tie.live && (
                <span className="absolute top-1 left-1 flex items-center gap-1 z-10">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-[8px] font-black text-red-400">مباشر</span>
                </span>
            )}
            <div className="divide-y divide-white/10">
                <TieSide side={tie.home} big={big} />
                <TieSide side={tie.away} big={big} />
            </div>
            {dt && (big || fullWidth) && (
                <div className="text-center px-2 py-1 bg-black/20 border-t border-white/10 text-[9px] font-bold text-slate-400" dir="ltr">
                    {dt.date} · {dt.time}
                </div>
            )}
        </div>
    );
};

// Bracket connector elbows between two rounds. `feed` is the direction the winners
// advance: 'in-left' (matches on the right, bar on the left toward centre) or
// 'in-right' (matches on the left, bar on the right). Geometry aligns with the
// round columns' justify-around spacing, so elbows meet each flag row precisely.
const Connector: React.FC<{ count: number; feed: 'in-left' | 'in-right'; labelH: string }> = ({ count, feed, labelH }) => (
    <div className="hidden md:flex flex-col shrink-0 w-6">
        <div className={labelH} />
        <div className="flex-1 flex flex-col">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="relative flex-1">
                    <div className="absolute inset-x-0 top-1/4 border-t border-amber-300/40" />
                    <div className="absolute inset-x-0 top-3/4 border-t border-amber-300/40" />
                    <div className={`absolute top-1/4 bottom-1/4 border-l border-amber-300/40 ${feed === 'in-left' ? 'left-0' : 'right-0'}`} />
                    <div className={`absolute top-1/2 w-1/2 border-t border-amber-300/40 ${feed === 'in-left' ? 'left-0' : 'right-0'}`} />
                </div>
            ))}
        </div>
    </div>
);

// One round of the tree: gold label + date, then evenly-spaced tie cards.
const RoundCol: React.FC<{ name: string; date?: string | null; ties: BracketTie[]; labelH: string }> = ({ name, date, ties, labelH }) => (
    <div className="flex flex-col shrink-0">
        <div className={`${labelH} flex flex-col items-center justify-center`}>
            <span className="text-[11px] font-black text-amber-300 whitespace-nowrap">{name}</span>
            {date && <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{date}</span>}
        </div>
        <div className="flex-1 flex flex-col justify-around">
            {ties.map((tie, i) => <TieCard key={i} tie={tie} />)}
        </div>
    </div>
);

// Mobile bracket: one round at a time behind scrollable stage pills.
const KnockoutBracketMobile: React.FC<{ bracket: CompetitionBracket; logoUrl?: string }> = ({ bracket, logoUrl }) => {
    const stages = bracket.stages;
    const [activeNum, setActiveNum] = useState<number>(() => {
        const current = stages.find(s => s.isCurrent) || stages[0];
        return current?.num ?? 0;
    });
    const stage = stages.find(s => s.num === activeNum) || stages[0];
    if (!stage) return null;
    const date = stageDate(stage);

    return (
        <div>
            <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 mb-4 pb-1">
                {stages.map(s => (
                    <button
                        key={s.num}
                        onClick={() => setActiveNum(s.num)}
                        className={`px-3 py-1.5 text-[10px] sm:text-xs font-black rounded-full whitespace-nowrap flex-shrink-0 transition-all ${
                            s.num === stage.num
                            ? 'bg-amber-400 text-slate-900 shadow-md'
                            : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                        }`}
                    >
                        {s.name}
                    </button>
                ))}
            </div>
            <div className="flex flex-col items-center mb-3">
                {stage.isFinal && <CompetitionCup logoUrl={logoUrl} className="w-14 h-14 mb-1" />}
                {date && <span className="text-[10px] font-bold text-slate-400">{date}</span>}
            </div>
            <div className="space-y-3">
                {stage.ties.map((tie, i) => (
                    <div key={i}>
                        {stage.isFinal && stage.ties.length > 1 && (
                            <div className="text-center text-[10px] font-black text-amber-300 mb-1.5">
                                {i === 0 ? stage.name : 'تحديد المركز الثالث'}
                            </div>
                        )}
                        <TieCard tie={tie} fullWidth />
                    </div>
                ))}
            </div>
        </div>
    );
};

const KnockoutBracket: React.FC<{ bracket: CompetitionBracket; logoUrl?: string }> = ({ bracket, logoUrl }) => {
    const LABEL_H = 'h-12'; // shared header height so both halves + connectors align

    // Final (and any single-tie stage) sit in the centre; multi-tie rounds split in
    // half and mirror on both sides so the tree reads outside-in toward the trophy.
    const centerStages: BracketStage[] = [];
    const sideStages: BracketStage[] = [];
    bracket.stages.forEach(s => ((s.isFinal || s.ties.length <= 1) ? centerStages : sideStages).push(s));

    // Physical left→centre order: earliest round outermost. Right side mirrors it.
    const leftHalf = sideStages.map(s => ({ name: s.name, date: stageDate(s), ties: s.ties.slice(0, Math.ceil(s.ties.length / 2)) }));
    const rightHalf = sideStages.map(s => ({ name: s.name, date: stageDate(s), ties: s.ties.slice(Math.ceil(s.ties.length / 2)) }));

    const finalStage = centerStages.find(s => s.isFinal) || centerStages[0];
    const thirdPlace = finalStage?.ties.slice(1) || [];
    const otherCenter = centerStages.filter(s => s !== finalStage);

    // Champion = the winning side of the final, shown in the trophy slot.
    const champion = finalStage && finalStage.ties[0]
        ? [finalStage.ties[0].home, finalStage.ties[0].away].find(s => s?.winner) || null
        : null;

    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-1.5 h-6 bg-amber-400 rounded-full"></div>
                <h4 className="text-gray-900 font-black text-lg">الطريق إلى النهائي</h4>
            </div>

            {/* Premium dark tree container (both mobile + desktop live inside it) */}
            <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-xl"
                 style={{ background: 'radial-gradient(1200px 500px at 50% -10%, #16346e 0%, transparent 60%), linear-gradient(160deg, #0b1c44 0%, #0a1636 55%, #081026 100%)' }}>
                {/* soft glows */}
                <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-amber-400/10 blur-3xl" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 44px)' }} />

                <div className="relative p-3 sm:p-5">
                    {/* Header banner */}
                    <div className="flex flex-col items-center text-center mb-4">
                        <div className="flex items-center gap-2 text-amber-300">
                            <span className="text-amber-400">✦</span>
                            <span className="text-sm sm:text-lg font-black tracking-wide">الطريق إلى النهائي</span>
                            <span className="text-amber-400">✦</span>
                        </div>
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden">
                        <KnockoutBracketMobile bracket={bracket} logoUrl={logoUrl} />
                    </div>

                    {/* Desktop two-sided tree, dir=ltr so elbows/borders stay physical while
                        Arabic labels inside each cell still render RTL. */}
                    <div className="hidden md:block overflow-x-auto no-scrollbar" dir="ltr">
                        <div className="flex items-stretch justify-center gap-0 min-w-max w-fit mx-auto min-h-[520px]">
                            {/* LEFT half feeds toward centre (bar on the right of each connector) */}
                            {leftHalf.map((col, i) => (
                                <React.Fragment key={`l-${i}`}>
                                    <RoundCol name={col.name} date={col.date} ties={col.ties} labelH={LABEL_H} />
                                    <Connector count={leftHalf[i + 1]?.ties.length ?? 1} feed="in-right" labelH={LABEL_H} />
                                </React.Fragment>
                            ))}

                            {/* Centre: champion + trophy + final + third place */}
                            <div className="flex flex-col items-center justify-center shrink-0 px-3 gap-3">
                                <div className={`flex flex-col items-center rounded-2xl px-5 py-3 border ${champion ? 'border-amber-300/50 bg-amber-400/10' : 'border-white/10 bg-white/5'}`}>
                                    {champion && champion.id > 0 && (
                                        <span className="w-12 h-8 rounded-md overflow-hidden bg-white/95 shadow mb-1">
                                            <OptimizedImage src={TEAM_CREST(champion.id)} alt={champion.name} width={48} className="w-full h-full object-cover" />
                                        </span>
                                    )}
                                    <span className="text-[11px] font-black text-amber-300">{champion ? translateTeam(champion.name) : 'البطل'}</span>
                                    {champion && <span className="text-[9px] font-black text-amber-400/80 tracking-widest">WIN</span>}
                                </div>

                                <CompetitionCup logoUrl={logoUrl} className="w-20 h-20 sm:w-24 sm:h-24" />

                                {finalStage && finalStage.ties[0] && (
                                    <div className="w-full">
                                        <div className="text-center text-[11px] font-black text-amber-300 mb-2">{finalStage.name}</div>
                                        <TieCard tie={finalStage.ties[0]} big />
                                    </div>
                                )}

                                {thirdPlace.map((tie, i) => (
                                    <div key={i} className="w-full">
                                        <div className="text-center text-[10px] font-black text-slate-400 mb-1.5">المركز الثالث</div>
                                        <TieCard tie={tie} />
                                    </div>
                                ))}
                                {otherCenter.map((s, si) => (
                                    <div key={si} className="w-full">
                                        <div className="text-center text-[10px] font-black text-slate-400 mb-1.5">{s.name}</div>
                                        {s.ties.map((tie, i) => <TieCard key={i} tie={tie} />)}
                                    </div>
                                ))}
                            </div>

                            {/* RIGHT half mirrors the left (bar on the left of each connector) */}
                            {[...rightHalf].reverse().map((col, i, arr) => (
                                <React.Fragment key={`r-${i}`}>
                                    <Connector count={arr[i - 1]?.ties.length ?? col.ties.length} feed="in-left" labelH={LABEL_H} />
                                    <RoundCol name={col.name} date={col.date} ties={col.ties} labelH={LABEL_H} />
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Standings tables                                                    */
/* ------------------------------------------------------------------ */

const StandingRow: React.FC<{ row: Standing; qualifies: boolean; groupLabel?: string; compact?: boolean }> = ({ row, qualifies, groupLabel, compact }) => (
    <tr className="group hover:bg-emerald-50/40 transition-colors">
        <td className="px-2 py-2.5 text-center">
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black ${qualifies ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {row.position}
            </span>
        </td>
        <td className="px-2 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 flex-shrink-0 bg-white rounded-full overflow-hidden border border-gray-200 p-0.5">
                    <OptimizedImage src={row.team.crest} alt={row.team.name} width={22} className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0">
                    <span className="block font-bold text-gray-900 text-xs truncate group-hover:text-emerald-700 transition-colors">{translateTeam(row.team.name)}</span>
                    {groupLabel && <span className="block text-[9px] text-gray-400 font-bold leading-tight">{groupLabel}</span>}
                </div>
            </div>
        </td>
        <td className="px-1.5 py-2.5 text-center font-bold text-gray-700 text-xs">{row.playedGames}</td>
        <td className="px-1.5 py-2.5 text-center font-bold text-emerald-600 text-xs">{row.won}</td>
        <td className="px-1.5 py-2.5 text-center font-bold text-gray-400 text-xs">{row.draw}</td>
        <td className="px-1.5 py-2.5 text-center font-bold text-red-500 text-xs">{row.lost}</td>
        <td className={`px-1.5 py-2.5 text-center font-bold text-gray-500 text-xs ${compact ? 'hidden sm:table-cell' : ''}`}>{row.goalsFor}</td>
        <td className={`px-1.5 py-2.5 text-center font-bold text-gray-500 text-xs ${compact ? 'hidden sm:table-cell' : ''}`}>{row.goalsAgainst}</td>
        <td className="px-1.5 py-2.5 text-center font-bold text-gray-600 text-xs" dir="ltr">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
        <td className="px-2 py-2.5 text-center font-black text-gray-900 text-sm">{row.points}</td>
    </tr>
);

const TABLE_HEADERS: { key: string; label: string; compactHide?: boolean }[] = [
    { key: 'position', label: 'م' },
    { key: 'team', label: 'الفريق' },
    { key: 'playedGames', label: 'لعب' },
    { key: 'won', label: 'فاز' },
    { key: 'draw', label: 'تعادل' },
    { key: 'lost', label: 'خسر' },
    { key: 'goalsFor', label: 'له', compactHide: true },
    { key: 'goalsAgainst', label: 'عليه', compactHide: true },
    { key: 'goalDifference', label: '+/-' },
    { key: 'points', label: 'نقاط' },
];

const StandingsView: React.FC<StandingsViewProps> = ({ initialLeagueId, onMatchClick, onBackToTournaments }) => {
    const { fetchWithCache } = useCache();
    const [selectedLeague, setSelectedLeague] = useState<Yanb8League | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('standings');
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

    // Data States
    const [standingGroups, setStandingGroups] = useState<StandingGroup[]>([]);
    const [bracket, setBracket] = useState<CompetitionBracket | null>(null);
    const [scorers, setScorers] = useState<Scorer[]>([]);
    const [assists, setAssists] = useState<Scorer[]>([]);
    const [leagueMatches, setLeagueMatches] = useState<LeagueMatch[]>([]);

    // Loading States
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mapEspnToStandings = (data: any): StandingGroup[] => {
        const children = Array.isArray(data?.children) ? data.children : [];
        return children.map((group: any) => {
            const entries = Array.isArray(group?.standings?.entries) ? group.standings.entries : [];
            const standings: Standing[] = entries.map((entry: any, index: number) => {
                const stats = Array.isArray(entry.stats) ? entry.stats : [];
                const getStat = (name: string) => stats.find((s: any) => s.name === name)?.value || 0;
                return {
                    position: getStat('rank') || index + 1,
                    team: {
                        id: entry.team?.id,
                        name: entry.team?.displayName || '',
                        crest: entry.team?.logos?.[0]?.href || ''
                    },
                    playedGames: getStat('gamesPlayed'),
                    form: null,
                    won: getStat('wins'),
                    draw: getStat('ties'),
                    lost: getStat('losses'),
                    points: getStat('points'),
                    goalsFor: getStat('goalsFor'),
                    goalsAgainst: getStat('goalsAgainst'),
                    goalDifference: getStat('pointDifferential')
                };
            });
            // ESPN returns entries alphabetically; order the table by rank.
            standings.sort((a, b) => a.position - b.position);
            return { name: children.length > 1 ? (group.name || '') : 'الترتيب', standings };
        }).filter((g: StandingGroup) => g.standings.length > 0);
    };

    const fetchDataForTab = useCallback(async (tab: TabType, leagueId: string) => {
        setLoadingData(true);
        setError(null);
        try {
            // Use 5 minute cache for league data
            const TTL = 300000;

            if (tab === 'standings') {
                // Standings and knockout bracket load in parallel; the bracket resolves
                // to null for plain leagues, which selects the classic table layout.
                const bracketPromise = fetchWithCache(`bracket-${leagueId}`, () => fetchCompetitionBracket(leagueId), TTL).catch(() => null);

                const espnLeague = ESPN_LEAGUES.find(l => l.id === leagueId);
                let groups: StandingGroup[] = [];
                if (espnLeague) {
                    const data = await fetchWithCache(`standings-espn-${leagueId}`, () => fetchLeagueStandings(leagueId), TTL);
                    if (data) groups = mapEspnToStandings(data);
                } else {
                    groups = await fetchWithCache(`standings-${leagueId}`, () => fetchYanb8Standings(leagueId), TTL);
                }
                const bracketData = await bracketPromise;

                setStandingGroups(groups);
                setBracket(bracketData);
                if (groups.length === 0 && !bracketData) setError('لا يوجد جدول ترتيب متاح');
            } else if (tab === 'scorers') {
                const data = await fetchWithCache(`scorers-${leagueId}`, () => fetchLeagueTopScorers(leagueId), TTL);
                setScorers(data);
                if (data.length === 0) setError('لا توجد قائمة هدافين متاحة');
            } else if (tab === 'assists') {
                const data = await fetchWithCache(`assists-${leagueId}`, () => fetchLeagueAssists(leagueId), TTL);
                setAssists(data);
                if (data.length === 0) setError('لا توجد قائمة صناع اللعب متاحة');
            } else if (tab === 'upcoming' || tab === 'finished') {
                // Both match tabs share one fetch; they just filter it differently.
                const data = await fetchWithCache(`matches-${leagueId}`, () => fetchLeagueMatchList(leagueId), 120000);
                setLeagueMatches(data);
                const relevant = data.filter(m => tab === 'upcoming' ? m.state !== 'finished' : m.state === 'finished');
                if (relevant.length === 0) setError(tab === 'upcoming' ? 'لا توجد مباريات قادمة' : 'لا توجد مباريات منتهية');
            }
        } catch (err) {
            setError('حدث خطأ أثناء جلب البيانات');
        } finally {
            setLoadingData(false);
        }
    }, [fetchWithCache]);

    const handleSelectLeague = useCallback((league: Yanb8League) => {
        setSelectedLeague(league);
        setActiveTab('standings');
        setSortConfig(null);
        fetchDataForTab('standings', league.id);
    }, [fetchDataForTab]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Cache league list for 24 hours as it doesn't change often
                const data = await fetchWithCache('yanb8-leagues', fetchYanb8Leagues, 86400000);

                // Add ESPN leagues if not present
                const allLeagues = [...data];
                ESPN_LEAGUES.forEach(espnLeague => {
                    if (!allLeagues.find(l => l.id === espnLeague.id)) {
                        allLeagues.push({
                            id: espnLeague.id,
                            name: espnLeague.name,
                            logoUrl: '',
                            url: ''
                        });
                    }
                });

                let defaultLeague: Yanb8League | undefined;

                if (initialLeagueId) {
                     defaultLeague = allLeagues.find(l => l.id === initialLeagueId);
                }

                if (!defaultLeague) {
                    // The list is ordered with currently/recently played competitions first,
                    // so the top entry is the most relevant default.
                    defaultLeague = allLeagues[0];
                }

                if (defaultLeague) {
                    handleSelectLeague(defaultLeague);
                }
            } catch (err) {
                setError('فشل تحميل قائمة الدوريات');
            }
        };
        loadInitialData().catch(() => {});
    }, [initialLeagueId, fetchWithCache, handleSelectLeague]);

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        if (selectedLeague) {
            fetchDataForTab(tab, selectedLeague.id).catch(() => {});
        }
    };

    const handleSort = (key: string) => {
        let direction: SortDirection = 'desc';

        if (key === 'position' || key === 'team' || key === 'lost' || key === 'goalsAgainst') {
            direction = 'asc';
        }

        if (sortConfig && sortConfig.key === key) {
            direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
        }
        setSortConfig({ key, direction });
    };

    // A competition is treated as a cup/tournament when it has a knockout bracket
    // or its standings come in several groups (group stage) — anything else is a league.
    const isCupCompetition = !!bracket || standingGroups.length > 1;

    const sortedStandingGroups = useMemo(() => {
        if (!sortConfig || isCupCompetition) return standingGroups;

        return standingGroups.map(group => ({
            ...group,
            standings: [...group.standings].sort((a, b) => {
                let aVal: any = a[sortConfig.key as keyof typeof a];
                let bVal: any = b[sortConfig.key as keyof typeof b];

                if (sortConfig.key === 'team') {
                    aVal = a.team.name;
                    bVal = b.team.name;
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            })
        }));
    }, [standingGroups, sortConfig, isCupCompetition]);

    // Ranking of third-placed teams across groups (best-thirds qualification),
    // shown only for tournaments with 4+ groups where it is meaningful.
    const thirdPlaceStandings = useMemo(() => {
        if (!isCupCompetition || standingGroups.length < 4) return [];
        const thirds: { row: Standing; group: string }[] = [];
        standingGroups.forEach(group => {
            const third = [...group.standings].sort((a, b) => a.position - b.position)[2];
            if (third) thirds.push({ row: third, group: localizeGroupName(group.name) });
        });
        return thirds.sort((a, b) =>
            b.row.points - a.row.points ||
            b.row.goalDifference - a.row.goalDifference ||
            b.row.goalsFor - a.row.goalsFor
        ).map((t, i) => ({ ...t, rank: i + 1 }));
    }, [standingGroups, isCupCompetition]);

    // How many best-thirds advance: 8 in a 12-group World Cup format, 4 otherwise.
    const thirdsQualifyCount = standingGroups.length >= 12 ? 8 : 4;

    // Shared player-ranking table for both top scorers and top assist providers.
    const renderPlayerStatTable = (list: Scorer[], valueLabel: string) => (
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 animate-fadeInUp">
             <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead>
                        <tr className="text-[11px] font-black text-gray-500 bg-gray-50 border-b border-gray-100">
                            <th className="px-3 py-3 text-center w-12">#</th>
                            <th className="px-3 py-3">اللاعب</th>
                            <th className="px-3 py-3">الفريق</th>
                            <th className="px-3 py-3 text-center">{valueLabel}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {list.map((scorer) => (
                            <tr key={`${scorer.player.id}-${scorer.rank}`} className="group hover:bg-gray-50 transition-colors">
                                <td className="px-3 py-2 text-center">
                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-black ${scorer.rank <= 3 ? 'bg-[#00bfa5] text-white' : 'text-gray-500 bg-gray-100'}`}>
                                        {scorer.rank}
                                    </span>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                         <div className="w-7 h-7 flex-shrink-0 rounded-full bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center">
                                            <OptimizedImage
                                                src={scorer.player.imageUrl || ''}
                                                alt={scorer.player.name}
                                                width={28}
                                                className="w-full h-full object-cover"
                                                fallbackElement={<span className="text-[11px] font-black text-gray-400 uppercase">{scorer.player.name?.trim().charAt(0) || '?'}</span>}
                                            />
                                         </div>
                                         <span className="font-bold text-gray-800 text-xs">{scorer.player.name}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-1">
                                         <OptimizedImage src={scorer.team.logoUrl} alt={scorer.team.name} width={16} className="w-4 h-4 object-contain" />
                                         <span className="text-gray-600 text-[10px] font-bold">{translateTeam(scorer.team.name)}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                    <span className="font-black text-sm text-gray-900">{scorer.goals}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // LeagueMatch (this tab's shape) → Match (what onMatchClick / the detail view expect).
    const leagueMatchToMatch = (m: LeagueMatch): Match => ({
        id: m.id,
        channel: '',
        league: translateLeague(selectedLeague?.name || ''),
        leagueCode: '',
        teamA: { name: m.home.name, logoUrl: TEAM_CREST(m.home.id) },
        teamB: { name: m.away.name, logoUrl: TEAM_CREST(m.away.id) },
        scoreA: m.homeScore ?? 0,
        scoreB: m.awayScore ?? 0,
        status: m.state === 'finished' ? MatchStatus.FINISHED : m.state === 'live' ? MatchStatus.LIVE : MatchStatus.UPCOMING,
        statusText: m.statusText,
        utcDate: m.startTime || new Date().toISOString(),
        round: m.round,
    });

    // Fixture list for the upcoming/finished tabs. `finished` toggles score vs kickoff display.
    const renderMatchList = (finished: boolean) => {
        const list = leagueMatches
            .filter(m => finished ? m.state === 'finished' : m.state !== 'finished')
            .sort((a, b) => {
                const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
                const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
                return finished ? tb - ta : ta - tb; // finished: newest first; upcoming: soonest first
            });
        return (
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 divide-y divide-gray-50 animate-fadeInUp">
                {list.map((m) => {
                    const dt = formatTieDateTime(m.startTime);
                    return (
                        <div
                            key={m.id}
                            onClick={onMatchClick ? () => onMatchClick(leagueMatchToMatch(m)) : undefined}
                            className={`flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors ${onMatchClick ? 'cursor-pointer' : ''}`}
                        >
                            {/* Home */}
                            <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                                <span className="font-bold text-gray-800 text-xs sm:text-sm truncate text-left">{translateTeam(m.home.name)}</span>
                                <OptimizedImage src={TEAM_CREST(m.home.id)} alt={m.home.name} width={24} className="w-6 h-6 object-contain flex-shrink-0" />
                            </div>
                            {/* Score / time */}
                            <div className="flex-shrink-0 text-center min-w-[64px]">
                                {m.state === 'finished' && m.homeScore != null ? (
                                    <span className="inline-block font-black text-gray-900 text-sm bg-gray-100 rounded-lg px-2.5 py-1" dir="ltr">
                                        {m.homeScore} - {m.awayScore}
                                    </span>
                                ) : m.state === 'live' ? (
                                    <span className="inline-flex items-center gap-1 font-black text-red-500 text-sm" dir="ltr">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                        {m.homeScore != null ? `${m.homeScore} - ${m.awayScore}` : 'مباشر'}
                                    </span>
                                ) : (
                                    <span className="inline-block font-black text-emerald-600 text-sm" dir="ltr">{dt?.time || '—'}</span>
                                )}
                                {dt && <span className="block text-[9px] font-bold text-gray-400 mt-0.5" dir="ltr">{dt.date}</span>}
                            </div>
                            {/* Away */}
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                                <OptimizedImage src={TEAM_CREST(m.away.id)} alt={m.away.name} width={24} className="w-6 h-6 object-contain flex-shrink-0" />
                                <span className="font-bold text-gray-800 text-xs sm:text-sm truncate">{translateTeam(m.away.name)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderTableHead = (sortable: boolean, compact: boolean) => (
        <thead>
            <tr className="text-[10px] sm:text-[11px] font-black text-gray-500 bg-gray-50/80 border-b border-gray-200">
                {TABLE_HEADERS.map(h => (
                    <th
                        key={h.key}
                        onClick={sortable ? () => handleSort(h.key) : undefined}
                        className={`px-1.5 py-3 whitespace-nowrap ${h.key === 'team' ? 'text-right px-2 w-full' : 'text-center'} ${h.compactHide && compact ? 'hidden sm:table-cell' : ''} ${sortable ? 'cursor-pointer hover:text-emerald-600 select-none transition-colors' : ''}`}
                    >
                        <span>{h.label}</span>
                        {sortable && sortConfig?.key === h.key && <SortIcon direction={sortConfig.direction} />}
                    </th>
                ))}
            </tr>
        </thead>
    );

    // Classic single-table layout for league competitions.
    const renderLeagueTable = () => (
        <div className="space-y-8 animate-fadeInUp">
            {sortedStandingGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="bg-white sm:rounded-2xl overflow-hidden sm:shadow-sm border-y sm:border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            {renderTableHead(true, true)}
                            <tbody className="divide-y divide-gray-100">
                                {group.standings.map(row => (
                                    <StandingRow key={`${groupIndex}-${row.team.id}-${row.position}`} row={row} qualifies={row.position <= 4} compact />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );

    // FIFA-style tournament layout: knockout bracket, then group tables, then best-thirds.
    const renderCupLayout = () => (
        <div className="animate-fadeInUp">
            {bracket && <KnockoutBracket bracket={bracket} logoUrl={selectedLeague?.logoUrl} />}

            {standingGroups.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                        <h4 className="text-gray-900 font-black text-lg">الترتيب وجداول المجموعات</h4>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {standingGroups.map((group, groupIndex) => (
                            <div key={groupIndex} className="bg-white sm:rounded-2xl overflow-hidden sm:shadow-sm border-y sm:border border-gray-200">
                                {group.name && (
                                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50/80 border-b border-gray-200">
                                        <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                                        <h5 className="text-gray-800 font-black text-sm">{localizeGroupName(group.name)}</h5>
                                    </div>
                                )}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right">
                                        {renderTableHead(false, true)}
                                        <tbody className="divide-y divide-gray-100">
                                            {group.standings.map(row => (
                                                <StandingRow key={`${groupIndex}-${row.team.id}-${row.position}`} row={row} qualifies={row.position <= 2} compact />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 px-2 text-[10px] font-bold text-gray-500">
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-md bg-emerald-600"></span> يتأهل للدور التالي</div>
                        <div className="flex items-center gap-1.5"><span className="text-gray-800 font-black">+/-</span> فارق الأهداف</div>
                    </div>
                </div>
            )}

            {thirdPlaceStandings.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                        <h4 className="text-gray-900 font-black text-lg">ترتيب أصحاب المركز الثالث</h4>
                    </div>
                    <div className="bg-white sm:rounded-2xl overflow-hidden sm:shadow-sm border-y sm:border border-gray-200">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                {renderTableHead(false, true)}
                                <tbody className="divide-y divide-gray-100">
                                    {thirdPlaceStandings.map(({ row, group, rank }) => (
                                        <StandingRow
                                            key={`third-${row.team.id}`}
                                            row={{ ...row, position: rank }}
                                            qualifies={rank <= thirdsQualifyCount}
                                            groupLabel={group}
                                            compact
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="px-4 py-3 text-[10px] font-bold text-gray-400 border-t border-gray-100">
                            أفضل {thirdsQualifyCount} منتخبات تحتل المركز الثالث تتأهل إلى الأدوار الإقصائية
                        </p>
                    </div>
                </div>
            )}
        </div>
    );

    const renderMainContent = () => {
        if (loadingData) return <StandingsSkeleton />;

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-400">
                    <p className="font-bold mb-4">{error}</p>
                    <button
                        onClick={() => selectedLeague && fetchDataForTab(activeTab, selectedLeague.id)}
                        className="text-emerald-600 font-bold hover:underline"
                    >
                        إعادة المحاولة
                    </button>
                </div>
            );
        }

        switch (activeTab) {
            case 'standings': return isCupCompetition ? renderCupLayout() : renderLeagueTable();
            case 'scorers': return renderPlayerStatTable(scorers, 'الأهداف');
            case 'assists': return renderPlayerStatTable(assists, 'صناعة');
            case 'upcoming': return renderMatchList(false);
            case 'finished': return renderMatchList(true);
            default: return null;
        }
    };

    if (selectedLeague?.id === 'afcon_u17_2026') {
        return <U17AfconStandings onBack={onBackToTournaments} />;
    }

    return (
        <div className="py-2 font-tajawal w-full max-w-[1600px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-start">

                {/* Main Content (Left in RTL) */}
                <div className="lg:col-span-12 order-2 lg:order-1">

                    {/* Header with Light Gray Background */}
                    <div className="bg-[#f8f9fa] sm:rounded-[24px] p-3 sm:p-4 mb-2 sm:shadow-sm relative overflow-hidden border-b sm:border border-gray-100">
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                {onBackToTournaments && (
                                    <button
                                        onClick={onBackToTournaments}
                                        className="p-2 bg-white text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                )}
                                {selectedLeague?.logoUrl && (
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-xl flex items-center justify-center p-1 border border-gray-100 shadow-sm">
                                        <OptimizedImage src={selectedLeague.logoUrl} alt="" width={48} className="w-full h-full object-contain" />
                                    </div>
                                )}
                                <div className="text-center md:text-right">
                                    <h3 className="text-gray-900 font-black text-lg sm:text-xl leading-tight mb-1">
                                        {translateLeague(selectedLeague?.name || '')}
                                    </h3>
                                    <p className="text-emerald-600 font-bold text-xs" dir="ltr">2025/2026</p>
                                </div>
                            </div>
                        </div>

                        {/* Underline tab bar — anchored to the right (RTL start). Five Arabic
                            labels (two are long) can't fit one readable line on a phone, so the
                            bar wraps on mobile to keep every tab visible; single line from sm up. */}
                        <div className="mt-4 flex flex-wrap sm:flex-nowrap sm:overflow-x-auto no-scrollbar items-center gap-x-3.5 gap-y-2.5 sm:gap-8 border-t border-gray-200 pt-3 justify-start">
                            {[
                                { id: 'standings', label: 'الترتيب' },
                                { id: 'scorers', label: 'الهدافين' },
                                { id: 'assists', label: 'صناع اللعب' },
                                { id: 'upcoming', label: 'المباريات القادمة' },
                                { id: 'finished', label: 'المباريات المنتهية' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id as TabType)}
                                    className={`relative pb-2.5 text-[11px] sm:text-base font-bold whitespace-nowrap flex-shrink-0 transition-colors ${
                                        activeTab === tab.id ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full"></span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {renderMainContent()}
                </div>
            </div>
        </div>
    );
};

export default StandingsView;
