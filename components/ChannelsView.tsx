
import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import OptimizedImage from './OptimizedImage';
import { CHANNELS } from '../constants/channels';
import { InlinePlayer, VideoJSPlayer, ClapprPlayer, PlyrPlayer } from './Players';

// --- Error Reporting Utility ---
const reportPlaybackError = (data: {
    player: 'Native' | 'Hls.js' | 'Video.js';
    url: string;
    errorType: string;
    errorCode?: string | number;
    message: string;
    retryCount?: number;
}) => {
    // In a real application, send this data to an analytics service (e.g., Sentry, Firebase, Datadog)
    console.groupCollapsed(`%c[Stream Error Report] ${data.player}`, 'color: red; font-weight: bold;');
    console.table(data);
    console.groupEnd();
};

// --- Channel Player Component ---
export const ChannelPlayer = memo(({ channel, onClose }: { channel: any; onClose: () => void; }) => {
    // Helper to get servers, defaulting to channel.url as single server
    const servers = useMemo(() => channel.servers || [{ name: 'سيرفر أساسي', url: channel.url }], [channel]);
    
    const [activeUrlIdx, setActiveUrlIdx] = useState(0);
    const activeUrl = servers[activeUrlIdx]?.url || servers[0].url;
    const [playerType, setPlayerType] = useState<'plyr' | 'default' | 'videojs' | 'clappr'>('plyr');
    const [prevServers, setPrevServers] = useState(servers);
    
    if (servers !== prevServers) {
        setPrevServers(servers);
        setActiveUrlIdx(0);
        setPlayerType('default');
    }

    const handlePlayerError = useCallback(() => {
        // Auto-switch to next server if available
        if (activeUrlIdx < servers.length - 1) {
            console.log(`Switching to next server: ${activeUrlIdx + 1}/${servers.length}`);
            setTimeout(() => {
                setActiveUrlIdx(prev => prev + 1);
            }, 3000);
        }
    }, [activeUrlIdx, servers.length]);

    // Handle ESC key to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Determine stream type for badge
    const isStream = activeUrl.includes('.m3u8') || activeUrl.includes('.ts');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-0 sm:p-4 animate-fadeIn" role="dialog" aria-modal="true">
            <div className="bg-black w-full h-full sm:h-auto sm:max-w-5xl overflow-hidden shadow-2xl relative border-0 sm:border border-gray-800 flex flex-col justify-center">
                {/* Header Overlay - Contains Close Btn */}
                <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
                    <div className="p-4 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-start">
                        <span className="text-white font-bold bg-red-600 px-3 py-1 rounded-full text-xs sm:text-sm shadow-sm flex items-center gap-1.5 animate-pulse">
                            <span className="w-2 h-2 bg-white rounded-full"></span>
                            مباشر
                        </span>
                        <button 
                            onClick={onClose} 
                            className="text-white hover:text-red-500 transition-colors bg-black/50 hover:bg-black/70 p-2 rounded-full pointer-events-auto backdrop-blur-md"
                            aria-label="Close player"
                        >
                            <svg className="w-8 h-8 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Player Container */}
                <div className="relative w-full h-full sm:aspect-video bg-black group flex items-center justify-center flex-col">
                    <div className="w-full h-full relative">
                        {playerType === 'plyr' ? (
                            <PlyrPlayer 
                                key={`plyr-${activeUrl}`} 
                                src={activeUrl} 
                                autoPlay={true} 
                                className="w-full h-full sm:h-auto max-h-screen" 
                                onError={handlePlayerError}
                            />
                        ) : playerType === 'default' ? (
                            <InlinePlayer 
                                key={`inline-${activeUrl}`} 
                                src={activeUrl} 
                                autoPlay={true} 
                                className="w-full h-full sm:h-auto max-h-screen" 
                                onError={handlePlayerError}
                            />
                        ) : playerType === 'videojs' ? (
                            <VideoJSPlayer 
                                key={`vjs-${activeUrl}`} 
                                src={activeUrl} 
                                className="w-full h-full sm:h-auto max-h-screen" 
                                onError={handlePlayerError}
                            />
                        ) : (
                            <ClapprPlayer 
                                key={`clappr-${activeUrl}`} 
                                src={activeUrl} 
                                className="w-full h-full sm:h-auto max-h-screen" 
                                onError={handlePlayerError}
                            />
                        )}
                    </div>
                </div>
                
                {/* Footer Info with Switcher */}
                <div className="bg-gray-900/90 backdrop-blur p-4 border-t border-gray-800 absolute bottom-0 left-0 right-0 sm:static flex flex-col sm:flex-row justify-between items-center gap-4">
                     <div className="flex flex-col text-center sm:text-right">
                        <h3 className="text-white font-bold text-lg shadow-black drop-shadow-md">{channel.name}</h3>
                        <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
                            <span className="text-emerald-400 text-xs font-mono">Ultra Fast • Low Latency</span>
                            <span className="text-gray-500 text-xs">•</span>
                            <span className="text-gray-400 text-xs">{isStream ? 'HLS Stream' : 'Web Stream'}</span>
                        </div>
                     </div>

                     <div className="flex flex-wrap items-center gap-4 justify-center sm:justify-end">
                        {/* Server Switcher */}
                        {servers.length > 1 && (
                            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-gray-700/50 backdrop-blur-sm pointer-events-auto overflow-x-auto max-w-[200px] sm:max-w-none no-scrollbar">
                                {servers.map((server: any, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveUrlIdx(idx)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all ${
                                            activeUrlIdx === idx 
                                            ? 'bg-emerald-600 text-white shadow-lg' 
                                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        {server.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Player Switcher Controls */}
                        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-gray-700/50 backdrop-blur-sm pointer-events-auto overflow-x-auto whitespace-nowrap scrollbar-hide">
                            <button 
                                onClick={() => setPlayerType('plyr')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${playerType === 'plyr' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                مشغل بليير
                            </button>
                            <button 
                                onClick={() => setPlayerType('default')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${playerType === 'default' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                مشغل 1
                            </button>
                            <button 
                                onClick={() => setPlayerType('videojs')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${playerType === 'videojs' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                مشغل 2
                            </button>
                            <button 
                                onClick={() => setPlayerType('clappr')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${playerType === 'clappr' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                مشغل 3
                            </button>
                        </div>
                     </div>
                </div>
            </div>
        </div>
    );
});


// --- Channel View Component ---
const ChannelsView: React.FC = () => {
    // Changed state type to store the full channel object
    const [selectedChannel, setSelectedChannel] = useState<typeof CHANNELS[0] | null>(null);

    return (
        <div className="py-10 font-tajawal max-w-7xl mx-auto px-4">
            {selectedChannel && (
                <ChannelPlayer 
                    channel={selectedChannel}
                    onClose={() => setSelectedChannel(null)} 
                />
            )}

            {/* Header */}
            <div className="flex flex-col items-center mb-12 text-center animate-fadeInUp">
                <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4 tracking-tight">القنوات الناقلة</h2>
                <div className="h-1.5 w-24 bg-emerald-600 rounded-full shadow-sm"></div>
                <p className="mt-4 text-gray-500 font-medium">شاهد قنواتك الرياضية المفضلة بجودة عالية</p>
            </div>

            {/* Live stream embed. Fixed responsive height reserves layout space (no CLS). */}
            <div className="mb-12 animate-fadeInUp">
                <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 shadow-sm bg-black">
                    <iframe
                        src="https://sootsp.blogspot.com/p/9_13.html"
                        title="البث المباشر"
                        className="w-full h-[70vh] min-h-[420px] sm:min-h-[600px]"
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer"
                    />
                </div>
            </div>

            {/* Channels Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {CHANNELS.map((channel, idx) => (
                    <div 
                        key={channel.id}
                        onClick={() => setSelectedChannel(channel)}
                        className="group bg-white rounded-3xl border border-gray-100 p-6 flex flex-col items-center gap-4 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-300 cursor-pointer animate-fadeInUp relative overflow-hidden"
                        style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                        {/* Hover Overlay Effect */}
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        {/* Logo Container */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-full flex items-center justify-center p-4 shadow-inner group-hover:bg-white group-hover:shadow-md transition-all duration-300 z-10">
                            <OptimizedImage 
                                src={channel.logo} 
                                alt={channel.name} 
                                width={80}
                                className="w-full h-full object-contain drop-shadow-sm group-hover:scale-110 transition-transform duration-300"
                            />
                        </div>

                        {/* Text Content */}
                        <div className="text-center z-10">
                            <h3 className="font-black text-gray-800 text-sm sm:text-base mb-2">{channel.name}</h3>
                            <button className="bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-lg shadow-emerald-600/30">
                                مشاهدة
                            </button>
                        </div>

                        {/* Status Indicator */}
                        <div className="absolute top-4 left-4 z-10">
                            <div className="flex items-center gap-1.5 bg-gray-100/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-gray-200">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold text-gray-500">مباشر</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChannelsView;
