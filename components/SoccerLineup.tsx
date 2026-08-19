
import React, { useState } from 'react';
import { Player, Coach } from '../types';
import OptimizedImage from './OptimizedImage';

// Extended interface for internal use with visualization props
export interface VisualPlayer extends Player {
  rating: number; // For the badge
  x: number;      // 0-100%
  y: number;      // 0-100%
}

interface SoccerLineupProps {
  homeTeam: { name: string; logoUrl: string; players: VisualPlayer[]; substitutes?: Player[]; formation: string; coach?: Coach };
  awayTeam: { name: string; logoUrl: string; players: VisualPlayer[]; substitutes?: Player[]; formation: string; coach?: Coach };
  activeSide?: 'home' | 'away';
  onSideChange?: (side: 'home' | 'away') => void;
}

const SoccerLineup: React.FC<SoccerLineupProps> = ({ homeTeam, awayTeam, activeSide: propsActiveSide, onSideChange }) => {
  const [internalActiveSide, setInternalActiveSide] = useState<'home' | 'away'>('home');
  const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');
  // Tap-to-open stats tooltip (touch screens have no hover) — one open at a time.
  const [openTooltip, setOpenTooltip] = useState<number | null>(null);

  const isControlled = propsActiveSide !== undefined;
  const activeSide = isControlled ? propsActiveSide : internalActiveSide;

  const handleSideChange = (side: 'home' | 'away') => {
      setOpenTooltip(null);
      if (!isControlled) {
          setInternalActiveSide(side);
      }
      if (onSideChange) {
          onSideChange(side);
      }
  };

  const activeTeam = activeSide === 'home' ? homeTeam : awayTeam;
  const activePlayers = activeTeam.players;
  const isHome = activeSide === 'home';

  // Rating color logic matching the image (Green/Teal for high ratings)
  const getRatingColor = (rating: number) => {
    if (rating >= 8.0) return 'bg-[#00bfa5] text-white border-[#009688]'; // Teal/Green High
    if (rating >= 7.0) return 'bg-[#2979ff] text-white border-[#2962ff]'; // Blue Good
    if (rating >= 6.0) return 'bg-[#ffc107] text-black border-[#ffb300]'; // Yellow Average
    return 'bg-[#ff3d00] text-white border-[#dd2c00]';                    // Red Low
  };

  return (
    <div className="w-full flex flex-col items-center gap-6 font-tajawal animate-fadeInUp px-0 sm:px-4">
      
      {/* Controls: Team Switcher & View Toggle */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          {/* Team Switcher Tabs */}
          <div className="flex items-center justify-center p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-2xl shadow-inner border border-gray-200/50 select-none">
              <button
                  onClick={() => handleSideChange('home')}
                  className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                      activeSide === 'home' 
                      ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5 scale-100' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-white/50 scale-95 opacity-70 hover:opacity-100'
                  }`}
              >
                  <OptimizedImage src={homeTeam.logoUrl} alt={homeTeam.name} width={24} className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                  <span className="truncate max-w-[100px] sm:max-w-[150px]">{homeTeam.name}</span>
              </button>
              
              <div className="w-px h-5 bg-gray-300 mx-1"></div>

              <button
                  onClick={() => handleSideChange('away')}
                  className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                      activeSide === 'away' 
                      ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5 scale-100' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-white/50 scale-95 opacity-70 hover:opacity-100'
                  }`}
              >
                  <OptimizedImage src={awayTeam.logoUrl} alt={awayTeam.name} width={24} className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                  <span className="truncate max-w-[100px] sm:max-w-[150px]">{awayTeam.name}</span>
              </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center justify-center p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-2xl shadow-inner border border-gray-200/50 select-none">
              <button
                  onClick={() => setViewMode('pitch')}
                  className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                      viewMode === 'pitch' 
                      ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5 scale-100' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-white/50 scale-95 opacity-70 hover:opacity-100'
                  }`}
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  الملعب
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                      viewMode === 'list' 
                      ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5 scale-100' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-white/50 scale-95 opacity-70 hover:opacity-100'
                  }`}
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  القائمة
              </button>
          </div>
      </div>

      {/* Main Content Grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        
        {/* Left/Right Column: Pitch or List */}
        <div className={`w-full flex justify-center ${isHome ? 'lg:order-2 lg:justify-start' : 'lg:order-1 lg:justify-end'}`}>
            {viewMode === 'pitch' ? (
                <div 
                    className="relative w-full max-w-[500px] aspect-[2/3] sm:aspect-[5/8] rounded-[24px] sm:rounded-[32px] shadow-2xl border-[4px] border-[#66bb6a]/30 transition-all duration-500 overflow-hidden"
                    style={{
                        backgroundColor: '#388e3c', // Flat Green
                        backgroundImage: 'linear-gradient(to bottom, #388e3c, #2e7d32)', // Subtle gradient
                        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.2)'
                    }}
                >
                    {/* --- Pitch Markings (White Lines - Thin) --- */}
                    <div className="absolute inset-4 border-[2px] border-white/40 rounded-[16px]"></div>
                    
                    {/* Halfway Line */}
                    <div className="absolute top-1/2 left-4 right-4 h-[1px] bg-white/40 -translate-y-1/2" />
                    
                    {/* Center Circle */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20%] aspect-square border-[1px] border-white/40 rounded-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white/60 rounded-full" />
                    </div>

                    {/* Penalty Area (Top) */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[50%] h-[14%] border-[1px] border-t-0 border-white/40" />
                    {/* Goal Area (Top) */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[20%] h-[5%] border-[1px] border-t-0 border-white/40" />
                    {/* Penalty Arc (Top) */}
                    <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[18%] h-[4%] border-b-[1px] border-white/40 rounded-b-full" />

                    {/* Penalty Area (Bottom) */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[50%] h-[14%] border-[1px] border-b-0 border-white/40" />
                    {/* Goal Area (Bottom) */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[20%] h-[5%] border-[1px] border-b-0 border-white/40" />
                     {/* Penalty Arc (Bottom) */}
                     <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-[18%] h-[4%] border-t-[1px] border-white/40 rounded-t-full" />

                    {/* Corner Arcs */}
                    <div className="absolute top-4 left-4 w-4 h-4 border-b-[1px] border-r-[1px] border-white/40 rounded-br-full" />
                    <div className="absolute top-4 right-4 w-4 h-4 border-b-[1px] border-l-[1px] border-white/40 rounded-bl-full" />
                    <div className="absolute bottom-4 left-4 w-4 h-4 border-t-[1px] border-r-[1px] border-white/40 rounded-tr-full" />
                    <div className="absolute bottom-4 right-4 w-4 h-4 border-t-[1px] border-l-[1px] border-white/40 rounded-tl-full" />


                    {/* --- Players --- */}
                    <div className="absolute inset-0 z-20" onClick={() => setOpenTooltip(null)}>
                        {activePlayers.map((player, idx) => {
                            const stats = player.stats || { goals: 0, assists: 0, rating: player.rating };
                            const hasRating = (player.rating || 0) > 0;
                            const isOpen = openTooltip === idx;
                            // Keep the tooltip inside the pitch: flip below for the top
                            // rows (GK/defence) and clamp horizontally near the sides.
                            const showBelow = player.y < 26;
                            const hAlign = player.x < 20 ? 'left-0' : player.x > 80 ? 'right-0' : 'left-1/2 -translate-x-1/2';
                            const isCentered = player.x >= 20 && player.x <= 80;

                            return (
                                <div
                                    key={`${activeSide}-${player.name}-${idx}`}
                                    className="absolute flex flex-col items-center justify-center transform transition-all duration-500 cursor-pointer group/player"
                                    style={{
                                        left: `${player.x}%`,
                                        top: `${player.y}%`,
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: isOpen ? 60 : Math.floor(player.y)
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setOpenTooltip(isOpen ? null : idx); }}
                                >
                                     {/* Stats Tooltip (hover on desktop, tap on touch) */}
                                    <div className={`absolute ${showBelow ? 'top-full mt-1.5' : 'bottom-full mb-1.5'} ${hAlign} transition-all duration-200 transform pointer-events-none z-50 ${
                                        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 group-hover/player:opacity-100 group-hover/player:translate-y-0'
                                    }`}>
                                        {/* Arrow (pointing down at the player when above) */}
                                        {isCentered && showBelow && (
                                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-black/85 mx-auto"></div>
                                        )}
                                        <div className="bg-black/85 backdrop-blur-md rounded-xl p-2.5 shadow-xl border border-white/10 w-max min-w-[110px] max-w-[150px]">
                                            <div className="flex items-center justify-center gap-2 mb-1.5 border-b border-white/10 pb-1.5">
                                                {hasRating && (
                                                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${getRatingColor(player.rating)}`}>
                                                        {player.rating.toFixed(1)}
                                                    </div>
                                                )}
                                                <span className="text-white text-xs font-bold truncate max-w-[100px]">{player.name}</span>
                                            </div>
                                            <div className="flex items-stretch justify-center text-center">
                                                <div className="flex flex-col items-center flex-1 px-2">
                                                    <span className="text-emerald-400 text-xs font-black leading-tight">{stats.goals || 0}</span>
                                                    <span className="text-gray-400 text-[9px] whitespace-nowrap">أهداف</span>
                                                </div>
                                                <div className="w-px bg-white/15"></div>
                                                <div className="flex flex-col items-center flex-1 px-2">
                                                    <span className="text-blue-400 text-xs font-black leading-tight">{stats.assists || 0}</span>
                                                    <span className="text-gray-400 text-[9px] whitespace-nowrap">أسيست</span>
                                                </div>
                                            </div>
                                            {player.subOff && (
                                                <div className="mt-1.5 pt-1 border-t border-white/10 text-center text-[9px] text-red-300 font-bold">
                                                    ⇄ خرج د.{player.subOff.minute}
                                                </div>
                                            )}
                                        </div>
                                        {isCentered && !showBelow && (
                                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black/85 mx-auto"></div>
                                        )}
                                    </div>

                                    <div className="relative">
                                        {/* Avatar */}
                                        <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-[2px] border-white bg-gray-200 overflow-hidden shadow-md group-hover/player:border-emerald-400 transition-colors relative">
                                            <OptimizedImage
                                                src={player.logoUrl || null}
                                                alt={player.name}
                                                width={64}
                                                className="w-full h-full object-cover object-top"
                                                fallbackSrc="https://cdn-icons-png.flaticon.com/128/3001/3001764.png" // Generic avatar
                                            />
                                        </div>

                                        {/* Jersey Number (Top Right) */}
                                        {player.number > 0 && (
                                            <div className="absolute -top-1 -right-1 z-20 min-w-[16px] h-4 sm:min-w-[18px] sm:h-[18px] px-0.5 rounded-full bg-gray-900/90 text-white border border-white/60 shadow-sm flex items-center justify-center text-[8px] sm:text-[9px] font-black" dir="ltr">
                                                {player.number}
                                            </div>
                                        )}

                                        {/* Substituted-out arrows (Top Left) */}
                                        {player.subOff && (
                                            <div className="absolute -top-1 -left-1 z-20 w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                                                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 sm:w-3 sm:h-3">
                                                    <path d="M4 1 L4 7 M4 7 L2 5 M4 7 L6 5" stroke="#ef4444" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M8 11 L8 5 M8 5 L6 7 M8 5 L10 7" stroke="#22c55e" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                        )}

                                        {/* Goals (Bottom Left) — green ball badge with count */}
                                        {(stats.goals || 0) > 0 && (
                                            <div className="absolute -bottom-1 -left-1 z-20 min-w-[16px] h-4 sm:min-w-[18px] sm:h-[18px] px-0.5 rounded-full bg-emerald-600 border border-white/70 shadow-sm flex items-center justify-center gap-px text-white text-[8px] sm:text-[9px] font-black" dir="ltr">
                                                {(stats.goals || 0) > 1 && <span>{stats.goals}</span>}
                                                <span className="leading-none text-[9px] sm:text-[10px]">⚽</span>
                                            </div>
                                        )}

                                        {/* Card sliver (Left Middle) */}
                                        {player.cards && (
                                            <div className={`absolute top-1/2 -translate-y-1/2 -left-1.5 z-20 w-[7px] h-[10px] sm:w-2 sm:h-3 rounded-[2px] border border-white/70 shadow-sm ${player.cards.red > 0 ? 'bg-red-600' : 'bg-yellow-400'}`}></div>
                                        )}

                                        {/* Rating Badge (Bottom Right) — only when the source has a real rating */}
                                        {hasRating && (
                                            <div className={`absolute -bottom-1 -right-1 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border-[1.5px] shadow-sm text-[9px] sm:text-[10px] font-bold ${getRatingColor(player.rating)}`}>
                                                {player.rating.toFixed(1)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Name Label */}
                                    <div className="mt-1 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 shadow-sm min-w-[60px] text-center group-hover/player:bg-emerald-900/80 transition-colors">
                                        <p className="text-white text-[9px] sm:text-[11px] font-bold truncate leading-tight max-w-[80px]">
                                            {player.name.split(' ').slice(-1)[0]}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Formation Badge (Top Left) */}
                    <div className="absolute top-6 left-6 z-30">
                        <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 shadow-lg text-white font-mono font-bold text-xs sm:text-sm tracking-widest">
                            {activeTeam.formation || "4-3-3"}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-[500px] bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[600px] sm:h-[800px]">
                    <h3 className="text-gray-800 font-black text-lg p-4 pb-2 flex items-center gap-3 border-b border-gray-50">
                        <div className="w-1.5 h-5 bg-emerald-600 rounded-full"></div>
                        التشكيلة الأساسية
                        <span className="mr-auto text-sm text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded-md">{activeTeam.formation || "4-3-3"}</span>
                    </h3>
                    <div className="divide-y divide-gray-50 overflow-y-auto flex-1">
                        {activePlayers.map((player, idx) => (
                            <div key={`list-${idx}`} className="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="relative">
                                         <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                                             <OptimizedImage 
                                                 src={player.logoUrl || null} 
                                                 alt={player.name} 
                                                 width={48} 
                                                 className="w-full h-full object-cover object-top"
                                                 fallbackSrc="https://cdn-icons-png.flaticon.com/128/3001/3001764.png"
                                             />
                                         </div>
                                         {player.number > 0 && (
                                            <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-gray-100 shadow-sm">
                                                {player.number}
                                            </div>
                                         )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm sm:text-base font-bold text-gray-800">{player.name}</span>
                                        <span className="text-xs text-gray-400 font-medium">{player.position}</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="flex items-center gap-2.5 sm:gap-3 text-center sm:mr-4">
                                        <div className="flex flex-col items-center min-w-[28px]">
                                            <span className="text-emerald-600 text-xs font-black">{player.stats?.goals || 0}</span>
                                            <span className="text-gray-400 text-[9px] whitespace-nowrap">أهداف</span>
                                        </div>
                                        <div className="w-px h-6 bg-gray-200"></div>
                                        <div className="flex flex-col items-center min-w-[28px]">
                                            <span className="text-blue-600 text-xs font-black">{player.stats?.assists || 0}</span>
                                            <span className="text-gray-400 text-[9px] whitespace-nowrap">أسيست</span>
                                        </div>
                                    </div>
                                    {player.rating ? (
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black border shadow-sm ${getRatingColor(player.rating)}`}>
                                            {player.rating.toFixed(1)}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-300 font-bold">-</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Substitutes & Coach Column: Position changes based on team (Right for Home, Left for Away in RTL).
            Order mirrors the broadcast layout: bench list first, coach card at the bottom. */}
        <div className={`w-full flex flex-col gap-4 h-full min-h-0 lg:h-[800px] ${isHome ? 'lg:order-1' : 'lg:order-2'}`}>

            {/* Substitutes Section */}
            {activeTeam.substitutes && activeTeam.substitutes.length > 0 && (
                <div className="w-full flex-1 flex flex-col min-h-0">
                    <h3 className="text-gray-800 font-black text-lg mb-3 flex items-center gap-3 px-1">
                        <div className="w-1.5 h-5 bg-blue-600 rounded-full"></div>
                        قائمة البدلاء
                    </h3>
                    {/* Add overflow-y-auto to allow scrolling within the fixed height on desktop */}
                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col">
                        <div className="divide-y divide-gray-50 overflow-y-auto">
                            {activeTeam.substitutes.map((player, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="relative">
                                             <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                                                 <OptimizedImage
                                                     src={player.logoUrl || null}
                                                     alt={player.name}
                                                     width={48}
                                                     className="w-full h-full object-cover object-top"
                                                     fallbackSrc="https://cdn-icons-png.flaticon.com/128/3001/3001764.png"
                                                 />
                                             </div>
                                             {player.number > 0 && (
                                                <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-gray-100 shadow-sm">
                                                    {player.number}
                                                </div>
                                             )}
                                             {(player.stats?.goals || 0) > 0 && (
                                                <div className="absolute -bottom-1 -left-1 min-w-[16px] h-4 px-0.5 rounded-full bg-emerald-600 border border-white/70 shadow-sm flex items-center justify-center gap-px text-white text-[8px] font-black" dir="ltr">
                                                    {(player.stats?.goals || 0) > 1 && <span>{player.stats?.goals}</span>}
                                                    <span className="leading-none text-[9px]">⚽</span>
                                                </div>
                                             )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm sm:text-base font-bold text-gray-800">{player.name}</span>
                                            {player.subOn ? (
                                                <span className="text-[11px] text-red-500 font-bold flex items-center gap-1">
                                                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 shrink-0">
                                                        <path d="M9 3 L4 3 M4 3 L6 1 M4 3 L6 5 M3 9 L8 9 M8 9 L6 7 M8 9 L6 11" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    بدل {player.subOn.forName || '—'}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400 font-medium">{player.position}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {player.subOn && (
                                            <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg px-2 py-1 text-[11px] font-black" dir="ltr">
                                                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5">
                                                    <path d="M6 11 L6 3 M6 3 L3 6 M6 3 L9 6" stroke="#059669" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {player.subOn.minute}'
                                            </div>
                                        )}
                                        {player.stats?.rating ? (
                                            <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black border shadow-sm ${getRatingColor(player.stats.rating)}`}>
                                                {player.stats.rating.toFixed(1)}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-300 font-bold">-</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Coach Section — at the bottom, like the broadcast reference */}
            {activeTeam.coach && (
                <div className="w-full flex-shrink-0">
                     <h3 className="text-gray-800 font-black text-lg mb-3 flex items-center gap-3 px-1">
                        <div className="w-1.5 h-5 bg-emerald-600 rounded-full"></div>
                        المدير الفني
                    </h3>
                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden p-4">
                         <div className="flex items-center gap-4">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-50 border-2 border-emerald-100 p-0.5 overflow-hidden shadow-sm">
                                 <OptimizedImage
                                     src={activeTeam.coach.photoUrl || null}
                                     alt={activeTeam.coach.name}
                                     width={64}
                                     className="w-full h-full object-cover object-top rounded-full"
                                     fallbackSrc="https://cdn-icons-png.flaticon.com/128/2922/2922510.png"
                                 />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-1">المدرب</span>
                                <span className="text-gray-900 font-black text-lg sm:text-xl leading-none">
                                    {activeTeam.coach.name}
                                </span>
                            </div>
                         </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SoccerLineup;
