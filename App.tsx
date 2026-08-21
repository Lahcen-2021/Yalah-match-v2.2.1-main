
import React, { useState, useEffect, useMemo, Suspense, useRef, useCallback } from 'react';
import { ChevronUp } from 'lucide-react';
import Header, { AppView, DateTab } from './components/Header';
import Hero from './components/Hero';
import DateTabs from './components/DateTabs';
import MatchCard from './components/MatchCard';
import Footer from './components/Footer';
import LoadingIndicator from './components/LoadingIndicator';
import LiveMatchBanner from './components/LiveMatchBanner';
import { Match, MatchStatus, NewsItem } from './types';
import { fetchMatchesByDate, fetchLiveMatches, mapStingMatchToMatch, getMoroccanDateString, preloadKoooraData, syncWithServer } from './services/api';
import SkeletonCard from './components/SkeletonCard';
import LazyLoadWrapper from './components/LazyLoadWrapper';
import { generateMatchSlug, isMajorLeague, translateLeague } from './utils/translations';
import { setPageMeta, setMatchJsonLd, removeMatchJsonLd } from './utils/seo';
import { useCache } from './context/CacheContext';

// Lazy load view components
const MatchDetailView = React.lazy(() => import('./components/MatchDetailView'));
const TournamentsView = React.lazy(() => import('./components/TournamentsView'));
const StandingsView = React.lazy(() => import('./components/StandingsView'));
const ContactUsView = React.lazy(() => import('./components/ContactUsView'));
const PrivacyPolicyView = React.lazy(() => import('./components/PrivacyPolicyView'));
const TermsView = React.lazy(() => import('./components/TermsView'));
const NewsView = React.lazy(() => import('./components/NewsView'));
const NewsArticleView = React.lazy(() => import('./components/NewsView').then(m => ({ default: m.NewsArticleView })));


class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  componentDidMount() {
    this.errorHandler = (event: ErrorEvent) => {
      if (event.message === 'Script error.') {
        console.warn('Caught generic "Script error.". This is usually a CORS issue with a cross-origin script.');
      }
    };

    window.addEventListener('error', this.errorHandler);
  }

  componentWillUnmount() {
    if (this.errorHandler) window.removeEventListener('error', this.errorHandler);
  }

  private errorHandler?: (e: ErrorEvent) => void;

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-gray-50 font-tajawal">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md border border-gray-100">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-4">عذراً، حدث خطأ غير متوقع</h1>
            <p className="text-gray-500 mb-8 leading-relaxed">نواجه بعض الصعوبات التقنية حالياً. يرجى إعادة تحميل الصفحة.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const MAJOR_LEAGUES_PRIORITY: Record<string, number> = {
    'كأس إفريقيا تحت 17': -1,
    'كأس إفريقيا لأقل من 17 سنة': -1,
    'كأس العالم': 0,
    'كأس إفريقيا': 1,
    'كأس أوروبا': 2,
    'كأس آسيا': 3,
    'كأس العرب': 4,
    'كأس العالم للأندية': 5,
    'دوري أبطال أوروبا': 6,
    'champions league': 6,
    'دوري أبطال أفريقيا': 7,
    'caf champions': 7,
    'دوري أبطال آسيا': 8,
    'afc champions': 8,
    'الدوري الأوروبي': 9,
    'europa league': 9,
    'دوري المؤتمر الأوروبي': 10,
    'conference league': 10,
    'الدوري المغربي': 11,
    'botola': 11,
    'دوري روشن السعودي': 12,
    'الدوري السعودي': 12,
    'saudi professional': 12,
    'الدوري الإماراتي': 13,
    'uae pro': 13,
    'كأس ملك إسبانيا': 14,
    'copa del rey': 14,
    'كأس الاتحاد الإنجليزي': 15,
    'fa cup': 15,
    'كأس رابطة المحترفين الإنجليزية': 16,
    'carabao cup': 16,
    'كأس إيطاليا': 17,
    'coppa italia': 17,
    'كأس ألمانيا': 18,
    'dfb pokal': 18,
    'كأس فرنسا': 19,
    'coupe de france': 19,
    'كأس السوبر الإسباني': 20,
    'كأس السوبر الإنجليزي': 21,
    'كأس السوبر الإيطالي': 22,
    'كأس السوبر الألماني': 23,
    'كأس السوبر الفرنسي': 24,
    'كأس السوبر الأوروبي': 25,
    'الدوري الإنجليزي الممتاز': 26,
    'الدوري الإنجليزي': 26,
    'premier league': 26,
    'الدوري الإسباني': 27,
    'la liga': 27,
    'الدوري الإيطالي': 28,
    'serie a': 28,
    'الدوري الألماني': 29,
    'bundesliga': 29,
    'الدوري الفرنسي': 30,
    'ligue 1': 30,
    'الدوري الهولندي': 31,
    'eredivisie': 31
};

