import React from 'react';

const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <div className="h-3 animate-shimmer rounded w-1/3"></div>
          <div className="h-3 animate-shimmer rounded w-1/4"></div>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center justify-center text-center w-20 sm:w-28">
            <div className="w-10 h-10 sm:w-14 sm:h-14 animate-shimmer rounded-full mb-2"></div>
            <div className="h-3 animate-shimmer rounded w-16"></div>
          </div>
          <div className="h-8 animate-shimmer rounded w-20"></div>
          <div className="flex flex-col items-center justify-center text-center w-20 sm:w-28">
            <div className="w-10 h-10 sm:w-14 sm:h-14 animate-shimmer rounded-full mb-2"></div>
            <div className="h-3 animate-shimmer rounded w-16"></div>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 p-3 flex justify-center items-center">
        <div className="h-6 animate-shimmer rounded-full w-28"></div>
      </div>
    </div>
  );
};

export default React.memo(SkeletonCard);