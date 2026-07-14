
import React, { useState } from 'react';
import { TelegramIcon, YoutubeIcon, FacebookIcon, XIcon } from '../constants';

export type AppView = 'matches' | 'tournaments' | 'standings' | 'news' | 'contact' | 'channels' | 'privacy' | 'terms';
export type DateTab = 'yesterday' | 'today' | 'tomorrow';

interface HeaderProps {
  activeTab: DateTab;
  setActiveTab: (tab: DateTab) => void;
  view: AppView;
  setView: (view: AppView) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, view, setView }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleNavClick = (targetView: AppView, specialTab?: DateTab) => {
        // Try to update URL history, but don't fail navigation if it's blocked (e.g. in blob/iframe)
        try {
            if (window.location.pathname !== '/' && window.location.pathname !== '') {
                 window.history.pushState({}, '', '/');
                 window.dispatchEvent(new PopStateEvent('popstate'));
            }
        } catch (e) {
            console.warn('Navigation history update failed (ignoring):', e);
        }

        try {
            // Defensive: ensure props are functions at runtime
            if (typeof setView === 'function') {
                setView(targetView);
            } else {
                console.warn('setView is not a function');
            }

            if (targetView === 'matches') {
                if (typeof setActiveTab === 'function') {
                    setActiveTab(specialTab || 'today');
                } else {
                    console.warn('setActiveTab is not a function');
                }
            }

            setIsMenuOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            // Prevent uncaught exceptions from breaking the app
            // and log for debugging
            console.error('Navigation error:', err);
        }
    };

    const handleLogoClick = (e: React.MouseEvent) => {
        e.preventDefault();
        
        try {
            if (window.location.pathname !== '/' && window.location.pathname !== '') {
                 window.history.pushState({}, '', '/');
                 window.dispatchEvent(new PopStateEvent('popstate'));
            }
        } catch (e) {
             console.warn('Logo navigation history update failed (ignoring):', e);
        }

        try {
            // Explicitly set view to matches and tab to today for home navigation
            if (typeof setView === 'function') setView('matches');
            if (typeof setActiveTab === 'function') setActiveTab('today');

            setIsMenuOpen(false); // Close mobile menu if open
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error('Logo navigation error:', err);
        }
    };

    const handleSocialClick = (e: React.MouseEvent) => {
        e.preventDefault();
        try {
            window.location.reload();
        } catch (e) {
            console.warn('Reload failed', e);
        }
    };

    const navItems = [
        { label: 'مباريات اليوم', view: 'matches', isActive: view === 'matches' && activeTab === 'today' },
        { label: 'القنوات', view: 'channels', isActive: view === 'channels' },
        { label: 'البطولات', view: 'tournaments', isActive: view === 'tournaments' },
        { label: 'الترتيب', view: 'standings', isActive: view === 'standings' },
        { label: 'الأخبار', view: 'news', isActive: view === 'news' },
        { label: 'اتصل بنا', view: 'contact', isActive: view === 'contact' },
    ];

    const socialLinks = [
        { Icon: XIcon, href: '/' },
        { Icon: FacebookIcon, href: '/' },
        { Icon: YoutubeIcon, href: '/' },
        { Icon: TelegramIcon, href: '/' },
    ];

    return (
        <header className="bg-white shadow relative z-50 font-tajawal">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    
                    {/* Right Side (RTL) - Logo */}
                    <div className="flex-shrink-0 flex items-center">
                        <a 
                            href="/"
                            className="cursor-pointer select-none block"
                            onClick={handleLogoClick} 
                        >
                             <div className="bg-green-600 hover:bg-green-700 transition-colors px-4 py-1.5 rounded-lg shadow-sm">
                                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug" style={{ fontFamily: 'Tajawal, sans-serif' }}>
                                   يلا ماتش
                                </h1>
                             </div>
                        </a>
                    </div>

                    {/* Center - Navigation Links */}
                    <nav className="hidden md:flex items-center justify-center flex-1 gap-6 lg:gap-10">
                        {navItems.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleNavClick(item.view as AppView, (item as any).specialTab)}
                                className={`text-base font-bold transition-colors whitespace-nowrap ${
                                    item.isActive ? 'text-green-600' : 'text-gray-700 hover:text-green-600'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    {/* Left Side (RTL) - Social Icons & Mobile Menu Toggle */}
                    <div className="flex-shrink-0 flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-4 text-[#5f6368]">
                            {socialLinks.map((item, idx) => (
                                <a 
                                    key={idx} 
                                    href={item.href} 
                                    className="hover:text-green-600 transition-colors"
                                    onClick={handleSocialClick}
                                >
                                    <item.Icon className="w-5 h-5" />
                                </a>
                            ))}
                        </div>
                        
                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden text-gray-700 focus:outline-none p-2"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-label={isMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
                            aria-expanded={isMenuOpen}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden border-t border-gray-100 bg-white p-4">
                     <nav className="flex flex-col space-y-3">
                        {navItems.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleNavClick(item.view as AppView, (item as any).specialTab)}
                                className={`text-right font-bold py-2 ${
                                    item.isActive ? 'text-green-600' : 'text-gray-700 hover:text-green-600'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                     </nav>
                     <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-gray-100 text-[#5f6368]">
                        {socialLinks.map((item, idx) => (
                            <a 
                                key={idx} 
                                href={item.href} 
                                className="hover:text-green-600"
                                onClick={handleSocialClick}
                            >
                                <item.Icon className="w-6 h-6" />
                            </a>
                        ))}
                     </div>
                </div>
            )}
        </header>
    );
};

export default React.memo(Header);
