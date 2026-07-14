
import React from 'react';

interface LiveMatchBannerProps {
  liveMatchCount: number;
  onBannerClick: () => void;
}

const LiveMatchBanner: React.FC<LiveMatchBannerProps> = ({ liveMatchCount, onBannerClick }) => {
  if (liveMatchCount === 0) return null;

  return (
    <div 
      className="bg-gradient-to-r from-red-600 to-red-700 text-white text-center py-3 px-4 cursor-pointer shadow-md relative overflow-hidden group"
      onClick={onBannerClick}
    >
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="flex items-center justify-center gap-2 animate-pulse">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
        <span className="font-bold text-sm sm:text-base">
           يوجد {liveMatchCount} مباريات جارية الآن! اضغط هنا للمتابعة
        </span>
      </div>
    </div>
  );
};

export default LiveMatchBanner;
