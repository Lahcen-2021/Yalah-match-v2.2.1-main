
import React, { useState, useEffect } from 'react';
import { fetchYanb8Leagues, Yanb8League } from '../services/api';
import { translateLeague } from '../utils/translations';
import OptimizedImage from './OptimizedImage';

const TrophyFallbackIcon = () => (
    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
);
import { useCache } from '../context/CacheContext';

interface TournamentsViewProps {
    onLeagueSelect?: (id: string) => void;
}

const CompetitionsSkeleton: React.FC = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[...Array(18)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                <div className="h-14 w-14 mx-auto bg-gray-100 rounded-full animate-shimmer"></div>
                <div className="h-4 w-3/4 mx-auto bg-gray-100 rounded animate-shimmer"></div>
            </div>
        ))}
    </div>
);

const TournamentsView: React.FC<TournamentsViewProps> = ({ onLeagueSelect }) => {
    const { fetchWithCache } = useCache();
    const [leagues, setLeagues] = useState<Yanb8League[]>([]);
    const [loadingLeagues, setLoadingLeagues] = useState(true);
    const [query, setQuery] = useState('');

    useEffect(() => {
        const loadLeagues = async () => {
            try {
                setLoadingLeagues(true);
                // Cache for 1 hour
                const data = await fetchWithCache('yanb8-leagues', fetchYanb8Leagues, 3600000);
                setLeagues(data);
            } catch (err) {
                console.error('Failed to load leagues:', err);
            } finally {
                setLoadingLeagues(false);
            }
        };
        loadLeagues();
    }, [fetchWithCache]);

    const handleLeagueClick = (league: Yanb8League) => {
        if (onLeagueSelect) {
            onLeagueSelect(league.id);
        }
    };

    const q = query.trim();
    const filtered = q
        ? leagues.filter(l => translateLeague(l.name).includes(q) || l.name.toLowerCase().includes(q.toLowerCase()))
        : leagues;

    return (
        <div className="py-4 font-tajawal max-w-6xl mx-auto px-4">
            {/* Header banner with breadcrumb + search */}
            <div className="bg-[#f8f9fa] rounded-[24px] p-5 sm:p-7 mb-6 border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="text-right">
                        <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">دوريات وبطولات</h2>
                        <p className="text-xs font-bold text-gray-400 mt-1">الرئيسية / الترتيب</p>
                    </div>
                    <div className="relative w-full md:w-72">
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="ابحث بالدوري .."
                            className="w-full bg-white border border-gray-200 rounded-full py-2.5 pr-10 pl-4 text-sm font-bold text-gray-700 text-right placeholder:text-gray-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                        />
                    </div>
                </div>
            </div>

            {loadingLeagues ? (
                <CompetitionsSkeleton />
            ) : filtered.length === 0 ? (
                 <div className="text-center py-10 bg-gray-50 rounded-[30px] border-2 border-dashed border-gray-200 text-gray-400 max-w-md mx-auto">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="font-black text-md">{q ? 'لا توجد نتائج مطابقة' : 'لم يتم العثور على أي بطولة حالياً'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {filtered.map((league, index) => (
                        <button
                            key={league.id}
                            className="group flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-gray-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-200 cursor-pointer animate-fadeInUp"
                            style={{ animationDelay: `${Math.min(index, 20) * 0.02}s` }}
                            onClick={() => handleLeagueClick(league)}
                        >
                            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center p-2.5 group-hover:bg-emerald-50 transition-colors duration-300">
                                <OptimizedImage
                                    src={league.logoUrl}
                                    alt={league.name}
                                    width={56}
                                    className="w-full h-full object-contain"
                                    fallbackElement={<TrophyFallbackIcon />}
                                />
                            </div>
                            <p className="font-bold text-gray-800 text-xs sm:text-sm text-center leading-tight group-hover:text-emerald-700 transition-colors">
                                {translateLeague(league.name)}
                            </p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TournamentsView;
