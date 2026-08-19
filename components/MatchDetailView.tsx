
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { fetchMatchDetails, USER_TIMEZONE, parseUtcDate, fetchKoooraEvents, fetchMatchChannel, getServerNow } from '../services/api';
import { Match, MatchDetails, Player, TimelineEvent, Standing, MatchStatistic, MatchStatus, ChannelInfo } from '../types';
import { getLeagueLogo, translateTeam, getChannelLogo, translateLeague } from '../utils/translations';
import OptimizedImage from './OptimizedImage';
import H2HInsights from './H2HInsights';
import SoccerLineup, { VisualPlayer } from './SoccerLineup';
import MatchHighlights from './MatchHighlights';
import MatchTimelineSummary from './MatchTimelineSummary';
import { useCache } from '../context/CacheContext';
import { InlinePlayer, VideoJSPlayer, PlyrPlayer } from './Players';
import { useWrapperFullscreen } from '../utils/useWrapperFullscreen';
import { PlayerControls } from './PlayerControls';
import { CHANNELS } from '../constants/channels';
import LiveStreamHub from './LiveStreamHub';
import headerWaves from '../assets/match-header-waves.jpg';

interface MatchDetailViewProps {
  match: Match;
  onBack: () => void;
}

// --- ICONS ---
const YellowCardIcon = ({ className = "w-2 h-3" }) => ( 
    <div className={`${className} bg-yellow-400 border border-yellow-500 rounded-[1px] shadow-sm`}></div> 
);
const MicrophoneIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
);
const StadiumIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="3" width="20" height="18" rx="2" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 9h3v6H2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 9h-3v6h3" />
        <circle cx="12" cy="12" r="3" strokeWidth={2} />
    </svg>
);
const RefereeIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C9.24 2 7 4.24 7 7C7 8.1 7.36 9.11 7.97 9.94C5.7 11.2 4 13.56 4 16.5V22H6V16.5C6 14.57 7.57 13 9.5 13H14.5C16.43 13 18 14.57 18 16.5V22H20V16.5C20 13.56 18.3 11.2 16.03 9.94C16.64 9.11 17 8.1 17 7C17 4.24 14.76 2 12 2ZM12 4C13.66 4 15 5.34 15 7C15 8.66 13.66 10 12 10C10.34 10 9 8.66 9 7C9 5.34 10.34 4 12 4ZM12 14C11.45 14 11 14.45 11 15V17H13V15C13 14.45 12.55 14 12 14ZM8 18H10V20H8V18ZM14 18H16V20H14V18Z" />
        <path d="M13.5 11.5L12.5 13L14 14L15 12.5L13.5 11.5Z" />
    </svg>
);
const SoccerBallIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 4C13.24 4 14.41 4.33 15.42 4.9L13.5 8.23L9.67 8.23L7.75 4.9C8.76 4.33 9.93 4 11.17 4H12ZM5.17 6.42L7.09 9.75L5.17 13.08C4.42 11.83 4 10.37 4 8.83C4 7.95 4.14 7.11 4.4 6.32L5.17 6.42ZM12 20C10.76 20 9.59 19.67 8.58 19.1L10.5 15.77H14.33L16.25 19.1C15.24 19.67 14.07 20 12.83 20H12ZM18.83 17.58L16.91 14.25L18.83 10.92C19.58 12.17 20 13.63 20 15.17C20 16.05 19.86 16.89 19.6 17.68L18.83 17.58ZM12 13.5L10.25 10.5H13.75L12 13.5Z" />
    </svg>
);
const CalendarIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
);

const PinIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const TrophyIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15l-2 5h4l-2-5z" />
    </svg>
);

// --- SKELETON LOADER ---
const DetailContentSkeleton = React.memo(() => (
    <div className="p-4 sm:p-8 animate-pulse w-full" dir="rtl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {[1, 2].map((i) => (
                <div key={`skeleton-card-${i}`} className="bg-white rounded-[20px] border border-gray-100 overflow-hidden flex flex-col shadow-sm h-[240px]">
                    <div className="px-5 py-3 bg-gray-100 border-b border-gray-50 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-gray-300 rounded-full"></div>
                        <div className="h-3 w-24 bg-gray-300 rounded"></div>
                    </div>
                    <div className="flex-1 p-5 space-y-5">
                         {[1, 2, 3, 4].map((j) => (
                             <div key={`skeleton-row-${j}`} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                                 <div className="h-3 w-20 bg-gray-200 rounded"></div>
                                 <div className="flex items-center gap-2">
                                     {j === 1 && <div className="w-6 h-6 bg-gray-200 rounded-lg"></div>}
                                     <div className="h-4 w-32 bg-gray-100 rounded"></div>
                                 </div>
                             </div>
                         ))}
                    </div>
                </div>
            ))}
        </div>

        <div className="mb-10">
             <div className="flex items-center gap-3 mb-4 px-1">
                <div className="w-1.5 h-5 bg-gray-300 rounded-full"></div>
                <div className="h-5 w-48 bg-gray-200 rounded"></div>
             </div>
             <div className="overflow-hidden bg-white rounded-[20px] border border-gray-100 shadow-sm">
                <div className="h-10 bg-gray-50 border-b border-gray-100"></div>
                {[1, 2, 3].map((k) => (
                    <div key={`skeleton-table-row-${k}`} className="flex items-center p-4 border-b border-gray-50 last:border-0">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg ml-4"></div>
                        <div className="h-4 w-32 bg-gray-100 rounded flex-1"></div>
                        <div className="h-4 w-8 bg-gray-100 rounded mx-2"></div>
                        <div className="h-4 w-8 bg-gray-100 rounded mx-2"></div>
                    </div>
                ))}
             </div>
        </div>
    </div>
));

// --- DETAILS VIEW COMPONENTS ---
const InfoRow = React.memo(({ label, value, icon, isFirst = false }: { label: string, value: string | React.ReactNode, icon?: React.ReactNode | string, isFirst?: boolean }) => (
    <div className={`flex items-center justify-start p-4 ${!isFirst ? 'border-t border-gray-50' : ''} hover:bg-emerald-50/20 transition-colors group`}>
        {/* Label Side */}
        <span className="text-gray-500 font-bold text-xs sm:text-sm min-w-[100px] text-right">{label}</span>
        
        {/* Value Side */}
        <div className="flex items-center justify-start gap-3 flex-1 overflow-hidden mr-4">
            {typeof icon === 'string' ? (
                <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center p-0.5 bg-white rounded-lg shadow-sm group-hover:shadow transition-shadow">
                    <OptimizedImage src={icon} alt="" width={32} className="w-full h-full object-contain" />
                </div>
            ) : icon ? (
                <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-emerald-500 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                    {icon}
                </div>
            ) : null}
            <span className="text-gray-900 font-black text-sm sm:text-base text-right sm:truncate whitespace-pre-line leading-[1.4] sm:leading-tight group-hover:text-emerald-700 transition-colors">{typeof value === 'string' ? value.replace("أكاديمية محمد", "أكاديمية\nمحمد") : value}</span>
        </div>
    </div>
));

const SectionCard: React.FC<{ title: string, colorClass: string, children: React.ReactNode }> = React.memo(({ title, colorClass, children }) => {
    // Determine the actual background and border classes based on colorClass
    const isEmerald = colorClass.includes('emerald');
    const accentColor = isEmerald ? 'text-emerald-600' : 'text-blue-600';
    const accentBg = isEmerald ? 'bg-emerald-600' : 'bg-blue-600';
    const lightBg = isEmerald ? 'bg-emerald-50/50' : 'bg-blue-50/50';

    return (
        <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col transition-all hover:shadow-md hover:border-emerald-100/50">
            <div className={`px-5 py-4 ${lightBg} border-b border-gray-50 flex items-center gap-3`}>
                <div className={`w-1.5 h-5 rounded-full ${accentBg}`}></div>
                <h4 className={`font-black ${accentColor} text-sm sm:text-base tracking-tight`}>{title}</h4>
            </div>
            <div className="flex-1 flex flex-col justify-center py-2">
                {children}
            </div>
        </div>
    );
});

