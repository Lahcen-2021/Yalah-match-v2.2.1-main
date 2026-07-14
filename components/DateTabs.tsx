
import React from 'react';
import { DateTab } from './Header';

interface DateTabsProps {
  activeTab: DateTab;
  setActiveTab: (tab: DateTab) => void;
}

const TABS: { id: DateTab; label: string }[] = [
  { id: 'tomorrow', label: 'مباريات الغد' },
  { id: 'today', label: 'مباريات اليوم' },
  { id: 'yesterday', label: 'مباريات الأمس' },
];

const DateTabs: React.FC<DateTabsProps> = ({ activeTab, setActiveTab }) => {
  // Responsive classes:
  // - text-xs on mobile, text-sm on desktop
  // - px-3 on mobile, px-6 on desktop
  // - flex-1 on mobile ensures buttons stretch to fill the width equally
  const baseClasses = 'flex-1 sm:flex-initial px-2 sm:px-6 py-2.5 sm:py-2 text-xs sm:text-sm font-bold sm:font-semibold rounded-full transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-50 whitespace-nowrap';
  // green-700 (not green-600) so white text clears the 4.5:1 AA contrast threshold.
  const activeClasses = 'bg-green-700 text-white shadow-md transform scale-105 sm:scale-100';
  const inactiveClasses = 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50';

  return (
    <div className="my-4 sm:my-6 w-full">
      <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${baseClasses} ${activeTab === tab.id ? activeClasses : inactiveClasses}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(DateTabs);
