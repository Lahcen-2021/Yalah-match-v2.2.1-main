
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

    return (
        <div className="py-4 font-tajawal max-w-3xl mx-auto px-4">
            {/* View Header */}
            <div className="flex flex-col items-center mb-4 text-center">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-1 tracking-tight">البطولات والمنافسات</h2>
                <div className="h-0.5 w-12 bg-emerald-600 rounded-full shadow-sm"></div>
            </div>
            
            {loadingLeagues ? (
                <div className="space-y-2">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="h-12 bg-gray-100 rounded-xl animate-shimmer"></div>
                    ))}
                </div>
            ) : leagues.length === 0 ? (
                 <div className="text-center py-10 bg-gray-50 rounded-[30px] border-2 border-dashed border-gray-200 text-gray-400 max-w-md mx-auto">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="font-black text-md">لم يتم العثور على أي بطولة حالياً</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {leagues.map((league, index) => (
                        <div
                            key={league.id}
                            className="group flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 transition-all duration-300 hover:shadow-md hover:border-emerald-100 cursor-pointer animate-fadeInUp"
                            style={{ animationDelay: `${index * 0.02}s` }}
                            onClick={() => handleLeagueClick(league)}
                        >
                            <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center p-1 group-hover:bg-emerald-50 transition-colors duration-300">
                                <OptimizedImage
                                    src={league.logoUrl}
                                    alt={league.name}
                                    width={24}
                                    className="w-full h-full object-contain"
                                    fallbackElement={<TrophyFallbackIcon />}
                                />
                            </div>
                            <p className="font-bold text-gray-800 text-sm">
                                {translateLeague(league.name)}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TournamentsView;
