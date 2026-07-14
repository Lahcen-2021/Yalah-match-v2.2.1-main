
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchYanb8Leagues, Yanb8League, fetchYanb8Standings, fetchLeagueTopScorers, fetchCompetitionBracket } from '../services/api';
import { fetchLeagueStandings, LEAGUES as ESPN_LEAGUES } from '../services/espnService';
import { translateLeague, translateTeam } from '../utils/translations';
import OptimizedImage from './OptimizedImage';
import { StandingGroup, Scorer, Standing, CompetitionBracket, BracketTie, BracketStage } from '../types';
import { useCache } from '../context/CacheContext';
import U17AfconStandings from './U17AfconStandings';

interface StandingsViewProps {
    initialLeagueId?: string | null;
    onMatchClick?: (match: any) => void;
    onBackToTournaments?: () => void;
}

type TabType = 'standings' | 'scorers';
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

const TieCard: React.FC<{ tie: BracketTie; big?: boolean; fullWidth?: boolean }> = ({ tie, big, fullWidth }) => {
    const sides = [tie.home, tie.away];
    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-emerald-300 transition-colors ${fullWidth ? 'w-full' : big ? 'w-64' : 'w-44'}`}>
            {tie.live && (
                <div className="flex items-center gap-1.5 px-2 pt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-[9px] font-black text-red-500">مباشر</span>
                </div>
            )}
            <div className="divide-y divide-gray-100">
                {sides.map((side, i) => (
                    <div key={i} className={`flex items-center justify-between gap-1.5 ${big ? 'p-3' : 'p-2'}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                            {side && side.id > 0 ? (
                                <OptimizedImage src={TEAM_CREST(side.id)} alt={side.name} width={big ? 24 : 18} className={`${big ? 'w-6 h-6' : 'w-[18px] h-[18px]'} object-contain flex-shrink-0`} />
                            ) : (
                                <div className={`${big ? 'w-6 h-6' : 'w-[18px] h-[18px]'} rounded-full bg-gray-100 flex-shrink-0`}></div>
                            )}
                            <span className={`truncate ${big ? 'text-sm' : 'text-[11px]'} ${side?.winner ? 'font-black text-gray-900' : 'font-bold text-gray-500'}`}>
                                {side?.name ? translateTeam(side.name) : '—'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {side?.penalties != null && (
                                <span className="text-[9px] font-bold text-gray-400">({side.penalties})</span>
                            )}
                            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-md text-[11px] font-black ${
                                side?.winner ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}>
                                {side?.score != null ? side.score : '-'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StageColumn: React.FC<{ name: string; ties: BracketTie[] }> = ({ name, ties }) => (
    <div className="flex flex-col flex-shrink-0">
        <div className="text-center text-[10px] font-black text-gray-400 uppercase mb-3 whitespace-nowrap">{name}</div>
        <div className="flex-1 flex flex-col justify-around gap-4">
            {ties.map((tie, i) => <TieCard key={i} tie={tie} />)}
        </div>
    </div>
);

// Mobile bracket: FIFA-app style — one round at a time behind scrollable stage
// pills, with full-width tie cards stacked vertically. The wide two-sided tree
// needs ~1500px and is unusable at 375px.
const KnockoutBracketMobile: React.FC<{ bracket: CompetitionBracket }> = ({ bracket }) => {
    const stages = bracket.stages;
    const [activeNum, setActiveNum] = useState<number>(() => {
        const current = stages.find(s => s.isCurrent) || stages[0];
        return current?.num ?? 0;
    });
    const stage = stages.find(s => s.num === activeNum) || stages[0];
    if (!stage) return null;

    return (
        <div>
            <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 mb-4 pb-1">
                {stages.map(s => (
                    <button
                        key={s.num}
                        onClick={() => setActiveNum(s.num)}
                        className={`px-4 py-2 text-xs font-black rounded-full whitespace-nowrap flex-shrink-0 transition-all ${
                            s.num === stage.num
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        {s.name}
                    </button>
                ))}
            </div>
            {stage.isFinal && (
                <div className="flex justify-center mb-2">
                    <GoldTrophy className="w-12 h-12 drop-shadow-md" />
                </div>
            )}
            <div className="space-y-3">
                {stage.ties.map((tie, i) => (
                    <div key={i}>
                        {stage.isFinal && stage.ties.length > 1 && (
                            <div className="text-center text-[10px] font-black text-gray-400 uppercase mb-1.5">
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

const KnockoutBracket: React.FC<{ bracket: CompetitionBracket }> = ({ bracket }) => {
    // The final stage (which may also carry the third-place play-off as a second tie)
    // and any single-tie stage go in the center column; multi-tie rounds are split in
    // half and mirrored on both sides, so the bracket reads outside-in like the FIFA layout.
    const centerStages: BracketStage[] = [];
    const sideStages: BracketStage[] = [];
    bracket.stages.forEach(s => ((s.isFinal || s.ties.length <= 1) ? centerStages : sideStages).push(s));

    const rightColumns = sideStages.map(s => ({ name: s.name, ties: s.ties.slice(0, Math.ceil(s.ties.length / 2)) }));
    const leftColumns = [...sideStages].reverse().map(s => ({ name: s.name, ties: s.ties.slice(Math.ceil(s.ties.length / 2)) }));

    const finalStage = centerStages.find(s => s.isFinal) || centerStages[0];
    const otherCenter = centerStages.filter(s => s !== finalStage);

    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                <h4 className="text-gray-900 font-black text-lg">الأدوار الإقصائية</h4>
            </div>
            {/* Mobile: stage tabs + vertical list */}
            <div className="md:hidden bg-white sm:rounded-2xl border-y sm:border border-gray-200 sm:shadow-sm p-3">
                <KnockoutBracketMobile bracket={bracket} />
            </div>

            {/* Desktop: full two-sided tree */}
            <div className="hidden md:block bg-white sm:rounded-2xl border-y sm:border border-gray-200 sm:shadow-sm p-4 overflow-x-auto no-scrollbar">
                <div className="flex items-stretch gap-4 min-w-max mx-auto w-fit py-2">
                    {rightColumns.map((col, i) => <StageColumn key={`r-${i}`} name={col.name} ties={col.ties} />)}

                    {/* Center: trophy + final (+ third-place play-off) */}
                    <div className="flex flex-col items-center justify-center flex-shrink-0 px-2 gap-4">
                        <GoldTrophy className="w-14 h-14 drop-shadow-md" />
                        {finalStage && (
                            <div className="flex flex-col gap-4">
                                <div>
                                    <div className="text-center text-[11px] font-black text-gray-500 uppercase mb-2">{finalStage.name}</div>
                                    <TieCard tie={finalStage.ties[0]} big />
                                </div>
                                {finalStage.ties.slice(1).map((tie, i) => (
                                    <div key={i}>
                                        <div className="text-center text-[10px] font-black text-gray-400 uppercase mb-2">تحديد المركز الثالث</div>
                                        <TieCard tie={tie} />
                                    </div>
                                ))}
                            </div>
                        )}
                        {otherCenter.map((s, si) => (
                            <div key={si}>
                                <div className="text-center text-[10px] font-black text-gray-400 uppercase mb-2">{s.name}</div>
                                {s.ties.map((tie, i) => <TieCard key={i} tie={tie} />)}
                            </div>
                        ))}
                    </div>

                    {leftColumns.map((col, i) => <StageColumn key={`l-${i}`} name={col.name} ties={col.ties} />)}
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
                    defaultLeague = allLeagues.find(l => l.id === '7' || l.name.includes('Premier League')) || allLeagues[0];
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

    const renderScorersTable = () => (
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 animate-fadeInUp">
             <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead>
                        <tr className="text-[11px] font-black text-gray-500 bg-gray-50 border-b border-gray-100">
                            <th className="px-3 py-3 text-center w-12">#</th>
                            <th className="px-3 py-3">اللاعب</th>
                            <th className="px-3 py-3">الفريق</th>
                            <th className="px-3 py-3 text-center">الأهداف</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {scorers.map((scorer) => (
                            <tr key={`${scorer.player.id}-${scorer.rank}`} className="group hover:bg-gray-50 transition-colors">
                                <td className="px-3 py-2 text-center">
                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-black ${scorer.rank <= 3 ? 'bg-[#00bfa5] text-white' : 'text-gray-500 bg-gray-100'}`}>
                                        {scorer.rank}
                                    </span>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                         <div className="w-7 h-7 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                                            <OptimizedImage src={scorer.player.imageUrl || ''} alt={scorer.player.name} width={28} className="w-full h-full object-cover" />
                                         </div>
                                         <span className="font-bold text-gray-800 text-xs">{scorer.player.name}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-1">
                                         <OptimizedImage src={scorer.team.logoUrl} alt={scorer.team.name} width={16} className="w-4 h-4 object-contain" />
                                         <span className="text-gray-600 text-[10px] font-bold">{scorer.team.name}</span>
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
            {bracket && <KnockoutBracket bracket={bracket} />}

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
            case 'scorers': return renderScorersTable();
            default: return null;
        }
    };

    if (selectedLeague?.id === 'afcon_u17_2026') {
        return <U17AfconStandings onBack={onBackToTournaments} />;
    }

    return (
        <div className="py-2 font-tajawal w-full mx-auto">
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

                        {/* Navigation Tabs - Optimized for Mobile Scroll */}
                        <div className="mt-4 flex flex-nowrap overflow-x-auto no-scrollbar items-center gap-2 sm:gap-3 border-t border-gray-200 pt-4 justify-start sm:justify-end pb-1">
                            {[
                                { id: 'standings', label: 'الترتيب' },
                                { id: 'scorers', label: 'الهدافين' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id as TabType)}
                                    className={`px-4 py-2 text-sm font-bold transition-all rounded-full whitespace-nowrap flex-shrink-0 ${
                                        activeTab === tab.id
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-800'
                                    }`}
                                >
                                    {tab.label}
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
