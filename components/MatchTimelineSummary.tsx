
import React, { useState, useEffect } from 'react';
import { Match, TimelineEvent } from '../types';
import { fetchKeyEvents } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import OptimizedImage from './OptimizedImage';
import { 
  Trophy, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  XOctagon, 
  Clock,
  Info,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

const SoccerBallIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c1.33 0 2.57.33 3.66.91l-1.39 2.14c-.16.25-.43.4-.72.4h-3.1c-.29 0-.56-.15-.72-.4L8.34 4.91C9.43 4.33 10.67 4 12 4zM4.91 8.34l2.14 1.39c.25.16.4.43.4.72v3.1c0 .29-.15.56-.4.72l-2.14 1.39C4.33 14.57 4 13.33 4 12s.33-2.57.91-3.66zM12 20c-1.33 0-2.57-.33-3.66-.91l1.39-2.14c.16-.25.43-.4.72-.4h3.1c.29 0 .56.15.72.4l1.39 2.14c-1.09.58-2.33.91-3.66.91zm7.09-4.34l-2.14-1.39c-.25-.16-.4-.43-.4-.72v-3.1c0-.29.15-.56.4-.72l2.14-1.39c.58 1.09.91 2.33.91 3.66s-.33 2.57-.91 3.66zM15.1 12l-1.55 2.38c-.16.25-.43.4-.72.4h-1.66c-.29 0-.56-.15-.72-.4L8.9 12l1.55-2.38c.16-.25.43-.4.72-.4h1.66c.29 0 .56.15.72.4L15.1 12z" />
  </svg>
);

interface MatchTimelineSummaryProps {
  match: Match;
  details?: any | null;
  enabled: boolean;
}