const MAJOR_LEAGUES_KEYS = Object.keys(MAJOR_LEAGUES_PRIORITY);

// URL path → view. The single source of truth for which paths are real routes;
// App's META map below keys the per-route <title>/canonical off the same views.
const STATIC_ROUTES: Record<string, AppView> = {
    '/': 'matches',
    '/tournaments': 'tournaments',
    '/standings': 'standings',
    '/news': 'news',
    '/contact': 'contact',
    '/privacy': 'privacy',
    '/terms': 'terms',
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

const AppContent: React.FC = () => {
  const { fetchWithCache } = useCache();
  const [activeTab, setActiveTab] = useState<DateTab>('today');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [directMatch, setDirectMatch] = useState<Match | null>(null); // For matches passed via navigation state
  const [view, setView] = useState<AppView>('matches');
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [standingsLeagueId, setStandingsLeagueId] = useState<string | null>(null);
  const [targetSlug, setTargetSlug] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Timezone offset affects how match times render, so this stays on the critical path.
    syncWithServer().catch(() => {});
  }, [activeTab]);

  useEffect(() => {
    // Commentator data only matters once a match detail is opened — warm its cache during
    // idle time so it never competes with first paint of the match list (lowers TBT).
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    const run = () => { preloadKoooraData().catch(() => {}); };
    if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(run, { timeout: 3000 });
    } else {
        const t = setTimeout(run, 2000);
        return () => clearTimeout(t);
    }
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleLocationChange = () => {
        let path = '/';
        try {
            path = decodeURIComponent(window.location.pathname);
        } catch (e) {
            console.error("Malformed URL:", e);
            path = window.location.pathname; // Fallback
        }
        
        const state = window.history.state;

        // Reset direct match if going back to root or non-match page
        if (path === '/' || (!path.includes('-ضد-') && !path.includes('-vs-'))) {
             setDirectMatch(null);
        }

        // Check for match passed via state (e.g. from StandingsView)
        if (state && state.match) {
             setDirectMatch(state.match);
             setSelectedMatchId(state.match.id);
             setTargetSlug(null);
             return; // Skip other checks
        }

        // Restore a news article page when navigating back/forward to it.
        if (state && state.news) {
             setSelectedNews(state.news);
             setView('news');
             setSelectedMatchId(null);
             setDirectMatch(null);
             setTargetSlug(null);
             return;
        }
        // Any other navigation leaves the article page.
        setSelectedNews(null);

        // 0. Static routes. Without this, a direct hit or a crawl of /news, /standings,
        //    /tournaments, /contact, /privacy or /terms fell through to the homepage:
        //    the view stayed 'matches' AND setPageMeta then wrote the homepage's own
        //    canonical, so six distinct URLs served identical content that pointed its
        //    canonical somewhere else. Those URLs are in the sitemap, so search engines
        //    were being handed the duplicate.
        const staticRoute = STATIC_ROUTES[path.replace(/\/$/, '') || '/'];
        if (staticRoute) {
            setView(staticRoute);
            setSelectedMatchId(null);
            setDirectMatch(null);
            setTargetSlug(null);
            return;
        }

        // 1. Check for legacy ID format: /match/123
        const matchIdMatch = path.match(/^\/match\/(\d+)$/);
        if (matchIdMatch && matchIdMatch[1]) {
            setSelectedMatchId(parseInt(matchIdMatch[1], 10));
            setTargetSlug(null);
            return;
        }

        // 2. Current format: /مباراة-اليوم/Home-ضد-Away-YYYY-MM-DD (trailing slash tolerated)
        const newSlugMatch = path.match(/^\/مباراة-اليوم\/.+-ضد-.+-(\d{4}-\d{2}-\d{2})\/?$/);
        // 2b. Legacy two-segment format: /Home-vs-Away/YYYY-MM-DD (trailing slash tolerated)
        const slugMatch = !newSlugMatch && path.match(/^\/.+-vs-.+\/\d{4}-\d{2}-\d{2}\/?$/);
        // 2c. Legacy/shared single-segment format: /Home-vs-Away-DD-MM-YYYY (with or without trailing slash)
        const legacySlugMatch = !newSlugMatch && !slugMatch && path.match(/^\/(.+)-vs-(.+)-(\d{2})-(\d{2})-(\d{4})\/?$/);

        const applyDateTab = (dateStr: string) => {
            const today = new Date();
            const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
            const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
            const toDateStr = (d: Date) => d.toISOString().split('T')[0];

            if (dateStr === toDateStr(today)) {
                if (activeTab !== 'today') setActiveTab('today');
            } else if (dateStr === toDateStr(yesterday)) {
                if (activeTab !== 'yesterday') setActiveTab('yesterday');
            } else if (dateStr === toDateStr(tomorrow)) {
                if (activeTab !== 'tomorrow') setActiveTab('tomorrow');
            }
        };

        if (newSlugMatch) {
            const foundSlug = newSlugMatch[0].replace(/\/$/, '');
            setTargetSlug(foundSlug);
            applyDateTab(newSlugMatch[1]);
        } else if (slugMatch) {
            const foundSlug = slugMatch[0].replace(/\/$/, '');

            const parts = foundSlug.split('/');
            const dateStr = parts[parts.length - 1];
            // Reconstruct the canonical current-format slug so it matches generateMatchSlug() output.
            const [, home, away] = foundSlug.match(/^\/(.+)-vs-(.+)$/) || [];
            const teams = (home && away) ? `${home}-vs-${away}` : parts[0].slice(1);
            const [teamHome, teamAway] = teams.split('-vs-');
            setTargetSlug(teamHome && teamAway ? `/مباراة-اليوم/${teamHome}-ضد-${teamAway}-${dateStr}` : foundSlug);

            applyDateTab(dateStr);
        } else if (legacySlugMatch) {
            // Reconstruct the canonical current-format slug from the legacy DD-MM-YYYY link
            const [, home, away, dd, mm, yyyy] = legacySlugMatch;
            const dateStr = `${yyyy}-${mm}-${dd}`;
            setTargetSlug(`/مباراة-اليوم/${home}-ضد-${away}-${dateStr}`);

            applyDateTab(dateStr);
        } else {
            // Only reset if we are not explicitly in a different view (handled by state)
            // But if URL is root, we generally want to clear match selection
            if (path === '/' || path === '') {
                setSelectedMatchId(null);
            }
            setTargetSlug(null);
        }
    };

    window.addEventListener('popstate', handleLocationChange);
    handleLocationChange(); 

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, [activeTab]);

  useEffect(() => {
      if (targetSlug && matches.length > 0) {
          const match = matches.find(m => {
              const slug = generateMatchSlug(m.teamA.name, m.teamB.name, m.utcDate);
              return slug === targetSlug;
          });
          
          if (match) {
              setTimeout(() => {
                  setSelectedMatchId(match.id);
                  setTargetSlug(null); 
              }, 0);
          }
      }
  }, [matches, targetSlug]);
  
  useEffect(() => {
    if (selectedMatchId) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [selectedMatchId]);

  useEffect(() => {
    // Allow fetch if view is matches OR if we are trying to resolve a slug (even from other views)
    if (view !== 'matches' && !targetSlug) {
        setTimeout(() => setLoading(false), 0);
        return;
    }

    let intervalId: any;
    
    const fetchMatches = async (showLoading = true) => {
        if (showLoading) {
            setLoading(true);
            setMatches([]); // Clear matches when loading a different tab
        }
        setError(null);
        try {
            const data = await fetchMatchesByDate(activeTab as any);
            processNewData(data, showLoading);
            
            if (activeTab === 'today') {
                updateLiveMatches();
            }
            
            setLoading(false);
        } catch (err: any) {
            console.error("Error fetching matches:", err);
            setError(err.message || 'خطأ في الاتصال.');
            setLoading(false);
        }
    };

    const updateLiveMatches = async () => {
        if (activeTab !== 'today') return;
        try {
            const liveMatches = await fetchLiveMatches();
            if (liveMatches.length > 0) {
                processNewData(liveMatches, false);
            }
        } catch (err) {
            console.debug("Live update failed", err);
        }
    };

    const processNewData = (newData: Match | Match[], isFullRefresh = true) => {
        const dataArray = Array.isArray(newData) ? newData : [newData];
        setMatches(prevMatches => {
            if (isFullRefresh) return dataArray;

            const updatedMatches = [...prevMatches];
            
            dataArray.forEach((updated: Match) => {
                const index = updatedMatches.findIndex(m => m.id === updated.id);

                if (index !== -1) {
                    updatedMatches[index] = { ...updatedMatches[index], ...updated };
                } else { 
                    updatedMatches.push(updated);
                }
            });

            return updatedMatches;
        });
        setLastUpdated(new Date().toLocaleTimeString('ar-MA', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit' }));
    };

    const startInterval = () => {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(() => {
            if (!document.hidden) {
                if (activeTab === 'today') {
                    updateLiveMatches();
                } else {
                    fetchMatches(false);
                }
            }
        }, 60000); // backend edge-caches 30s + upstream relay refreshes every 10min, so a
                   // faster poll returns identical bytes and burns the 120 req/min/IP limit
    };

    const handleVisibilityChange = () => {
        if (!document.hidden) {
            fetchMatches(false);
            startInterval();
        } else {
            if (intervalId) clearInterval(intervalId);
        }
    };

    fetchMatches(true).catch(() => {});
    startInterval();
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab, view, targetSlug]);

  const sortedMatches = useMemo(() => {
    // Admin-created and admin force-shown matches always show, even if their
    // competition isn't a "major" league.
    const matchesToSort = matches.filter(m => m.isCustom || m.adminShown || isMajorLeague(m.league));

    const getStatusPriority = (match: Match) => {
        // Order: Live, Half Time, Upcoming, Finished, Postponed
        if (match.status === MatchStatus.LIVE) return 0;
        if (match.status === MatchStatus.HALF_TIME) return 1;
        if (match.status === MatchStatus.UPCOMING) return 2;
        if (match.status === MatchStatus.FINISHED) {
            if (match.statusText.includes('مؤجلة') || match.statusText.includes('تأجلت')) return 4;
            return 3;
        }
        return 5;
    };

    const getLeaguePriority = (leagueName: string) => {
        if (!leagueName) return 999;
        const name = leagueName.toLowerCase();
        
        // Fast path: find first matching key
        for (const key of MAJOR_LEAGUES_KEYS) {
            if (name.includes(key)) return MAJOR_LEAGUES_PRIORITY[key];
        }
        
        return isMajorLeague(leagueName) ? 100 : 999;
    };

    matchesToSort.sort((a, b) => {
        // 1. Status Priority (Live first, Postponed last)
        const statusPriorityA = getStatusPriority(a);
        const statusPriorityB = getStatusPriority(b);
        if (statusPriorityA !== statusPriorityB) return statusPriorityA - statusPriorityB;

        // 2. Time Priority (Ascending)
        // Optimization: Use valueOf() or simple subtraction
        const timeA = a.utcDate ? new Date(a.utcDate).getTime() : 0;
        const timeB = b.utcDate ? new Date(b.utcDate).getTime() : 0;
        if (timeA !== timeB) return timeA - timeB;

        // 3. League Priority (Major leagues first for same time)
        const leaguePriorityA = getLeaguePriority(a.league);
        const leaguePriorityB = getLeaguePriority(b.league);
        if (leaguePriorityA !== leaguePriorityB) return leaguePriorityA - leaguePriorityB;

        return a.league.localeCompare(b.league, 'ar');
    });

    return matchesToSort;
  }, [matches]);

  const selectedMatch = useMemo(() => {
    // Prefer match passed via navigation state (directMatch)
    if (directMatch && directMatch.id === selectedMatchId) return directMatch;
    
    if (!selectedMatchId) return null;
    return matches.find(m => m.id === selectedMatchId) || null;
  }, [selectedMatchId, matches, directMatch]);

  // Per-route SEO metadata: a match page gets its own title/description/canonical +
  // SportsEvent JSON-LD; every other view gets a distinct title so Google stops
  // indexing them all as the homepage.
  useEffect(() => {
    if (selectedMatch) {
      const slug = generateMatchSlug(selectedMatch.teamA?.name || '', selectedMatch.teamB?.name || '', selectedMatch.utcDate || '');
      const league = selectedMatch.league ? translateLeague(selectedMatch.league) : '';
      // Title carries the two highest-intent modifiers people actually type alongside a
      // fixture — "بث مباشر" first, then the competition. Search Console shows the site
      // ranking only for brand terms today; per-match queries are where the volume is.
      const a = selectedMatch.teamA?.name;
      const b = selectedMatch.teamB?.name;
      const title = `${a} ضد ${b} بث مباشر${league ? ' - ' + league : ''}`;
      const description = `مشاهدة مباراة ${a} و${b} بث مباشر${league ? ' في ' + league : ''}: موعد المباراة، القنوات الناقلة والمعلق، التشكيلات، الأحداث والنتيجة المباشرة لحظة بلحظة على يلا ماتش.`;
      // Long-tail phrasings of the same fixture — these mirror how the query is typed,
      // not just the team names.
      const keywords = [
          a, b, league,
          `${a} ضد ${b}`,
          `مباراة ${a} و${b}`,
          `مشاهدة مباراة ${a} ضد ${b} بث مباشر`,
          `موعد مباراة ${a} و${b}`,
          `القناة الناقلة لمباراة ${a} و${b}`,
          'بث مباشر', 'مباريات اليوم', 'القنوات الناقلة', 'المعلق',
      ].filter(Boolean).join(', ');
      setPageMeta({ title, description, path: slug, keywords });
      setMatchJsonLd(selectedMatch, slug);
      return () => removeMatchJsonLd();
    }
    removeMatchJsonLd();
    const META: Record<AppView, { title?: string; path?: string; description?: string }> = {
      matches: { path: '/' },
      tournaments: { title: 'الدوريات والبطولات', path: '/tournaments' },
      standings: { title: 'ترتيب الدوريات والبطولات', path: '/standings' },
      news: { title: 'آخر أخبار كرة القدم', path: '/news' },
      contact: { title: 'اتصل بنا', path: '/contact' },
      privacy: { title: 'سياسة الخصوصية', path: '/privacy' },
      terms: { title: 'الشروط والأحكام', path: '/terms' },
    };
    const m = META[view] || {};
    setPageMeta({ title: m.title, description: m.description, path: m.path });
  }, [selectedMatch, view]);

  const navigateToRoot = useCallback(() => {
      // Explicitly clear state first to ensure UI update even if pushState fails
      setSelectedMatchId(null);
      setDirectMatch(null);
      setTargetSlug(null);
      setSelectedNews(null);

      try {
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
      } catch (e) {
          console.warn('Navigation history update failed (ignoring):', e);
      }

      window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Wrapper to handle view switching and ensure match details are closed
  const handleSetView = useCallback((newView: AppView) => {
      setSelectedMatchId(null);
      setDirectMatch(null);
      setTargetSlug(null);
      setSelectedNews(null);
      setView(newView);
      
      try {
          if (window.location.pathname !== '/' && window.location.pathname !== '') {
               window.history.pushState({}, '', '/');
          }
      } catch (e) {
          console.warn('URL update blocked during view change (ignoring):', e);
      }
      
      window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const handleMatchClick = useCallback((match: Match) => {
      setDirectMatch(match);
      setSelectedMatchId(match.id);
      const matchSlug = generateMatchSlug(match.teamA.name, match.teamB.name, match.utcDate);
      
      try {
          // Attempt to update URL for history support, but don't break if blocked
          window.history.pushState({ match }, '', matchSlug);
      } catch (e) {
          console.warn("URL update blocked (ignoring):", e);
      }
      
      window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Opens a news story as a full page (not a modal). Works from the news list and
  // from the homepage hero slider.
  const handleNewsClick = useCallback((item: NewsItem) => {
      setSelectedMatchId(null);
      setDirectMatch(null);
      setTargetSlug(null);
      setSelectedNews(item);
      setView('news');

      try {
          window.history.pushState({ news: item }, '', '/news');
      } catch (e) {
          console.warn('URL update blocked (ignoring):', e);
      }

      window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const handleNewsBack = useCallback(() => {
      setSelectedNews(null);
      try {
          window.history.pushState({}, '', '/');
      } catch (e) {
          console.warn('URL update blocked (ignoring):', e);
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const liveMatches = useMemo(() => {
    return matches.filter(m => m.status === MatchStatus.LIVE || m.status === MatchStatus.HALF_TIME);
  }, [matches]);

  const renderListView = () => {
    const renderContent = () => {
      if (loading) {
        return (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        );
      }

      if (error) {
         return (
          <div className="text-center py-10 text-red-600 bg-red-50 rounded-lg animate-fadeInUp">
              <p className="font-semibold">خطأ في الاتصال</p>
              <p>{error}</p>
              <p className="text-sm mt-2 text-gray-500 mb-4">تحقق من اتصال الإنترنت أو حاول مرة أخرى لاحقاً.</p>
              <button 
                onClick={() => window.location.reload()} 
                className="px-6 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-colors shadow-md"
              >
                إعادة المحاولة
              </button>
          </div>
        );
      }

      if (sortedMatches.length > 0) {
        return sortedMatches.map((match, index) => (
          <LazyLoadWrapper key={match.id} placeholderHeight="180px">
            <MatchCard 
              match={match} 
              index={index}
              onClick={handleMatchClick} 
              isTomorrow={activeTab === 'tomorrow'}
            />
          </LazyLoadWrapper>
        ));
      }

      return (
        <div className="text-center py-10 text-gray-500 animate-fadeInUp">
            <p>لا توجد مباريات لعرضها في هذا اليوم.</p>
        </div>
      );
    };

    return (
        <>
            <Hero onNewsClick={() => handleSetView('news')} onOpenArticle={handleNewsClick} />
            <DateTabs activeTab={activeTab} setActiveTab={setActiveTab} />

            <div className="grid gap-4 md:gap-6 max-w-6xl mx-auto match-list-container">
                {renderContent()}
            </div>
        </>
    );
  };
  
  const renderDetailView = () => {
    if (loading && !selectedMatch) {
      return <LoadingIndicator />;
    }
    if (selectedMatch) {
      return (
        <MatchDetailView 
          match={selectedMatch} 
          onBack={navigateToRoot} 
        />
      );
    }
    return (
        <div className="text-center py-10 text-gray-500 animate-fadeInUp">
            <p className="font-semibold">لم يتم العثور على المباراة</p>
            <p className="mt-2">قد تكون المباراة التي تبحث عنها في يوم مختلف.</p>
            <button 
                onClick={navigateToRoot}
                className="mt-4 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
                العودة إلى القائمة
            </button>
        </div>
    )
  };

  const renderCurrentView = () => {
      if (selectedMatchId) {
          return renderDetailView();
      }
      switch (view) {
        case 'tournaments':
          return <TournamentsView onLeagueSelect={(id) => { setStandingsLeagueId(id); handleSetView('standings'); }} />;
        case 'standings':
          return <StandingsView initialLeagueId={standingsLeagueId} onMatchClick={handleMatchClick} onBackToTournaments={() => handleSetView('tournaments')} />;
        case 'news':
          return selectedNews
            ? <NewsArticleView key={selectedNews.id} item={selectedNews} onBack={handleNewsBack} />
            : <NewsView onOpenArticle={handleNewsClick} />;
        case 'contact':
          return <ContactUsView />;
        case 'privacy':
          return <PrivacyPolicyView />;
        case 'terms':
          return <TermsView />;
        case 'matches':
        default:
          return renderListView();
      }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        view={view}
        setView={handleSetView}
      />
      <main className={`flex-grow ${ (selectedMatchId || view === 'standings') ? 'w-full px-0' : 'container mx-auto px-2 sm:px-6 lg:px-8'}`}>
        <Suspense fallback={<LoadingIndicator />}>
            {renderCurrentView()}
        </Suspense>
      </main>
      <Footer setView={handleSetView} />

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-2 right-2 sm:bottom-6 sm:right-10 z-50 p-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center border-2 border-white/20"
          aria-label="Scroll to top"
        >
          <ChevronUp size={10} strokeWidth={3} className="sm:hidden" />
          <ChevronUp size={20} strokeWidth={3} className="hidden sm:block" />
        </button>
      )}
    </div>
  );
};

export default App;