// --- DETAILS VIEW ---
const DetailsTabView: React.FC<{ match: Match, details: MatchDetails | null }> = ({ match, details }) => {
    const [koooraEvents, setKoooraEvents] = useState<any[]>([]);
    const [koooraChannels, setKoooraChannels] = useState<(string | ChannelInfo)[] | null>(() => {
        const isAFCONU17 = match.league === 'كأس أمم إفريقيا تحت 17' || match.league.includes('إفريقيا تحت 17') || match.league.includes('امم افريقيا تحت 17');
        const isThroneCup = match.league === 'كأس العرش المغربي' || match.league.includes('كأس العرش');
        
        if (isThroneCup) return ["ARRYADIA TNT HD", "ALAOULA TNT HD", "2M TNT HD", "TAMAZIGHT HD", "AL MAGHRIBIA HD"];
        return isAFCONU17 ? ["beIN Sports 5", "ARRYADIA TNT HD"] : null;
    });
    
    useEffect(() => {
        let isMounted = true;
        const fetchKooora = async () => {
            if (!match.teamA.name || !match.teamB.name) return;
            
            try {
                const isAFCONU17 = match.league === 'كأس أمم إفريقيا تحت 17' || match.league.includes('إفريقيا تحت 17') || match.league.includes('امم افريقيا تحت 17');
                const isThroneCup = match.league === 'كأس العرش المغربي' || match.league.includes('كأس العرش');
                
                // Fetch in parallel, but skip channel fetch if it's AFCON U17 or Throne Cup to keep our override
                const [koooraEventsData, channels] = await Promise.all([
                    fetchKoooraEvents(match.teamA.name, match.teamB.name, match.utcDate),
                    (isAFCONU17 || isThroneCup) ? Promise.resolve(null) : fetchMatchChannel(match.id, match.teamA.name, match.teamB.name, match.utcDate)
                ]);

                if (isMounted) {
                    if (koooraEventsData && koooraEventsData.length > 0) setKoooraEvents(koooraEventsData);
                    if (channels && channels.length > 0) setKoooraChannels(channels);
                }
            } catch (e) {
                console.warn("Background fetch in DetailsTabView failed", e);
            }
        };

        // Delay background fetch to prioritize main initial loading
        const timeoutId = setTimeout(fetchKooora, 500);
        return () => { 
            isMounted = false; 
            clearTimeout(timeoutId);
        };
    }, [match.id, match.teamA.name, match.teamB.name, match.utcDate, match.league]);

    const h2h = useMemo(() => details?.h2h || [], [details?.h2h]);
    const standings = useMemo(() => details?.standings || [], [details?.standings]);
    
    // Use goals from match details directly, as api.ts already handles Kooora fallback
    const homeGoals = useMemo(() => details?.homeGoals || [], [details?.homeGoals]);
    const awayGoals = useMemo(() => details?.awayGoals || [], [details?.awayGoals]);

    const hasGoals = homeGoals.length > 0 || awayGoals.length > 0;

    // Calculate H2H stats accurately by comparing names
    const h2hStats = useMemo(() => {
        if (!h2h.length) return null;
        let teamAWins = 0;
        let teamBWins = 0;
        let draws = 0;
        
        // Helper to normalize and compare team names
        const cleanName = (n: string) => (n || "").toLowerCase()
            .replace(/[\u064B-\u065F]/g, "")
            .replace(/[أإآ]/g, "ا")
            .replace(/ة/g, "ه")
            .replace(/ى/g, "ي")
            .replace(/\s+/g, "") // Remove all spaces for more robust comparison
            .trim();
        const normA = cleanName(match.teamA.name);
        const normB = cleanName(match.teamB.name);

        h2h.forEach(m => {
            const h = cleanName(m.homeTeam);
            const a = cleanName(m.awayTeam);
            
            const isHomeA = h.includes(normA) || normA.includes(h);
            const isAwayA = a.includes(normA) || normA.includes(a);
            const isHomeB = h.includes(normB) || normB.includes(h);
            const isAwayB = a.includes(normB) || normB.includes(a);

            if (m.homeScore > m.awayScore) {
                if (isHomeA) teamAWins++;
                else if (isHomeB) teamBWins++;
            } else if (m.awayScore > m.homeScore) {
                if (isAwayA) teamAWins++;
                else if (isAwayB) teamBWins++;
            } else {
                draws++;
            }
        });
        return { teamAWins, teamBWins, draws, total: h2h.length };
    }, [h2h, match.teamA.name, match.teamB.name]);

    const RecentPerformance = React.memo(({ teamName, teamLogo, matches }: { teamName: string, teamLogo: string, matches: any[] }) => (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 mb-2 border-b border-gray-50 pb-3">
                <div className="w-8 h-8 rounded-full bg-gray-50 p-1 border border-gray-100 flex-shrink-0">
                    <OptimizedImage src={teamLogo} alt={teamName} width={24} className="w-full h-full object-contain" />
                </div>
                <span className="font-black text-sm text-gray-900 truncate">نتائج {translateTeam(teamName)} الأخيرة</span>
            </div>
            <div className="flex gap-2">
                {matches.slice(0, 5).map((m, i) => {
                    const cleanName = (n: string) => (n || "").toLowerCase()
                        .replace(/[\u064B-\u065F]/g, "")
                        .replace(/[أإآ]/g, "ا")
                        .replace(/ة/g, "ه")
                        .replace(/ى/g, "ي")
                        .replace(/\s+/g, "")
                        .trim();
                    const normTeamName = cleanName(teamName);
                    const homeNorm = cleanName(m.homeTeam);
                    const awayNorm = cleanName(m.awayTeam);
                    const isHome = homeNorm.includes(normTeamName) || normTeamName.includes(homeNorm);
                    
                    let result: 'W' | 'L' | 'D' = 'D';
                    if (m.homeScore === m.awayScore) result = 'D';
                    else if (isHome) {
                        result = m.homeScore > m.awayScore ? 'W' : 'L';
                    } else {
                        result = m.awayScore > m.homeScore ? 'W' : 'L';
                    }
                    
                    const colors = {
                        'W': 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]',
                        'L': 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]',
                        'D': 'bg-gray-400 shadow-[0_0_10px_rgba(156,163,175,0.3)]'
                    };
                    
                    const text = { 'W': 'ف', 'L': 'خ', 'D': 'ت' };

                    return (
                        <div key={i} className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-black text-xs sm:text-sm ${colors[result]} transition-transform hover:scale-110 cursor-help`} title={`${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`}>
                            {text[result]}
                        </div>
                    );
                })}
                {matches.length === 0 && <div className="text-gray-300 text-xs font-bold italic py-2">لا توجد بيانات</div>}
            </div>
        </div>
    ));

    const matchDate = useMemo(() => {
        if (!match.utcDate) return "غير محدد";
        const dateObj = new Date(match.utcDate);
        if (isNaN(dateObj.getTime())) return "غير محدد";
        return dateObj.toLocaleDateString('en-CA'); 
    }, [match.utcDate]);

    const getValidDisplayValue = (
        val1: string | (string | ChannelInfo)[] | null | undefined,
        val2: string | (string | ChannelInfo)[] | undefined,
        fallback: string,
    ): string | (string | ChannelInfo)[] => {
        if (Array.isArray(val1) && val1.length > 0) return val1;
        if (typeof val1 === 'string' && val1 && val1 !== "N/A" && val1 !== "غير محدد") return val1;
        if (Array.isArray(val2)) {
            if (val2.length > 0) return val2;
        } else if (val2 && val2 !== "N/A" && val2 !== "غير محدد") {
            return val2;
        }
        return fallback;
    };

    const matchTimeLocal = useMemo(() => {
        if (!match.utcDate) return match.time || "غير محدد";
        const dateObj = parseUtcDate(match.utcDate);
        if (isNaN(dateObj.getTime())) return match.time || "غير محدد";
        return dateObj.toLocaleTimeString('en-GB', { timeZone: USER_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false });
    }, [match.utcDate, match.time]);

    const stadium = getValidDisplayValue(details?.matchInfo?.stadium, match.stadium, "غير محدد") as string;
    const referee = getValidDisplayValue(details?.matchInfo?.referee, match.referee, "غير محدد") as string;
    const commentator = getValidDisplayValue(details?.matchInfo?.commentator, match.commentator, "غير محدد") as string;
    const round = getValidDisplayValue(details?.matchInfo?.round, match.round, "غير متوفرة") as string;
    
    const channel = getValidDisplayValue(
        koooraChannels, 
        details?.matchInfo?.channel || match.channel, 
        "غير محدد"
    );

    return (
        <div className="bg-white p-4 sm:p-8 font-tajawal animate-fadeIn" dir="rtl">
            <div className="w-full">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    <SectionCard title="بطاقة المباراة" colorClass="bg-emerald-600">
                        <InfoRow
                            isFirst
                            label="البطولة"
                            value={translateLeague(match.league)}
                            icon={<OptimizedImage src={match.leagueLogoUrl || getLeagueLogo(match.league) || null} alt="" width={32} className="w-full h-full object-contain drop-shadow-[0_0_2px_rgba(0,0,0,0.4)]" fallbackElement={<TrophyIcon className="w-4 h-4 text-gray-300" />} />}
                        />
                        <InfoRow label="الجولة" value={translateLeague(round)} />
                        <InfoRow label="التاريخ" value={matchDate} />
                        <InfoRow label="الوقت" value={matchTimeLocal} />
                    </SectionCard>

                    <SectionCard title="معلومات تقنية" colorClass="bg-blue-600">
                        <InfoRow 
                            isFirst
                            label="الملعب" 
                            value={stadium} 
                            icon={<StadiumIcon className="w-5 h-5" />}
                        />
                        <InfoRow 
                            label="حكم المباراة" 
                            value={referee} 
                            icon={<RefereeIcon className="w-5 h-5" />}
                        />
                        <InfoRow 
                            label="الحالة" 
                            value={match.statusText} 
                        />
                        <InfoRow 
                            label="القناة الناقلة" 
                            value={
                                Array.isArray(channel) ? (
                                    <div className="flex flex-col gap-1.5 w-full">
                                        {channel.map((ch, idx) => {
                                            const chName = typeof ch === 'string' ? ch : ch.name;
                                            const chLogo = typeof ch === 'string' ? getChannelLogo(ch) : (ch.logo || getChannelLogo(ch.name));
                                            const chUrl = typeof ch === 'object' ? ch.url : undefined;
                                            
                                            const content = (
                                                <div key={idx} className={`flex items-center gap-2 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 ${chUrl ? 'hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer shadow-sm active:scale-95' : ''}`}>
                                                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                                        {chLogo ? (
                                                            <OptimizedImage 
                                                                src={chLogo} 
                                                                alt={chName} 
                                                                width={24} 
                                                                className="w-full h-full object-contain" 
                                                            />
                                                        ) : (
                                                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <span className="text-[13px] font-bold text-gray-800 truncate" dir="ltr">{chName}</span>
                                                    {chUrl && (
                                                       <svg className="w-3 h-3 text-emerald-500 mr-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                       </svg>
                                                    )}
                                                </div>
                                            );
                                            
                                            return chUrl ? (
                                                <a key={idx} href={chUrl} target="_blank" rel="noopener noreferrer" className="block w-full no-underline">
                                                    {content}
                                                </a>
                                            ) : content;
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                            {getChannelLogo(channel as string) ? (
                                                <OptimizedImage 
                                                    src={getChannelLogo(channel as string)!} 
                                                    alt={channel as string} 
                                                    width={24} 
                                                    className="w-full h-full object-contain" 
                                                />
                                            ) : (
                                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-sm font-bold text-gray-800 truncate" dir="ltr">{channel as string}</span>
                                    </div>
                                )
                            } 
                        />
                    </SectionCard>
                </div>

                {hasGoals && (
                    <div className="mb-10">
                        <h3 className="text-gray-800 font-black text-lg mb-4 flex items-center gap-3 px-1">
                            <div className="w-1.5 h-5 bg-emerald-600 rounded-full"></div>
                            أهداف المباراة
                        </h3>
                        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-6 sm:p-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative">
                                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-50 -translate-x-1/2 hidden sm:block"></div>
                                
                                {/* Home Goals */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 mb-2 border-b border-gray-50 pb-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-50 p-1 border border-gray-100">
                                            <OptimizedImage src={match.teamA.logoUrl} alt={match.teamA.name} width={24} className="w-full h-full object-contain" />
                                        </div>
                                        <span className="font-black text-sm text-gray-900">{match.teamA.name}</span>
                                    </div>
                                    <div className="space-y-3">
                                        {homeGoals.length > 0 ? homeGoals.map((g, i) => (
                                            <div key={`home-goal-${i}-${g.minute}`} className="flex items-center justify-between bg-gray-50/50 p-2.5 rounded-2xl border border-gray-100/50 group hover:bg-white hover:shadow-md transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 group-hover:border-emerald-200 overflow-hidden relative">
                                                        {g.scorerImage ? (
                                                            <OptimizedImage src={g.scorerImage} alt={g.scorerName} width={40} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <SoccerBallIcon className="w-5 h-5 text-emerald-600" />
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-black text-gray-800">{g.scorerName}</span>
                                                </div>
                                                <span className="font-black text-emerald-600 text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                    {g.minute}'
                                                </span>
                                            </div>
                                        )) : <div className="py-4 text-center text-gray-300 text-xs font-bold italic">لا يوجد أهداف</div>}
                                    </div>
                                </div>

                                {/* Away Goals */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 mb-2 border-b border-gray-50 pb-3 sm:flex-row-reverse">
                                        <div className="w-8 h-8 rounded-full bg-gray-50 p-1 border border-gray-100">
                                            <OptimizedImage src={match.teamB.logoUrl} alt={match.teamB.name} width={24} className="w-full h-full object-contain" />
                                        </div>
                                        <span className="font-black text-sm text-gray-900">{match.teamB.name}</span>
                                    </div>
                                    <div className="space-y-3">
                                        {awayGoals.length > 0 ? awayGoals.map((g, i) => (
                                            <div key={`away-goal-${i}-${g.minute}`} className="flex items-center justify-between bg-gray-50/50 p-2.5 rounded-2xl border border-gray-100/50 group hover:bg-white hover:shadow-md transition-all sm:flex-row-reverse">
                                                <div className="flex items-center gap-3 sm:flex-row-reverse">
                                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 group-hover:border-emerald-200 overflow-hidden relative">
                                                        {g.scorerImage ? (
                                                            <OptimizedImage src={g.scorerImage} alt={g.scorerName} width={40} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <SoccerBallIcon className="w-5 h-5 text-emerald-600" />
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-black text-gray-800">{g.scorerName}</span>
                                                </div>
                                                <span className="font-black text-emerald-600 text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                    {g.minute}'
                                                </span>
                                            </div>
                                        )) : <div className="py-4 text-center text-gray-300 text-xs font-bold italic">لا يوجد أهداف</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {standings.length > 0 && (
                    <div className="mb-10">
                        <h3 className="text-gray-800 font-black text-lg mb-4 flex items-center gap-3 px-1">
                            <div className="w-1.5 h-5 bg-purple-600 rounded-full"></div>
                            ترتيب المجموعة / الدوري
                        </h3>
                        <div className="overflow-x-auto bg-white rounded-[20px] border border-gray-100 shadow-sm">
                            <table className="w-full text-right min-w-[600px]">
                                <thead>
                                    <tr className="text-[10px] sm:text-xs font-black text-gray-400 bg-gray-50 border-b border-gray-100">
                                        <th className="px-4 py-3 text-center w-12">#</th>
                                        <th className="px-4 py-3 text-right">الفريق</th>
                                        <th className="px-2 py-3 text-center w-12">لعب</th>
                                        <th className="px-2 py-3 text-center w-12">فاز</th>
                                        <th className="px-2 py-3 text-center w-12">تعادل</th>
                                        <th className="px-2 py-3 text-center w-12">خسر</th>
                                        <th className="px-2 py-3 text-center w-16">+/-</th>
                                        <th className="px-4 py-3 text-center w-16">نقاط</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {standings.map((team) => (
                                        <tr key={team.team.id} className={`hover:bg-purple-50/20 transition-colors ${team.team.name === match.teamA.name || team.team.name === match.teamB.name ? 'bg-yellow-50/50' : ''}`}>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-black ${team.position <= 4 ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                                                    {team.position}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <OptimizedImage src={team.team.crest} alt={team.team.name} width={24} className="w-6 h-6 object-contain" />
                                                    <span className="font-black text-gray-900 text-sm sm:text-base">{translateTeam(team.team.name)}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-3 text-center font-bold text-gray-600 text-xs">{team.playedGames}</td>
                                            <td className="px-2 py-3 text-center font-bold text-emerald-600 text-xs">{team.won}</td>
                                            <td className="px-2 py-3 text-center font-bold text-gray-400 text-xs">{team.draw}</td>
                                            <td className="px-2 py-3 text-center font-bold text-red-500 text-xs">{team.lost}</td>
                                            <td className="px-2 py-3 text-center font-bold text-gray-600 text-xs" dir="ltr">{team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="font-black text-gray-900 text-sm">{team.points}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <H2HInsights
                    match={match}
                    h2h={h2h}
                    recentA={details?.recentMatchesA || []}
                    recentB={details?.recentMatchesB || []}
                />
            </div>
        </div>
    );
};

// --- ADDITIONAL COMPONENTS ---

// Brand palette for the two sides — home is emerald, away is blue.
const STAT_HOME = '#10b981';
const STAT_AWAY = '#3b82f6';
const statNum = (v: string) => parseFloat((v ?? '').toString().replace(/[^0-9.]/g, '')) || 0;

// One comparison row: value on each side (home right, away left) with two bars
// growing inward from the edges over a shared grey track, scaled to the larger side.
const StatRow: React.FC<{ stat: MatchStatistic }> = ({ stat }) => {
    const h = statNum(stat.homeValue);
    const a = statNum(stat.awayValue);
    const max = Math.max(h, a, 1);
    const hW = (h / max) * 100;
    const aW = (a / max) * 100;
    return (
        <div className="py-2.5">
            <div className="flex items-center justify-between mb-1.5" dir="ltr">
                <span className="font-black text-gray-900 text-sm tabular-nums w-12 text-left">{stat.awayValue}</span>
                <span className="font-bold text-gray-500 text-[11px] sm:text-xs text-center flex-1 px-2 truncate">{stat.type}</span>
                <span className="font-black text-gray-900 text-sm tabular-nums w-12 text-right">{stat.homeValue}</span>
            </div>
            <div className="flex items-center gap-1.5" dir="ltr">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex justify-start">
                    <div className="h-full rounded-full" style={{ width: `${aW}%`, backgroundColor: STAT_AWAY }} />
                </div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex justify-end">
                    <div className="h-full rounded-full" style={{ width: `${hW}%`, backgroundColor: STAT_HOME }} />
                </div>
            </div>
        </div>
    );
};

const StatSection: React.FC<{ title: string, items: MatchStatistic[], children?: React.ReactNode }> = ({ title, items, children }) => {
    if (items.length === 0 && !children) return null;
    return (
        <div className="mb-6">
            <h4 className="text-emerald-600 font-black text-sm mb-2 text-right px-1">{title}</h4>
            <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm px-5 py-3">
                {children}
                {items.map((s, i) => <StatRow key={`${s.type}-${i}`} stat={s} />)}
            </div>
        </div>
    );
};

const PossessionDonut: React.FC<{ stat: MatchStatistic }> = ({ stat }) => {
    const h = statNum(stat.homeValue);
    const a = statNum(stat.awayValue);
    const total = h + a || 1;
    const hFrac = h / total;
    const C = 2 * Math.PI * 40;
    return (
        <div className="flex items-center justify-center gap-6 sm:gap-10 py-4 border-b border-gray-50 mb-2" dir="ltr">
            <span className="font-black text-lg tabular-nums" style={{ color: STAT_AWAY }}>{stat.awayValue}{/%/.test(stat.awayValue) ? '' : '%'}</span>
            <div className="relative w-24 h-24 sm:w-28 sm:h-28">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="13" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke={STAT_AWAY} strokeWidth="13" strokeDasharray={`${(1 - hFrac) * C} ${C}`} strokeDashoffset={`${-hFrac * C}`} />
                    <circle cx="50" cy="50" r="40" fill="none" stroke={STAT_HOME} strokeWidth="13" strokeDasharray={`${hFrac * C} ${C}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-gray-400">{stat.type}</span>
            </div>
            <span className="font-black text-lg tabular-nums" style={{ color: STAT_HOME }}>{stat.homeValue}{/%/.test(stat.homeValue) ? '' : '%'}</span>
        </div>
    );
};

const StatisticsView: React.FC<{ details: MatchDetails }> = React.memo(({ details }) => {
    const stats = details.statistics || [];
    if (stats.length === 0) return <div className="p-8 text-center text-gray-500 font-bold">لا تتوفر إحصائيات لهذه المباراة</div>;

    const possession = stats.find(s => /استحواذ|possession/i.test(s.type));
    const rest = stats.filter(s => s !== possession);

    const groupOf = (type: string): 'attack' | 'defense' | 'cards' => {
        const t = type || '';
        if (/بطاق|إنذار|طرد|card/i.test(t)) return 'cards';
        if (/مخالف|تصد|حارس|تدخل|قطع|إنقاذ|foul|save|tackle|clearance|block/i.test(t)) return 'defense';
        return 'attack';
    };
    const groups: Record<'attack' | 'defense' | 'cards', MatchStatistic[]> = { attack: [], defense: [], cards: [] };
    rest.forEach(s => groups[groupOf(s.type)].push(s));

    return (
        <div className="p-4 sm:p-6" dir="rtl">
            <StatSection title="الهجوم" items={groups.attack}>
                {possession && <PossessionDonut stat={possession} />}
            </StatSection>
            <StatSection title="الدفاع" items={groups.defense} />
            <StatSection title="البطاقات" items={groups.cards} />
        </div>
    );
});

const LiveStreamView: React.FC<{
    channel: (string | ChannelInfo)[] | string | undefined;
    // Called with the channel the viewer picked — logo placement is per-channel.
    branding?: (channelName: string) => React.ReactNode;
}> = React.memo(({ channel, branding }) => {
    // We will use this in the next step to render the choices.
    const channelNames = useMemo(() => {
        if (!channel) return [];
        const arr = Array.isArray(channel) ? channel : [channel];
        return arr.map(ch => typeof ch === 'string' ? ch : (ch.name || ''));
    }, [channel]);
    
    // New state for manual channel selection
    const [selectedChannelName, setSelectedChannelName] = useState<string>(() => channelNames[0] || '');
        
    const selectedChannelData = useMemo(() => {
        if (!selectedChannelName) return null;
        
        const ch = selectedChannelName;
        const cleanName = ch.toLowerCase().replace(/hd|sd|4k|tv/g, '').trim();
        
        const findById = (id: string) => CHANNELS.find(c => c.id === id);
        
        // Direct match
        let found = CHANNELS.find(c => c.name === ch || c.name.toLowerCase() === ch.toLowerCase());
        
        if (!found) {
             // ... [The matching logic needs to stay, but operate on ch/cleanName]
             // Actually, the current logic is fine if we pass 'ch' as the single channel
             if (cleanName.includes('bein')) {
                    if (cleanName.includes('max')) {
                        if (cleanName.includes('2')) found = findById('beinmax2');
                        else found = findById('beinmax1');
                    } else if (cleanName.includes('news')) {
                        found = findById('beinnews');
                    } else if (cleanName.includes('premium')) {
                        found = findById('beinpremium1');
                    } else if (cleanName.includes('xtra') || cleanName.includes('extra')) {
                        found = findById('bein1');
                    } else {
                        const numMatch = cleanName.match(/\d+/);
                        if (numMatch) {
                            const num = numMatch[0];
                            found = findById(`bein${num}`);
                        }
                        if (!found) found = findById('bein1');
                    }
                }
                else if (cleanName.includes('ssc')) {
                     if (cleanName.includes('5') || cleanName.includes('extra')) found = findById('ssc5');
                     else found = findById('ssc1');
                }
                else if (cleanName.includes('abu dhabi') || cleanName.includes('ad sports') || cleanName.includes('abudhabi')) {
                     if (cleanName.includes('2')) found = findById('ad2');
                     else found = findById('ad1');
                }
                else if (cleanName.includes('alkass') || cleanName.includes('kass')) {
                    found = findById('alkass1');
                }
                else if (cleanName.includes('on time') || cleanName.includes('ontime')) {
                    found = findById('ontime');
                }
                else if (cleanName.includes('mbc')) {
                    if (cleanName.includes('2')) found = findById('mbc2');
                    else found = findById('mbc');
                }
                else if (cleanName.includes('thmanyah') || ch.includes('ثمانية') || ch.includes('تطبيق ثمانية')) {
                     found = findById('thmanyah1');
                }
                else if (cleanName.includes('starzplay')) {
                    found = findById('starzplay');
                }
                else if (cleanName.includes('dubai') || ch.includes('دبي')) {
                    found = findById('dubai1');
                }
                else if (cleanName.includes('algeria') || ch.includes('الجزائرية')) {
                    found = findById('algeria1');
                }
                else if (cleanName.includes('dazn')) {
                    found = findById('daznit');
                }
                else if (cleanName.includes('sky sport')) {
                    found = findById('skycalcio');
                }
                else if (cleanName.includes('espn')) {
                    if (cleanName.includes('2')) found = findById('espn2');
                    else found = findById('espn1');
                }
                else if (cleanName.includes('sport tv')) {
                    if (cleanName.includes('4')) found = findById('sporttv4');
                    else found = findById('sporttv1');
                }
                else if (cleanName.includes('alwan7')) {
                    found = findById('alwan7');
                }
                else if (cleanName.includes('now2')) {
                    found = findById('now2');
                }
                else if (cleanName.includes('bundes2')) {
                    found = findById('bundes2');
                }
        }
        return found || null;
    }, [selectedChannelName]);

    const [playerType, setPlayerType] = useState<'plyr' | 'default' | 'videojs'>('plyr');

    // Fullscreen the wrapper, not the video, so the branding overlays come along.
    const { ref: playerWrapRef, isFullscreen, toggle: toggleFullscreen } = useWrapperFullscreen<HTMLDivElement>();

    // Track manually selected server URL, null means default to selectedChannelData's first server/URL
    const [manualActiveUrl, setManualActiveUrl] = useState<string | null>(null);

    // Derived active URL
    const activeUrl = useMemo(() => {
        if (!selectedChannelData) return '';
        if (manualActiveUrl) return manualActiveUrl;
        return (selectedChannelData.servers && selectedChannelData.servers.length > 0) ? selectedChannelData.servers[0].url : selectedChannelData.url;
    }, [selectedChannelData, manualActiveUrl]);

    const servers = selectedChannelData?.servers || (selectedChannelData ? [{ name: 'سيرفر أساسي', url: selectedChannelData.url }] : []);

    if (!selectedChannelData || !activeUrl) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[400px] text-center bg-gray-50">
                <div className="bg-white p-6 rounded-full mb-6 shadow-sm border border-gray-100">
                   <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                </div>
                <h3 className="font-black text-xl text-gray-800 mb-2">البث غير متوفر</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">عذراً، لم نتمكن من العثور على بث مباشر مطابق للقناة المطلوبة تلقائياً.</p>
                {channel && <p className="text-emerald-600 text-xs font-bold mt-4 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{Array.isArray(channel) ? channel.join(' | ') : channel}</p>}
                <p className="text-gray-400 text-xs mt-6">يرجى مراجعة قسم "القنوات الناقلة" للبحث يدوياً</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-white shadow-lg">
             <div className="p-3 sm:p-4 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between border-b border-gray-100 gap-3">
                 <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                     {/* Live Badge */}
                     <div className="flex items-center gap-2 bg-red-100/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-red-200">
                         <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                         <span className="text-[10px] font-black uppercase text-red-700 tracking-tight">بث مباشر</span>
                     </div>
                     
                     {/* Channel Selector if multiple (Mobile only version or subtle chips) */}
                     {channelNames.length > 1 && (
                         <div className="flex sm:hidden gap-1.5 overflow-x-auto no-scrollbar py-1">
                             {channelNames.map(chName => (
                                 <button 
                                     key={chName}
                                     onClick={() => setSelectedChannelName(chName)}
                                     className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap border ${selectedChannelName === chName ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}
                                 >
                                     {chName}
                                 </button>
                             ))}
                         </div>
                     )}
                 </div>

                 {/* Desktop Version Channel Selector */}
                 {channelNames.length > 1 && (
                     <div className="hidden sm:flex gap-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase self-center ml-2">القنوات:</span>
                        <div className="flex gap-1.5">
                            {channelNames.map(chName => (
                                <button 
                                    key={chName}
                                    onClick={() => setSelectedChannelName(chName)}
                                    className={`px-4 py-1.5 text-xs font-black rounded-xl transition-all border ${selectedChannelName === chName ? 'bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105' : 'bg-white text-gray-600 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30'}`}
                                >
                                    {chName}
                                </button>
                            ))}
                        </div>
                     </div>
                 )}
             </div>

             {/* Re-designed Controls Section */}
             <div className="border-b border-gray-100 bg-white">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-5 gap-5">
                    
                       {/* Right side (Desktop Right, Mobile Order 1): Channel Info */}
                    <div className="flex items-center gap-4 bg-emerald-50/40 p-4 rounded-3xl border border-emerald-100/50 order-1 sm:order-2 self-start sm:self-center flex-row-reverse">
                        <div className="flex flex-col text-left">
                             <span className="text-[10px] font-bold text-emerald-600/70 mb-0.5">تبث القناة الآن</span>
                             <h3 className="font-black text-lg text-gray-900 tracking-tight leading-none mb-1">{selectedChannelName}</h3>
                             <p className="text-[9px] font-medium text-gray-400">بث عالي الجودة وبدون تقطيع</p>
                        </div>
                        {selectedChannelData.logo && (
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-gray-200 shadow-md p-1.5">
                                 <OptimizedImage src={selectedChannelData.logo} alt={selectedChannelName} width={56} className="w-full h-full object-contain" />
                            </div>
                        )}
                    </div>
                    {/* Left side (Desktop Left, Mobile Order 2): Switchers & Toggles */}
                    <div className="flex flex-col gap-4 flex-1 order-2 sm:order-1">
                        {/* Server Switcher directly above player */}
                        {servers.length > 1 && (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 mb-1 border-r-2 border-emerald-500 pr-2">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">اختر جودة البث</span>
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                                    {servers.map((server: any, idx: number) => (
                                        <button
                                            key={`server-${idx}-${server.name}`}
                                            onClick={() => setManualActiveUrl(server.url)}
                                            className={`px-4 py-2 text-[11px] font-black rounded-xl whitespace-nowrap transition-all border ${
                                                activeUrl === server.url 
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105' 
                                                : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-emerald-200'
                                            }`}
                                        >
                                            {server.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                     

                        {/* Player Type Selector */}
                        <div className="flex items-center bg-gray-100/50 p-1 max-w-sm rounded-lg overflow-x-auto whitespace-nowrap scrollbar-hide">
                            <button 
                                onClick={() => setPlayerType('plyr')}
                                className={`flex-1 min-w-[90px] px-3 py-2 text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${playerType === 'plyr' ? 'bg-white text-emerald-600 shadow-sm border border-gray-100 rounded-md' : 'text-gray-400 opacity-60'}`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${playerType === 'plyr' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-300'}`}></div>
                                مشغل بليير
                            </button>
                            <button 
                                onClick={() => setPlayerType('default')}
                                className={`flex-1 min-w-[90px] px-3 py-2 text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${playerType === 'default' ? 'bg-white text-emerald-600 shadow-sm border border-gray-100 rounded-md' : 'text-gray-400 opacity-60'}`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${playerType === 'default' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-300'}`}></div>
                                مشغل خارجي
                            </button>
                            <button 
                                onClick={() => setPlayerType('videojs')}
                                className={`flex-1 min-w-[90px] px-3 py-2 text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${playerType === 'videojs' ? 'bg-white text-emerald-600 shadow-sm border border-gray-100 rounded-md' : 'text-gray-400 opacity-60'}`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${playerType === 'videojs' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-300'}`}></div>
                                مشغل مدمج
                            </button>
                        </div>
                    </div>

                    
                </div>
             </div>
             
             {/* Player — relative so the operator branding overlay anchors to the video box.
                 Fullscreen targets THIS wrapper (video + overlays), and each player's own
                 fullscreen button is disabled: the native one fullscreens only the video
                 element, which drops the branding overlays sitting beside it. */}
             <div ref={playerWrapRef} className="yalla-live-player-wrap relative w-full bg-black h-[300px] sm:h-auto sm:aspect-video">
                {playerType === 'plyr' ? (
                    <PlyrPlayer key={`plyr-${activeUrl}`} src={activeUrl} className="w-full h-full" disableFullscreen />
                ) : playerType === 'default' ? (
                    <InlinePlayer key={`inline-${activeUrl}`} src={activeUrl} className="w-full h-full" hideNativeFullscreen />
                ) : (
                    <VideoJSPlayer key={`vjs-${activeUrl}`} src={activeUrl} className="w-full h-full" disableFullscreen />
                )}
                {branding?.(selectedChannelName)}
                <PlayerControls wrapRef={playerWrapRef} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
             </div>
        </div>
    );
});

const RostersView: React.FC<{ details: MatchDetails, match: Match }> = React.memo(({ details, match }) => {
    // Real per-player goal/assist counts derived from the match timeline, used when
    // the lineup feed carries no stats. Name matching is containment-based because
    // event names ("م. صلاح") and lineup names ("محمد صلاح") often differ in form.
    const normName = (s: string) => (s || '').trim().toLowerCase();
    const namesMatch = (a: string, b: string) => {
        const x = normName(a); const y = normName(b);
        return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
    };
    const timeline = details.timeline || [];
    const goalsFromEvents = (name: string) =>
        timeline.filter(e => e.type === 'goal' && !e.isOwnGoal && !e.isPenaltyShootout && namesMatch(e.playerIn, name)).length;
    const assistsFromEvents = (name: string) =>
        timeline.filter(e => e.type === 'goal' && !!e.assist && namesMatch(e.assist!, name)).length;

    // Merge feed stats with event-derived counts. Ratings are shown only when the
    // data source provides one — no fabricated defaults.
    const realStats = (p: Player) => ({
        goals: p.stats?.goals || goalsFromEvents(p.name),
        assists: p.stats?.assists || assistsFromEvents(p.name),
        rating: p.stats?.rating || 0,
    });

    // Event decorations (broadcast-style icons): substitution in/out with minute,
    // and yellow/red cards — all read from the real timeline.
    const eventMinute = (e: typeof timeline[number]) => e.minute + (e.extraTime || 0);
    const subOffFor = (name: string) => {
        const e = timeline.find(ev => ev.type === 'substitution' && !!ev.playerOut && namesMatch(ev.playerOut!, name));
        return e ? { minute: eventMinute(e) } : undefined;
    };
    const subOnFor = (name: string) => {
        const e = timeline.find(ev => ev.type === 'substitution' && namesMatch(ev.playerIn, name));
        return e ? { minute: eventMinute(e), forName: e.playerOut || '' } : undefined;
    };
    const cardsFor = (name: string) => {
        const yellow = timeline.filter(ev => ev.type === 'yellow-card' && namesMatch(ev.playerIn, name)).length;
        const red = timeline.filter(ev => ev.type === 'red-card' && namesMatch(ev.playerIn, name)).length;
        return yellow || red ? { yellow, red } : undefined;
    };
    // One decorated copy of a player, shared by pitch, list and bench rendering.
    const decorate = (p: Player): Player => ({
        ...p,
        stats: realStats(p),
        subOff: subOffFor(p.name),
        subOn: subOnFor(p.name),
        cards: cardsFor(p.name),
    });

    // Helper to position players based on formation (Simplified)
    // Returns VisualPlayer[]
    const getVisualPlayers = (players: Player[], formation: string = "4-3-3", isHome: boolean): VisualPlayer[] => {
        if (!players || players.length === 0) return [];

        const visuals: VisualPlayer[] = [];
        const sortedPlayers = [...players].sort((a, b) => {
            // Sort GK first
            if (a.position === 'GK' || a.position === 'Goalkeeper' || a.position === 'حارس مرمى') return -1;
            if (b.position === 'GK' || b.position === 'Goalkeeper' || b.position === 'حارس مرمى') return 1;
            return 0;
        });

        // Basic formation parsing
        const formParts = formation.split('-').map(Number);
        // Valid parts? e.g. [4, 3, 3]
        const isValidFormation = formParts.length >= 3 && formParts.reduce((a,b) => a+b, 0) === 10;
        
        const rows = isValidFormation ? formParts : [4, 3, 3]; // Default rows excluding GK
        
        // GK
        const gk = sortedPlayers[0];
        if (gk) {
            // Updated: GK at top (y=12) instead of bottom
            const gkDecorated = decorate(gk);
            visuals.push({ ...gkDecorated, x: 50, y: 12, rating: gkDecorated.stats?.rating || 0 });
        }

        let playerIndex = 1;
        
        // Distribute other players in rows
        // Updated: Y positions: Defense starts at startY (near GK), Attack at endY (bottom)
        const startY = 32;
        const endY = 85;
        const stepY = (endY - startY) / (rows.length - 1 || 1);

        rows.forEach((count, rowIndex) => {
            const y = startY + (rowIndex * stepY);
            for (let i = 0; i < count; i++) {
                if (playerIndex >= sortedPlayers.length) break;
                const p = sortedPlayers[playerIndex];
                
                // Distribute X evenly
                // range x: 10 -> 90
                const spread = 90;
                // gap = spread / (count - 1)? If count 1 -> center.
                let x = 50;
                if (count > 1) {
                    x = (100 / (count + 1)) * (i + 1);
                }
                
                const pDecorated = decorate(p);
                visuals.push({ ...pDecorated, x, y, rating: pDecorated.stats?.rating || 0 });
                playerIndex++;
            }
        });

        // Add any remaining players to bench or random slots if roster > 11? 
        // Usually lineupHome is starters (11).
        
        return visuals;
    };
    
    const homeVisuals = getVisualPlayers(details.lineupHome, details.formationHome, true);
    const awayVisuals = getVisualPlayers(details.lineupAway, details.formationAway, false);
    
    if (homeVisuals.length === 0 && awayVisuals.length === 0) {
        return <div className="p-10 text-center text-gray-500 font-bold">التشكيلات غير متاحة حالياً</div>;
    }

    return (
        <SoccerLineup 
            homeTeam={{
                name: match.teamA.name,
                logoUrl: match.teamA.logoUrl,
                players: homeVisuals,
                substitutes: (details.benchHome || []).map(decorate),
                formation: details.formationHome,
                coach: details.homeCoach
            }}
            awayTeam={{
                name: match.teamB.name,
                logoUrl: match.teamB.logoUrl,
                players: awayVisuals,
                substitutes: (details.benchAway || []).map(decorate),
                formation: details.formationAway,
                coach: details.awayCoach
            }}
        />
    );
});

// --- MAIN COMPONENT ---
const MatchDetailView: React.FC<MatchDetailViewProps> = ({ match, onBack }) => {
  const { fetchWithCache } = useCache();
  const [now, setNow] = useState(() => getServerNow());
  useEffect(() => {
    const interval = setInterval(() => setNow(getServerNow()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Determine if stream is available
  const minutesToStart = (new Date(match.utcDate).getTime() - now) / 60000;
  
  const isStartsSoon = match.status === MatchStatus.UPCOMING && minutesToStart <= 30;
  const isLive = match.status === MatchStatus.LIVE || match.status === MatchStatus.HALF_TIME;
  const isRecentlyFinished = match.status === MatchStatus.FINISHED && minutesToStart > -140;

  // Dev-only: always show the Live tab so the player can be tested without waiting
  // for a real live/starts-soon/recently-finished match.
  const isStreamAvailable = import.meta.env.DEV || isLive || isStartsSoon || isRecentlyFinished;

  // Set default tab to liveStream if available, otherwise details
  const [activeTab, setActiveTab] = useState(isStreamAvailable ? 'liveStream' : 'details');
  
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDetails = async (isInitial = false) => {
      if (isInitial && isMounted) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await fetchMatchDetails(match);
        if (isMounted) {
          setDetails(data);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error fetching match details:", err);
          setError("فشل في تحميل تفاصيل المباراة.");
          setLoading(false);
        }
      }
    };

    loadDetails(true);
    
    // Smart polling: Faster for live matches, slower for others
    const getPollInterval = () => {
        if (match.status === MatchStatus.LIVE || match.status === MatchStatus.HALF_TIME) return 15000;
        if (match.status === MatchStatus.FINISHED) return 120000; // 2 minutes for finished
        return 60000; // 1 minute for upcoming
    };

    const intervalId = setInterval(() => loadDetails(false), getPollInterval());

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [match.id, match]);

  // Score update animation logic
  const [scoreChanged, setScoreChanged] = useState(false);
  const prevScore = useRef({ a: match.scoreA, b: match.scoreB });

  useEffect(() => {
      if (match.scoreA !== prevScore.current.a || match.scoreB !== prevScore.current.b) {
          prevScore.current = { a: match.scoreA, b: match.scoreB };
          const scoreTimer = setTimeout(() => setScoreChanged(true), 0);
          const animTimer = setTimeout(() => setScoreChanged(false), 1500);
          
          return () => {
              clearTimeout(scoreTimer);
              clearTimeout(animTimer);
          };
      }
  }, [match.scoreA, match.scoreB]);

  const renderTabContent = () => {
    if (loading) return <DetailContentSkeleton />;
    if (error) return <div className="p-10 text-center text-red-500">{error}</div>;
    if (!details) return null;

    switch (activeTab) {
        case 'liveStream': {
            let channelName = details.matchInfo?.channel || match.channel;
            const isAFCONU17 = match.league === 'كأس أمم إفريقيا تحت 17' || match.league.includes('إفريقيا تحت 17') || match.league.includes('امم افريقيا تحت 17');
            const isThroneCup = match.league === 'كأس العرش المغربي' || match.league.includes('كأس العرش');
            
            if (isThroneCup) {
                channelName = ["ARRYADIA TNT HD", "ALAOULA TNT HD", "2M TNT HD", "TAMAZIGHT HD", "AL MAGHRIBIA HD"];
            } else if (isAFCONU17) {
                channelName = ["beIN Sports 5", "ARRYADIA TNT HD"];
            } else if (match.league.includes('كأس ملك إسبانيا') || match.league.includes('Copa del Rey')) {
                channelName = 'MBC Masr 2';
            }
            // Admin-configured servers (Fabor-style watch section) take priority; the
            // legacy channel-matching player renders as its fallback when none are set.
            return (
                <LiveStreamHub
                    key={`hub-${match.id}`}
                    match={match}
                    fallback={<LiveStreamView key={Array.isArray(channelName) ? channelName.join(',') : channelName} channel={channelName} />}
                />
            );
        }
        case 'details': return <DetailsTabView match={match} details={details} />;
        case 'rosters': return <RostersView details={details} match={match}/>;
        case 'stats': return <StatisticsView details={details} />;
        case 'highlights': return (
            <div className="p-4 space-y-6">
                <MatchHighlights match={match} enabled={true} timeline={details.timeline} />
                <MatchTimelineSummary match={match} details={details} enabled={true} />
            </div>
        );
        default: return null;
    }
  };

  const leagueLogo = match.leagueLogoUrl || getLeagueLogo(match.league);  
  const displayScoreA = details?.scoreA !== undefined ? details.scoreA : match.scoreA;
  const displayScoreB = details?.scoreB !== undefined ? details.scoreB : match.scoreB;
  const displayStatusText = details?.statusText || match.statusText;
  // Goal scorers shown right under the score — home on the home side, away on the
  // away side, each with the scorer's name and the minute it went in.
  const headerHomeGoals = details?.homeGoals || [];
  const headerAwayGoals = details?.awayGoals || [];

  // Header state lives entirely in the centre ring: it holds kick-off time
  // before the whistle, the running period while the match is live, and the
  // final marker once it's over. The card stays paper in every state.
  const isLiveState = isLive;
  const isFinished = match.status === MatchStatus.FINISHED;
  const hasKickedOff = isLiveState || isFinished;
  const kickoffClock = useMemo(() => {
      try {
          return new Intl.DateTimeFormat('en-GB', { timeZone: USER_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false })
              .format(parseUtcDate(match.utcDate));
      } catch { return match.time || ''; }
  }, [match.utcDate, match.time]);
  const kickoffStamp = useMemo(() => {
      try {
          const d = parseUtcDate(match.utcDate);
          const day = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { timeZone: USER_TIMEZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(d);
          return `${day} - ${kickoffClock}`;
      } catch { return ''; }
  }, [match.utcDate, kickoffClock]);
  const stadiumName = details?.matchInfo?.stadium || match.stadium || '';
  const roundName = details?.matchInfo?.round || match.round || '';
  // Shoot-out result, when a tie actually went to penalties — the only score
  // that outranks the 90-minute one, so it gets its own line under the numerals.
  const penalties = isFinished
      && details?.penaltyScoreA !== undefined && details?.penaltyScoreB !== undefined
      && (details.penaltyScoreA > 0 || details.penaltyScoreB > 0)
      ? `${details.penaltyScoreA} - ${details.penaltyScoreB}`
      : '';
  // Ring label. The ring is small, so a live match shows the minute when the
  // feed gives one ("63'") and a two-character period token when it doesn't.
  const liveRingLabel = useMemo(() => {
      const text = displayStatusText || '';
      const minute = text.match(/\d+/)?.[0];
      if (minute) return `${minute}'`;
      if (text.includes('الأول')) return 'ش1';
      if (text.includes('الثاني')) return 'ش2';
      if (text.includes('استراحة') || text.includes('الشوطين')) return 'راحة';
      return 'مباشر';
  }, [displayStatusText]);
  const ringLabel = isLiveState ? liveRingLabel : isFinished ? 'انتهت' : kickoffClock;

  return (
    <div className="py-0 sm:py-4 animate-fadeInUp w-full sm:mx-auto max-w-[1280px] relative match-detail-canvas">
       {/* Match header.
           One paper surface in every state — the centre ring is what carries the
           clock: kick-off time before the whistle, the running period while the
           match is live, "انتهت" once it's over. The leading side's numeral is the
           only coloured number, so the result reads before the text does. */}
       <div className="rounded-none sm:rounded-[28px] overflow-hidden relative mb-2 w-full border border-gray-100 bg-[#f5f6f7] text-gray-900 shadow-[0_10px_34px_rgba(15,23,42,0.07)]">
          {/* Silk wave field */}
          <div
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
              style={{ backgroundImage: `url(${headerWaves})` }}
          />
          <div className="relative z-10 flex flex-col items-center gap-4 sm:gap-6 px-3 py-4 sm:px-6 sm:py-7">

              {/* Competition — league and round joined in a single pill */}
              <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 max-w-full bg-white/90 backdrop-blur-sm border border-white shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
                  <span className="font-black text-[11px] sm:text-sm leading-none text-center truncate">
                      {roundName ? `${translateLeague(match.league)} | ${translateLeague(roundName)}` : translateLeague(match.league)}
                  </span>
                  <span className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shrink-0">
                      <OptimizedImage
                          src={leagueLogo}
                          alt={match.league}
                          width={24}
                          className="w-full h-full object-contain"
                          fallbackElement={<TrophyIcon className="w-3.5 h-3.5 text-amber-400" />}
                      />
                  </span>
              </div>

              {/* Teams either side, scores flanking the status/clock ring */}
              <div className="w-full max-w-3xl flex items-start justify-between gap-2 sm:gap-4" dir="rtl">
                  {/* Team A (home) — right side: logo on top, name below */}
                  <div className="flex-1 flex flex-col items-center justify-start gap-2 min-w-0">
                      <span className="w-11 h-11 sm:w-16 sm:h-16 shrink-0 rounded-2xl grid place-items-center p-1.5 sm:p-2 bg-white border border-white shadow-[0_6px_18px_rgba(15,23,42,0.08)]">
                          <OptimizedImage src={match.teamA.logoUrl} alt={match.teamA.name} width={64} loading="eager" className="w-full h-full object-contain" />
                      </span>
                      <span className="font-black text-[11px] sm:text-base leading-tight text-center line-clamp-2 min-w-0 w-full">{match.teamA.name}</span>
                  </div>

                  {/* Centre: scoreA · ring · scoreB */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
                      <span className="font-black text-3xl sm:text-4xl tabular-nums leading-none text-gray-900">{displayScoreA}</span>
                      <span className={`relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full grid place-items-center border-[3px] bg-white px-1 ${
                            isFinished
                              ? 'border-gray-300 shadow-[0_4px_14px_rgba(15,23,42,0.08)]'
                              : 'border-emerald-500 shadow-[0_4px_14px_rgba(16,185,129,0.18)]'
                          }`}>
                          {isLiveState && (
                              <span aria-hidden="true" className="absolute -inset-1 rounded-full border-2 border-emerald-400/40 animate-pulse motion-reduce:animate-none" />
                          )}
                          <span className="flex flex-col items-center gap-0.5 leading-none">
                              <span className={`font-black text-[9px] sm:text-[11px] text-center leading-tight ${isLiveState ? 'text-emerald-600' : 'text-gray-800'}`} dir={isLiveState ? 'rtl' : 'ltr'}>
                                  {isLiveState ? (displayStatusText || 'مباشر') : isFinished ? 'انتهت' : kickoffClock}
                              </span>
                              {isLiveState && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none" />
                              )}
                          </span>
                      </span>
                      <span className="font-black text-3xl sm:text-4xl tabular-nums leading-none text-gray-900">{displayScoreB}</span>
                  </div>

                  {/* Team B (away) — left side: logo on top, name below */}
                  <div className="flex-1 flex flex-col items-center justify-start gap-2 min-w-0">
                      <span className="w-11 h-11 sm:w-16 sm:h-16 shrink-0 rounded-2xl grid place-items-center p-1.5 sm:p-2 bg-white border border-white shadow-[0_6px_18px_rgba(15,23,42,0.08)]">
                          <OptimizedImage src={match.teamB.logoUrl} alt={match.teamB.name} width={64} loading="eager" className="w-full h-full object-contain" />
                      </span>
                      <span className="font-black text-[11px] sm:text-base leading-tight text-center line-clamp-2 min-w-0 w-full">{match.teamB.name}</span>
                  </div>
              </div>

              {/* Goal scorers — name + minute, home on the right, away on the left */}
              {(headerHomeGoals.length > 0 || headerAwayGoals.length > 0) && (
                  <div className="w-full max-w-3xl flex items-start justify-between gap-3 sm:gap-4" dir="rtl">
                      <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
                          {headerHomeGoals.map((g, i) => (
                              <span key={`hg-${i}-${g.minute}`} className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-gray-800 max-w-full">
                                  <span className="truncate">{g.scorerName}</span>
                                  <span className="text-emerald-600 tabular-nums shrink-0" dir="ltr">{g.minute}'</span>
                              </span>
                          ))}
                      </div>
                      <SoccerBallIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 shrink-0 mt-0.5" />
                      <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
                          {headerAwayGoals.map((g, i) => (
                              <span key={`ag-${i}-${g.minute}`} className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-gray-800 max-w-full">
                                  <span className="text-emerald-600 tabular-nums shrink-0" dir="ltr">{g.minute}'</span>
                                  <span className="truncate">{g.scorerName}</span>
                              </span>
                          ))}
                      </div>
                  </div>
              )}

              {penalties && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 border border-white px-2.5 py-1 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
                      <span className="text-[9px] sm:text-[10px] font-bold text-gray-500">ركلات الترجيح</span>
                      <span className="text-[10px] sm:text-xs font-black text-gray-900 tabular-nums" dir="ltr">{penalties}</span>
                  </span>
              )}

              {/* Where and when — stadium + date in a single pill */}
              {(stadiumName || kickoffStamp) && (
                  <div className="inline-flex items-center gap-2 sm:gap-3 rounded-full px-3.5 py-1.5 max-w-full bg-white/90 backdrop-blur-sm border border-white shadow-[0_4px_14px_rgba(15,23,42,0.06)] text-black" dir="rtl">
                      {stadiumName && (
                          <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold min-w-0">
                              <PinIcon className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                              <span className="truncate">{stadiumName}</span>
                          </span>
                      )}
                      {stadiumName && kickoffStamp && <span className="w-px h-3.5 bg-gray-300 shrink-0" />}
                      {kickoffStamp && (
                          <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold shrink-0">
                              <CalendarIcon className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                              <span dir="rtl">{kickoffStamp}</span>
                          </span>
                      )}
                  </div>
              )}
          </div>
       </div>

       <div className="bg-white shadow-[0_15px_40px_rgba(0,0,0,0.03)] overflow-hidden border-t sm:border border-gray-100 w-full">
            <div className="border-b flex bg-gray-50/30 overflow-x-auto no-scrollbar">
                {[
                    { id: 'liveStream', label: 'البث المباشر', available: isStreamAvailable },
                    { id: 'details', label: 'التفاصيل', available: true },
                    { id: 'rosters', label: 'التشكيلات', available: true },
                    { id: 'highlights', label: 'الأحداث', available: true },
                    { id: 'stats', label: 'الإحصائيات', available: true }
                ]
                .filter(tab => tab.available)
                .map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id)} 
                        className={`flex-none sm:flex-1 px-4 sm:px-0 py-3 sm:py-5 text-xs sm:text-sm font-black transition-all duration-400 border-b-[3px] whitespace-nowrap ${
                            activeTab === tab.id
                            ? 'border-emerald-600 text-black bg-white'
                            : 'border-transparent text-black hover:bg-white/50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="min-h-[500px]">{renderTabContent()}</div>
       </div>
    </div>
  );
};

export default React.memo(MatchDetailView);