const MatchTimelineSummary: React.FC<MatchTimelineSummaryProps> = ({ match, details, enabled }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (details?.timeline) {
        setEvents(details.timeline);
        setLoading(false);
        setHasFetched(true);
        return;
    }

    if (enabled && !hasFetched) {
        let isMounted = true;
        const loadEvents = async () => {
          setLoading(true);
          try {
            const data = await fetchKeyEvents(match);
            if (isMounted) {
              setEvents(data.sort((a, b) => a.minute - b.minute));
              setHasFetched(true);
            }
          } catch (err) {
            console.error(err);
          } finally {
            if (isMounted) setLoading(false);
          }
        };
        loadEvents();
        return () => { isMounted = false; };
    }
  }, [match, details, enabled, hasFetched]);

  if (!enabled && !hasFetched) return null;

  const renderEventIcon = (event: TimelineEvent) => {
    switch(event.type) {
      case 'goal':
        return (
          <div className="w-10 h-10 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 overflow-hidden">
            {event.playerInImage ? (
                <OptimizedImage src={event.playerInImage} alt="" className="w-full h-full object-cover" width={40} />
            ) : (
                <SoccerBallIcon className="w-6 h-6 text-emerald-600" />
            )}
          </div>
        );
      case 'yellow-card':
        return (
          <div className="w-[30px] h-10 rounded-sm bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/40 transform -rotate-6 overflow-hidden border border-yellow-500">
            <div className="absolute inset-0 bg-yellow-400/40 mix-blend-multiply"></div>
          </div>
        );
      case 'red-card':
        return (
          <div className="w-[30px] h-10 rounded-sm bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 transform rotate-6 overflow-hidden border border-red-600">
             <div className="absolute inset-0 bg-red-500/40 mix-blend-multiply"></div>
          </div>
        );
      case 'substitution':
        return (
          <div className="w-10 h-10 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden relative">
            {event.playerInImage ? (
                <OptimizedImage src={event.playerInImage} alt="" className="w-full h-full object-cover" width={40} />
            ) : (
                <div className="relative flex items-center justify-center">
                    <ChevronUp className="w-5 h-5 text-emerald-500 absolute -top-1" />
                    <ChevronDown className="w-5 h-5 text-red-500 absolute top-1" />
                </div>
            )}
            <div className="absolute inset-0 bg-blue-500/30 mix-blend-overlay"></div>
          </div>
        );
      default:
        return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  const EventContent = ({ event, isTeamA }: { event: TimelineEvent, isTeamA: boolean }) => {
    const isSub = event.type === 'substitution';
    
    return (
      <div className={`flex flex-col ${isTeamA ? 'items-start sm:items-end text-left sm:text-right' : 'items-end sm:items-start text-right sm:text-left'} w-full group overflow-visible min-w-0`}>
        {isSub ? (
          <div className="space-y-1.5 flex flex-col items-inherit min-w-0 w-full">
            <div className={`flex items-center gap-1.5 sm:gap-3 text-emerald-600 font-black text-[11px] sm:text-lg transition-transform group-hover:translate-x-1 ${!isTeamA ? 'justify-end' : 'justify-start'} w-full min-w-0`}>
              {(isTeamA) && event.playerInImage && <OptimizedImage src={event.playerInImage} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-emerald-100 shadow-sm flex-shrink-0" alt="" width={32} />}
              {(isTeamA) && <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />}
              <span className="whitespace-normal leading-normal sm:leading-tight break-words min-w-0">{event.playerIn}</span>
              {(!isTeamA) && <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />}
              {(!isTeamA) && event.playerInImage && <OptimizedImage src={event.playerInImage} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-emerald-100 shadow-sm flex-shrink-0" alt="" width={32} />}
            </div>
            <div className={`flex items-center gap-1.5 sm:gap-3 text-red-400 font-bold text-[10px] sm:text-sm opacity-60 ${!isTeamA ? 'justify-end' : 'justify-start'} w-full min-w-0`}>
              {(isTeamA) && event.playerOutImage && <OptimizedImage src={event.playerOutImage} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-red-50 flex-shrink-0" alt="" width={24} />}
              {(isTeamA) && <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />}
              <span className="whitespace-normal leading-normal sm:leading-tight break-words min-w-0">{event.playerOut}</span>
              {(!isTeamA) && <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />}
              {(!isTeamA) && event.playerOutImage && <OptimizedImage src={event.playerOutImage} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-red-50 flex-shrink-0" alt="" width={24} />}
            </div>
          </div>
        ) : (
          <div className="space-y-1 flex flex-col items-inherit min-w-0 w-full">
            <div className={`flex items-center gap-1.5 sm:gap-3 ${!isTeamA ? 'justify-end' : 'justify-start'} w-full min-w-0`}>
               {event.isOwnGoal && isTeamA && <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-black whitespace-nowrap flex-shrink-0">هدف عكسي</span>}
               {(isTeamA) && event.playerInImage && <OptimizedImage src={event.playerInImage} className="w-7 h-7 sm:w-10 sm:h-10 rounded-full border border-gray-100 shadow-sm flex-shrink-0" alt="" width={40} />}
               <span className="font-black text-[12px] sm:text-xl text-gray-900 leading-[1.4] sm:leading-tight whitespace-normal break-words min-w-0">
                {event.playerIn}
              </span>
              {(!isTeamA) && event.playerInImage && <OptimizedImage src={event.playerInImage} className="w-7 h-7 sm:w-10 sm:h-10 rounded-full border border-gray-100 shadow-sm flex-shrink-0" alt="" width={40} />}
              {event.isOwnGoal && !isTeamA && <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-black whitespace-nowrap flex-shrink-0">هدف عكسي</span>}
            </div>
            
            {event.assist && (
              <div className={`flex items-center gap-1 text-[9px] sm:text-xs font-bold text-gray-500 px-1 ${!isTeamA ? 'justify-end' : 'justify-start'} w-full min-w-0`}>
                <span className="opacity-60 flex-shrink-0">صناعة:</span>
                <span className="text-gray-700 leading-[1.4] sm:leading-tight whitespace-normal break-words min-w-0">{event.assist}</span>
              </div>
            )}

            
            <div className="flex items-center gap-2 px-1">
              <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                event.type === 'goal' ? 'bg-emerald-50 text-emerald-600' : 
                event.type === 'yellow-card' ? 'bg-yellow-50 text-yellow-700' : 
                event.type === 'red-card' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'
              }`}>
                {event.isPenaltyShootout ? 'ركلة ترجيح' : 
                 event.isPenalty ? 'هدف (ركلة جزاء)' :
                 event.isOwnGoal ? 'هدف في مرماه' :
                 event.type === 'goal' ? 'هدف' : 
                 event.type === 'yellow-card' ? 'بطاقة صفراء' : 
                 event.type === 'red-card' ? 'بطاقة حمراء' : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm space-y-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-6 animate-pulse">
            <div className="flex-1 h-4 bg-gray-100 rounded-full" />
            <div className="w-12 h-12 rounded-full bg-gray-100" />
            <div className="flex-1 h-4 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-[40px] p-12 border border-gray-100 shadow-sm text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-gray-200" />
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-2">لا توجد أحداث</h3>
        <p className="text-gray-400 font-medium">لم يتم تسجيل أي أحداث رئيسية لهذه المباراة حتى الآن.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[32px] sm:rounded-[40px] p-4 sm:p-12 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100 mb-10 relative overflow-hidden font-tajawal">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-12 px-4 relative">
          <div className="flex flex-col items-start flex-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">صاحب الأرض</span>
            <div className="flex items-center gap-3 mb-2 border-b border-gray-50 pb-3 sm:flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-gray-50 p-1 border border-gray-100">
                    <img src={match.teamA.logoUrl} alt={match.teamA.name} className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col items-start">
                    <span className="font-black text-sm text-gray-900 leading-tight">{match.teamA.name.replace(/تحت 17/g, '').trim()}</span>
                    {match.league.includes('تحت 17') && <span className="text-[10px] text-gray-400 font-bold leading-tight">تحت 17</span>}
                </div>
            </div>
          </div>
          
          
          {/* Centered middle section */}
          <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2 top-0 pointer-events-none">
            <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center mb-2 pointer-events-auto shadow-md">
              <Info className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] bg-white px-2">ملخص المباراة</span>
          </div>

          <div className="flex flex-col items-end flex-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">الضيف</span>
            <div className="flex items-center gap-2 text-right">
              {match.teamB.logoUrl && <img src={match.teamB.logoUrl} alt={match.teamB.name} className="w-6 h-6 object-contain" />}
              <div className="flex flex-col items-end">
                  <span className="text-sm font-black text-gray-900 leading-tight">{match.teamB.name.replace(/تحت 17/g, '').trim()}</span>
                  {match.league.includes('تحت 17') && <span className="text-[10px] text-gray-400 font-bold leading-tight">تحت 17</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-12 relative">
          {/* Central Timeline Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-gray-100 via-gray-200 to-gray-100 -translate-x-1/2"></div>

          <AnimatePresence>
            {events.map((event, idx) => {
              const isTeamA = event.team === 'A';
              
              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center w-full relative"
                >
                  {/* Team A Event */}
                  <div className={`flex-1 flex justify-start sm:justify-end px-1 sm:pr-24 ${isTeamA ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    {isTeamA && <EventContent event={event} isTeamA={true} />}
                  </div>

                  {/* Minute Marker */}
                  <div className="relative flex-shrink-0 z-20 mx-1 sm:mx-4">
                    <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-white border-2 sm:border-4 border-gray-50 shadow-xl flex items-center justify-center group cursor-default">
                      <div className="w-full h-full rounded-full flex flex-col items-center justify-center bg-[#3fbe5e] text-white transition-transform group-hover:scale-95">
                        <span className="text-[10px] sm:text-sm font-black leading-none">
                          {event.minute}
                          {event.extraTime && <span className="text-[8px] sm:text-xs text-white/80">+{event.extraTime}</span>}
                        </span>
                        <span className="text-[7px] sm:text-[10px] font-bold opacity-80 uppercase">د</span>
                      </div>
                      
                      {/* Floating Icon */}
                      <div className={`absolute ${isTeamA ? '-right-5 sm:-right-8' : '-left-5 sm:-left-8'} top-1/2 -translate-y-1/2 scale-75 sm:scale-100 z-30`}>
                        {renderEventIcon(event)}
                      </div>
                    </div>
                  </div>

                  {/* Team B Event */}
                  <div className={`flex-1 flex justify-end sm:justify-start px-1 sm:pl-24 ${!isTeamA ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    {!isTeamA && <EventContent event={event} isTeamA={false} />}
                  </div>

                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Match Start/End Indicators */}
        <div className="mt-16 pt-10 border-t border-gray-50 flex justify-center gap-12">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">بداية اللقاء</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">صافرة النهاية</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchTimelineSummary;
