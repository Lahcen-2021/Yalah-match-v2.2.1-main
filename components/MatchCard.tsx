
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Match, MatchStatus } from '../types';
import { generateMatchSlug, getShortLeagueName, getChannelLogo, getLeagueLogo, isMajorLeague } from '../utils/translations';
import OptimizedImage from './OptimizedImage';
import { fetchMatchChannel, fetchMatchesByDate, USER_TIMEZONE, parseUtcDate, getServerNow } from '../services/api';
import { useCache } from '../context/CacheContext';

interface MatchCardProps {
  match: Match;
  index: number;
  onClick?: (match: Match) => void;
  isTomorrow?: boolean;
}

// Resolves once the page has finished its initial load. Per-card channel lookups wait on this so
// their (heavy, multi-source) network fan-out never competes with the eager LCP team logo — letting
// the largest image paint before the channel storm starts. Shared across all cards (one listener).
let pageLoadedPromise: Promise<void> | null = null;
const afterPageLoad = (): Promise<void> => {
    if (pageLoadedPromise) return pageLoadedPromise;
    pageLoadedPromise = (typeof document === 'undefined' || document.readyState === 'complete')
        ? Promise.resolve()
        : new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
    return pageLoadedPromise;
};

const Box = ({ value, label }: { value: string; label: string }) => (
    <div className="flex flex-col items-center">
        <div className="bg-gray-100 text-gray-700 border border-gray-200 font-bold text-[10px] sm:text-xs w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-md shadow-sm">
            {value}
        </div>
        <span className="text-[8px] text-gray-600 mt-0.5 font-tajawal font-medium">{label}</span>
    </div>
);

const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
    const [timeLeft, setTimeLeft] = useState(() => {
        const target = parseUtcDate(targetDate).getTime();
        if (isNaN(target)) return { d: '00', h: '00', m: '00', s: '00' };
        const diff = target - getServerNow();
        if (diff <= 0) return { d: '00', h: '00', m: '00', s: '00' };
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        return {
            d: d.toString().padStart(2, '0'),
            h: h.toString().padStart(2, '0'),
            m: m.toString().padStart(2, '0'),
            s: s.toString().padStart(2, '0')
        };
    });

    useEffect(() => {
        const calculate = () => {
            const now = getServerNow();
            const target = parseUtcDate(targetDate).getTime();

            if (isNaN(target)) {
                return { d: '00', h: '00', m: '00', s: '00' };
            }

            const diff = target - now;

            if (diff <= 0) {
                return { d: '00', h: '00', m: '00', s: '00' };
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / (1000 * 60)) % 60);
            const s = Math.floor((diff / 1000) % 60);

            return {
                d: d.toString().padStart(2, '0'),
                h: h.toString().padStart(2, '0'),
                m: m.toString().padStart(2, '0'),
                s: s.toString().padStart(2, '0')
            };
        };

        const interval = setInterval(() => setTimeLeft(calculate()), 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    return (
        <div className="flex items-center gap-1 mt-1" dir="ltr">
            {parseInt(timeLeft.d) > 0 && <Box value={timeLeft.d} label="يوم" />}
            <Box value={timeLeft.h} label="ساعة" />
            <Box value={timeLeft.m} label="دقيقة" />
            <Box value={timeLeft.s} label="ثانية" />
        </div>
    );
};

const ScreenIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="4" width="18" height="12" rx="2.5" />
        <path d="M12 16v4" />
        <path d="M8 20h8" />
    </svg>
);

const TrophyIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15l-2 5h4l-2-5z" />
    </svg>
);

