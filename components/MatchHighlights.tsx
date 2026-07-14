
import React, { useState, useEffect } from 'react';
import { Match, GoalEvent, TimelineEvent } from '../types';
import { fetchMatchHighlights } from '../services/api';
import { motion } from 'motion/react';

interface MatchHighlightsProps {
  match: Match;
  enabled: boolean;
  timeline?: TimelineEvent[];
}

const SoccerBallIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c1.33 0 2.57.33 3.66.91l-1.39 2.14c-.16.25-.43.4-.72.4h-3.1c-.29 0-.56-.15-.72-.4L8.34 4.91C9.43 4.33 10.67 4 12 4zM4.91 8.34l2.14 1.39c.25.16.4.43.4.72v3.1c0 .29-.15.56-.4.72l-2.14 1.39C4.33 14.57 4 13.33 4 12s.33-2.57.91-3.66zM12 20c-1.33 0-2.57-.33-3.66-.91l1.39-2.14c.16-.25.43-.4.72-.4h3.1c.29 0 .56.15.72.4l1.39 2.14c-1.09.58-2.33.91-3.66.91zm7.09-4.34l-2.14-1.39c-.25-.16-.4-.43-.4-.72v-3.1c0-.29.15-.56.4-.72l2.14-1.39c.58 1.09.91 2.33.91 3.66s-.33 2.57-.91 3.66zM15.1 12l-1.55 2.38c-.16.25-.43.4-.72.4h-1.66c-.29 0-.56-.15-.72-.4L8.9 12l1.55-2.38c.16-.25.43-.4.72-.4h1.66c.29 0 .56.15.72.4L15.1 12z" />
  </svg>
);

const HighlightsSkeleton: React.FC = () => (
    <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
             <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl animate-pulse">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                    <div className="space-y-2">
                        <div className="h-4 w-32 bg-gray-200 rounded"></div>
                        <div className="h-3 w-20 bg-gray-200 rounded"></div>
                    </div>
                </div>
                <div className="h-6 w-12 bg-gray-200 rounded-lg"></div>
            </div>
        ))}
    </div>
);

const MatchHighlights: React.FC<MatchHighlightsProps> = ({ match, enabled, timeline }) => {
  const [highlights, setHighlights] = useState<GoalEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    const timelineGoals = timeline?.filter(e => e.type === 'goal') || [];
    const totalScore = (match.scoreA || 0) + (match.scoreB || 0);
    
    // If timeline is provided and seems complete (matches score), use it
    if (timeline && timeline.length > 0 && timelineGoals.length >= totalScore) {
        const goals = timelineGoals
            .map(e => ({
                teamName: e.team === 'A' ? match.teamA.name : match.teamB.name,
                scorerName: e.playerIn,
                scorerImage: e.playerInImage,
                minute: e.minute
            }));
        setHighlights(goals);
        setLoading(false);
        setHasFetched(true);
        return;
    }

    // Otherwise, fetch highlights independently if enabled
    if (enabled && !hasFetched) {
        let isCancelled = false;
        
        const getHighlights = async () => {
          setLoading(true);
          setError(null);
          try {
            const data = await fetchMatchHighlights(match);
            if (!isCancelled) {
              const sortedData = data.sort((a, b) => a.minute - b.minute);
              setHighlights(sortedData);
              setHasFetched(true);
            }
          } catch (err) {
            if (!isCancelled) {
              setError('لم نتمكن من جلب أبرز الأحداث.');
            }
          } finally {
            if (!isCancelled) {
              setLoading(false);
            }
          }
        };

        getHighlights();

        return () => {
          isCancelled = true;
        };
    }
  }, [match, enabled, hasFetched, timeline]);

  if (!enabled && !hasFetched) {
      return null;
  }

  const renderContent = () => {
    if (loading) {
      return <HighlightsSkeleton />;
    }
    if (error) {
      return (
        <div className="p-8 text-center bg-red-50 rounded-3xl border border-red-100">
            <p className="text-red-500 font-bold text-sm">{error}</p>
        </div>
      );
    }
    if (highlights.length === 0) {
      return (
        <div className="p-10 text-center bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
            <p className="text-gray-400 font-bold text-sm">لم يتم تسجيل أهداف في المباراة حتى الآن.</p>
        </div>
      );
    }

    const homeGoals = highlights.filter(g => g.teamName === match.teamA.name);
    const awayGoals = highlights.filter(g => g.teamName === match.teamB.name);

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative mt-4">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-50 -translate-x-1/2 hidden sm:block"></div>
        
        {/* Home Goals */}
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2 border-b border-gray-50 pb-3">
                <div className="w-8 h-8 rounded-full bg-gray-50 p-1 border border-gray-100">
                    <img src={match.teamA.logoUrl} alt={match.teamA.name} className="w-full h-full object-contain" />
                </div>
                <span className="font-black text-sm text-gray-900">{match.teamA.name}</span>
            </div>
            <div className="space-y-3">
                {homeGoals.length > 0 ? homeGoals.map((g, i) => (
                    <motion.div 
                        key={`home-goal-${i}-${g.minute}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center justify-between bg-gray-50/50 p-2.5 rounded-2xl border border-gray-100/50 group hover:bg-white hover:shadow-md transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 group-hover:border-emerald-200 overflow-hidden relative">
                                {g.scorerImage ? (
                                    <img src={g.scorerImage} alt={g.scorerName} className="w-full h-full object-cover" />
                                ) : (
                                    <SoccerBallIcon className="w-5 h-5 text-emerald-600" />
                                )}
                            </div>
                            <span className="text-sm font-black text-gray-800">{g.scorerName}</span>
                        </div>
                        <span className="font-black text-emerald-600 text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                            {g.minute}'
                        </span>
                    </motion.div>
                )) : <div className="py-2 text-center text-gray-300 text-xs font-bold italic">لا يوجد أهداف</div>}
            </div>
        </div>

        {/* Away Goals */}
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2 border-b border-gray-50 pb-3 sm:flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-gray-50 p-1 border border-gray-100">
                    <img src={match.teamB.logoUrl} alt={match.teamB.name} className="w-full h-full object-contain" />
                </div>
                <span className="font-black text-sm text-gray-900">{match.teamB.name}</span>
            </div>
            <div className="space-y-3">
                {awayGoals.length > 0 ? awayGoals.map((g, i) => (
                    <motion.div 
                        key={`away-goal-${i}-${g.minute}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center justify-between bg-gray-50/50 p-2.5 rounded-2xl border border-gray-100/50 group hover:bg-white hover:shadow-md transition-all sm:flex-row-reverse"
                    >
                        <div className="flex items-center gap-3 sm:flex-row-reverse">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 group-hover:border-emerald-200 overflow-hidden relative">
                                {g.scorerImage ? (
                                    <img src={g.scorerImage} alt={g.scorerName} className="w-full h-full object-cover" />
                                ) : (
                                    <SoccerBallIcon className="w-5 h-5 text-emerald-600" />
                                )}
                            </div>
                            <span className="text-sm font-black text-gray-800">{g.scorerName}</span>
                        </div>
                        <span className="font-black text-emerald-600 text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                            {g.minute}'
                        </span>
                    </motion.div>
                )) : <div className="py-2 text-center text-gray-300 text-xs font-bold italic">لا يوجد أهداف</div>}
            </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="bg-white rounded-[40px] p-6 sm:p-10 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-8">
          <h4 className="text-lg sm:text-xl font-black text-gray-900 flex items-center gap-3">
             <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
             هدافو المباراة
          </h4>
          <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
              أبرز الأحداث
          </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default MatchHighlights;