const MatchCard: React.FC<MatchCardProps> = ({ match, index, onClick, isTomorrow = false }) => {
    const { fetchWithCache } = useCache();

    const isLive = match.status === MatchStatus.LIVE;
    const isHalftime = match.status === MatchStatus.HALF_TIME;
    const isFinished = match.status === MatchStatus.FINISHED;
    const isUpcoming = match.status === MatchStatus.UPCOMING;
    
    const [displayChannel, setDisplayChannel] = useState<any>(() => {
        const isAFCONU17 = match.league === 'كأس أمم إفريقيا تحت 17' || match.league.includes('إفريقيا تحت 17') || match.league.includes('امم افريقيا تحت 17');
        const isThroneCup = match.league === 'كأس العرش المغربي' || match.league.includes('كأس العرش');
        
        if (isThroneCup) return ["ARRYADIA TNT HD", "ALAOULA TNT HD", "2M TNT HD", "TAMAZIGHT HD", "AL MAGHRIBIA HD"];
        return isAFCONU17 ? ["beIN Sports 5", "ARRYADIA TNT HD"] : (match.channel || null);
    });

    useEffect(() => {
        const isAFCONU17 = match.league === 'كأس أمم إفريقيا تحت 17' || match.league.includes('إفريقيا تحت 17') || match.league.includes('امم افريقيا تحت 17');
        const isThroneCup = match.league === 'كأس العرش المغربي' || match.league.includes('كأس العرش');
        
        if (isAFCONU17 || isThroneCup) return;

        let isMounted = true;
        const getChannel = async () => {
             try {
                 const detailedChannel = await fetchWithCache(
                     `channel-${match.id}`,
                     () => fetchMatchChannel(match.id, match.teamA.name, match.teamB.name, match.utcDate),
                     3600000
                 );
                 if (isMounted && detailedChannel) {
                     setDisplayChannel(detailedChannel);
                 }
             } catch (error) {
                 console.warn("Failed to fetch channel info", error);
             }
        };

        // Each card's lookup fans out to four upstream sources (Kooora, beIN, messisporat,
        // LiveOnSat). Firing them on mount floods the network and starves the LCP team logo, so we
        // wait until after the page load event, then run on idle. The basic match.channel already
        // renders immediately — this only upgrades it once the critical content has painted.
        const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout: number }) => number);
        const cic = (window as any).cancelIdleCallback as undefined | ((h: number) => void);
        let idleHandle: number | undefined;

        afterPageLoad().then(() => {
            if (!isMounted) return;
            idleHandle = ric
                ? ric(() => { getChannel().catch(() => {}); }, { timeout: 4000 })
                : window.setTimeout(() => { getChannel().catch(() => {}); }, 600);
        });

        return () => {
            isMounted = false;
            if (idleHandle === undefined) return;
            if (ric && cic) cic(idleHandle);
            else clearTimeout(idleHandle);
        };
    }, [match.id, match.teamA.name, match.teamB.name, match.utcDate, match.league, fetchWithCache]);

    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpanded = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsExpanded(prev => !prev);
    }, []);

    const matchSlug = generateMatchSlug(match.teamA.name, match.teamB.name, match.utcDate);

    const [now, setNow] = useState(() => getServerNow());
    useEffect(() => {
        // Only run timer for upcoming matches to save battery
        if (match.status !== MatchStatus.UPCOMING) return;
        
        const interval = setInterval(() => {
            setNow(getServerNow());
        }, 60000);
        return () => clearInterval(interval);
    }, [match.status]);

    const diffMins = (new Date(match.utcDate).getTime() - now) / 60000;
    const isSoon = isUpcoming && diffMins > 0 && diffMins <= 30;
    const isStartedByTime = isUpcoming && diffMins <= 0;

    const [scoreChanged, setScoreChanged] = useState(false);
    const prevScore = useRef({ a: match.scoreA, b: match.scoreB });

    useEffect(() => {
        if (match.scoreA !== prevScore.current.a || match.scoreB !== prevScore.current.b) {
            const scoreTimer = setTimeout(() => setScoreChanged(true), 0);
            prevScore.current = { a: match.scoreA, b: match.scoreB };
            const timer = setTimeout(() => setScoreChanged(false), 1500);
            return () => {
                clearTimeout(scoreTimer);
                clearTimeout(timer);
            };
        }
    }, [match.scoreA, match.scoreB]);

    const matchTimeLocal = useMemo(() => {
        if (!match.utcDate) return match.time || "غير محدد";
        const dateObj = parseUtcDate(match.utcDate);
        if (isNaN(dateObj.getTime())) return match.time || "غير محدد";
        return dateObj.toLocaleTimeString('en-GB', { timeZone: USER_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false });
    }, [match.utcDate, match.time]);

    const getStatusText = () => {
        if (isHalftime) return "الإستراحة";
        if (isLive) return match.statusText || "مباشر";
        if (isSoon) return "تبدأ قريباً";
        if (isStartedByTime) return "مباشر";
        return match.statusText || 'لم تبدأ';
    };

    const statusText = getStatusText();
    let statusColor = "bg-gray-100 text-gray-600 border-gray-200";
    let scoreDisplay = null;

    if (isLive || isStartedByTime) {
        statusColor = "bg-red-50 text-red-600 border-red-100 animate-pulse";
        scoreDisplay = <span className="text-lg sm:text-xl font-black text-gray-900 tracking-wider leading-none" dir="ltr">{match.scoreB} - {match.scoreA}</span>;
    } else if (isHalftime) {
        statusColor = "bg-orange-50 text-orange-600 border-orange-100";
        scoreDisplay = <span className="text-lg sm:text-xl font-black text-gray-900 tracking-wider leading-none" dir="ltr">{match.scoreB} - {match.scoreA}</span>;
    } else if (isFinished) {
         statusColor = "bg-gray-100 text-gray-600 border-gray-200";
         if (match.statusText.includes('مؤجلة') || match.statusText.includes('تأجلت')) {
             scoreDisplay = <span className="text-base sm:text-lg font-black text-gray-900 leading-none">مؤجلة</span>;
         } else {
             scoreDisplay = <span className="text-lg sm:text-xl font-black text-gray-900 tracking-wider leading-none" dir="ltr">{match.scoreB} - {match.scoreA}</span>;
         }
    } else if (isSoon) {
         statusColor = "bg-yellow-50 text-yellow-700 border-yellow-100 animate-yellow-flash";
         scoreDisplay = <span className="text-base sm:text-lg font-black text-gray-900 dir-ltr leading-none">{matchTimeLocal}</span>;
    } else {
         statusColor = "bg-green-50 text-green-600 border-green-100";
         scoreDisplay = <span className="text-base sm:text-lg font-black text-gray-900 dir-ltr leading-none">{matchTimeLocal}</span>;
    }

    const getChannelName = (ch: any): string => {
        if (!ch) return '';
        return typeof ch === 'string' ? ch : (ch.name || '');
    };

    const firstChannel = Array.isArray(displayChannel) ? displayChannel[0] : displayChannel;
    const firstChannelName = getChannelName(firstChannel);
    
    const channelLogo = (typeof firstChannel === 'object' && firstChannel?.logo) 
        ? firstChannel.logo 
        : getChannelLogo(firstChannelName);
    const leagueLogo = match.leagueLogoUrl || getLeagueLogo(match.league) || null;
    const isAFCON = match.league.includes('أمم إفريقيا') || match.league.includes('الأمم الإفريقية');

    const handleCardClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        
        if (onClick) {
            onClick(match);
        } else {
            try {
                window.history.pushState({ match: match }, '', matchSlug);
                window.dispatchEvent(new PopStateEvent('popstate'));
            } catch (err) {
                console.warn("Navigation history update failed (ignoring):", err);
            }
        }
    }, [match, onClick, matchSlug]);

    return (
        <div 
            onClick={handleCardClick}
            className="block group bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden transition-all duration-300 ease-out cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-emerald-200"
            style={{ backfaceVisibility: 'hidden' }}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(e as any);
                }
            }}
        >
            <div className="px-2 py-2 sm:px-3 sm:py-2.5 border-b border-gray-200 flex justify-between items-center bg-[#f8f9fa] group-hover:bg-white transition-colors duration-300">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 justify-start">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`${isAFCON ? 'w-7 h-7 sm:w-9 sm:h-9' : 'w-5 h-5 sm:w-6 sm:h-6'} flex-shrink-0 flex items-center justify-center`}>
                            <OptimizedImage 
                                src={leagueLogo} 
                                alt={match.league} 
                                width={48} 
                                loading="lazy"
                                className="w-full h-full object-contain drop-shadow-[0_0_2px_rgba(0,0,0,0.4)]" 
                                fallbackElement={<TrophyIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />}
                            />
                        </div>
                    </div>
                    <span className="text-[10px] sm:text-xs md:text-sm font-bold sm:truncate whitespace-pre-line leading-normal sm:leading-tight text-gray-700 group-hover:text-black">
                        <span className="sm:hidden">{getShortLeagueName(match.league)}</span>
                        <span className="hidden sm:inline">{match.league}</span>
                    </span>
                </div>

                <div className="mx-1 sm:mx-5 flex-shrink-0">
                    <span className={`text-[9px] sm:text-[10px] font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border shadow-sm whitespace-nowrap block ${statusColor}`}>
                        {statusText}
                    </span>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0 justify-end flex-wrap cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleExpanded(e); }}>
                    {Array.isArray(displayChannel) ? (
                        <div className="flex items-center gap-1 bg-white/50 px-1 py-0.5 rounded-md border border-gray-100">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 flex items-center justify-center">
                                {channelLogo ? (
                                    <OptimizedImage 
                                        src={channelLogo} 
                                        alt={firstChannelName} 
                                        width={20} 
                                        loading="lazy"
                                        className="w-full h-full object-contain" 
                                    />
                                ) : (
                                    <ScreenIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                                )}
                            </div>
                            <span className="text-[9px] sm:text-xs font-bold text-gray-700 group-hover:text-black truncate max-w-[80px] sm:max-w-[120px]" dir="ltr">
                                {firstChannelName || 'غير محدد'}
                            </span>
                            {displayChannel.length > 1 && (
                                <span className="text-[9px] sm:text-[10px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                    +{displayChannel.length - 1}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 bg-white/50 px-1.5 py-0.5 rounded-md border border-gray-100">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 flex items-center justify-center">
                                {channelLogo ? (
                                    <OptimizedImage 
                                        src={channelLogo} 
                                        alt={firstChannelName} 
                                        width={20} 
                                        loading="lazy"
                                        className="w-full h-full object-contain" 
                                    />
                                ) : (
                                    <ScreenIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                                )}
                            </div>
                            <span className="text-[9px] sm:text-xs font-bold text-gray-700 group-hover:text-black truncate max-w-[100px] sm:max-w-[150px]" dir="ltr">
                                {firstChannelName || 'غير محدد'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-1.5 sm:p-3 relative">
                <div className="flex items-center justify-between">
                    <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-8 h-8 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-gray-50/50">
                            <OptimizedImage
                                src={match.teamA.logoUrl}
                                alt={match.teamA.name}
                                width={44}
                                loading={index === 0 ? 'eager' : 'lazy'}
                                fetchPriority={index === 0 ? 'high' : undefined}
                                className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-500"
                            />
                        </div>
                        <div className="h-7 flex items-center justify-center gap-1 px-0.5">
                            <span className="font-bold text-[10px] sm:text-[12px] text-gray-800 text-center leading-tight">
                                {match.teamA.name}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center w-[4.5rem] sm:w-32 shrink-0 relative z-10 mx-0.5">
                         <div className={`bg-white border border-gray-100 shadow-sm rounded-lg px-2 py-1 flex items-center justify-center min-w-[54px] sm:min-w-[60px] transition-all duration-300 group-hover:border-green-200 ${scoreChanged ? 'score-update-flash bg-green-50 border-green-400' : ''}`}>
                            {scoreDisplay}
                         </div>
                         {(isUpcoming && !isStartedByTime) && (
                            <div className="flex flex-col items-center w-full">
                                <span className="text-[7px] sm:text-[8px] text-gray-600 mt-1 font-bold">توقيت المغرب</span>
                                <CountdownTimer targetDate={match.utcDate} />
                            </div>
                         )}
                    </div>

                    <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-8 h-8 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-gray-50/50">
                            <OptimizedImage
                                src={match.teamB.logoUrl}
                                alt={match.teamB.name}
                                width={44}
                                loading={index === 0 ? 'eager' : 'lazy'}
                                fetchPriority={index === 0 ? 'high' : undefined}
                                className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-500"
                            />
                        </div>
                        <div className="h-7 flex items-center justify-center gap-1 px-0.5">
                            <span className="font-bold text-[10px] sm:text-[12px] text-gray-800 text-center leading-tight">
                                {match.teamB.name}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-center gap-3 sm:gap-6">
                    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-gray-600 group-hover:text-emerald-600 transition-colors">
                        <InfoIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span>التفاصيل</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-gray-600 group-hover:text-emerald-600 transition-colors">
                        <UsersIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span>التشكيلات</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-gray-600 group-hover:text-emerald-600 transition-colors">
                        <BarChartIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span>الإحصائيات</span>
                    </div>
                </div>
                
                {isExpanded && displayChannel && (
                    <div className="mt-2 pt-2 border-t border-gray-100 bg-gray-50/50 rounded-b-lg p-2">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {Array.isArray(displayChannel) ? displayChannel.map((ch, idx) => {
                                const chName = typeof ch === 'string' ? ch : ch.name;
                                const chLogo = typeof ch === 'object' && ch.logo ? ch.logo : getChannelLogo(chName);
                                const chUrl = typeof ch === 'object' ? ch.url : undefined;

                                const content = (
                                    <div key={idx} className={`flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm ${chUrl ? 'hover:border-emerald-300 hover:bg-emerald-50 transition-all' : ''}`}>
                                        <div className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 flex items-center justify-center">
                                            {chLogo ? (
                                                <OptimizedImage src={chLogo} alt={chName} width={20} className="w-full h-full object-contain" />
                                            ) : (
                                                <ScreenIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                                            )}
                                        </div>
                                        <span className="text-[9px] sm:text-xs font-bold text-gray-700 whitespace-nowrap" dir="ltr">{chName}</span>
                                        {chUrl && (
                                            <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        )}
                                    </div>
                                );

                                return chUrl ? (
                                    <a 
                                        key={idx} 
                                        href={chUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="no-underline"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {content}
                                    </a>
                                ) : content;
                            }) : (
                                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm">
                                    <div className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 flex items-center justify-center">
                                        {channelLogo ? (
                                            <OptimizedImage src={channelLogo} alt={firstChannelName} width={20} className="w-full h-full object-contain" />
                                        ) : (
                                            <ScreenIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                                        )}
                                    </div>
                                    <span className="text-[9px] sm:text-xs font-bold text-gray-700 whitespace-nowrap" dir="ltr">{firstChannelName}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const InfoIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const BarChartIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

export default React.memo(MatchCard);
