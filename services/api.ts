
import { Match, MatchStatus, MatchDetails, GoalEvent, TimelineEvent, Standing, Player, MatchStatistic, GoalInfo, H2HMatch, MatchInfo, Scorer, StandingGroup, Coach, ChannelInfo, CompetitionBracket, NewsItem, NewsArticle } from '../types';
import { translateLeague, translateTeam, isMajorLeague, isStandingLeague } from '../utils/translations';

type DateString = 'yesterday' | 'today' | 'tomorrow';

// Proxy rotation configuration
const PROXIES = [
    (url: string) => {
        if (url.startsWith('http')) {
            // Check if we are hosted on Netlify vs local AI Studio
            const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const isAIStudio = typeof window !== 'undefined' && window.location.hostname.includes('run.app');
            const isNetlify = typeof window !== 'undefined' && (window.location.hostname.includes('netlify.app') || window.location.hostname.includes('yallamatch.online'));
            
            if (isLocal || isAIStudio) return `/api/proxy?url=${encodeURIComponent(url)}`;
            if (isNetlify) return `/.netlify/functions/kooora-proxy?url=${encodeURIComponent(url)}`;
            
            // Default fallback
            return `/api/proxy?url=${encodeURIComponent(url)}`;
        }
        return url;
    },
    (url: string) => {
        if (url.startsWith('http')) {
            return `https://yallamatch.pages.dev/api/proxy?url=${encodeURIComponent(url)}`;
        }
        return url;
    },
    (url: string) => url.startsWith('http') ? `https://api.allorigins.win/get?url=${encodeURIComponent(url)}` : url,
];

// Helper to get the API base URL
const getApiBase = () => {
    const isNetlify = typeof window !== 'undefined' && (window.location.hostname.includes('netlify.app') || window.location.hostname.includes('yallamatch.online'));
    return isNetlify ? 'https://yallamatch.pages.dev' : '';
};

let serverTimeOffset = 0;

export const getServerNow = () => Date.now() + serverTimeOffset;

export const syncWithServer = async () => {
    try {
        const start = Date.now();
        const res = await fetch(`${getApiBase()}/api/health`);
        const json = await res.json();
        const end = Date.now();
        if (json.timestamp) {
            const serverTime = new Date(json.timestamp).getTime();
            const localTime = (start + end) / 2;
            serverTimeOffset = serverTime - localTime;
            console.log(`[Sync] Server time offset: ${serverTimeOffset}ms`);
        }
    } catch (e) {
        console.debug("Error in syncWithServer", e);
    }
};

// User Timezone (detected from device, with Africa/Casablanca as fallback)
export const USER_TIMEZONE = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Africa/Casablanca';

const arabicNormalizationCache = new Map<string, string>();

const normalizeArabic = (text: string) => {
    if (!text) return '';
    
    // Check cache first
    const cached = arabicNormalizationCache.get(text);
    if (cached) return cached;
    
    // De-accent and simplify English text before processing
    const simplified = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // If it's mostly English, try translating it first
    const translated = /^[a-zA-Z\s.-]+$/.test(simplified) ? translateTeam(simplified) : simplified;
    
    const result = translated.trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ي$/g, 'ي') // Normalize trailing y
        .replace(/ئ/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/[\u064B-\u065F]/g, '') // Remove harakat
        .replace(/\s+/g, ' ');
        
    // Limit cache size to avoid memory issues
    if (arabicNormalizationCache.size > 2000) arabicNormalizationCache.clear();
    arabicNormalizationCache.set(text, result);
    
    return result;
};

const isFuzzyMatch = (normName: string, normTeam: string) => {
    if (!normName || !normTeam) return false;
    if (normName === normTeam) return true;
    
    // If one is Arabic and other is Latin, try translating the Latin one
    const isLatin = (s: string) => /^[a-zA-Z\s.,|&/-]+$/.test(s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const isAr = (s: string) => /[\u0600-\u06FF]/.test(s);
    
    if (isAr(normTeam) && isLatin(normName)) {
        // Try to translate individual words or the whole thing
        const simplified = normName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const translated = translateTeam(simplified);
        if (translated !== simplified) {
            return isFuzzyMatch(normalizeArabic(translated), normTeam);
        }
        // Try word by word for complex match names (like "Arsenal v Atletico")
        const words = simplified.split(/\s+(?:v|vs|ضد|-)\s+/i);
        if (words.length > 1) {
            for (const word of words) {
                const trWord = translateTeam(word.trim());
                if (isFuzzyMatch(normalizeArabic(trWord), normTeam)) return true;
            }
        }
    }

    if (normName.includes(normTeam) || normTeam.includes(normName)) return true;
    
    // Check for reversed match (for "Team A vs Team B" where names might be swapped)
    if (normName.includes(' ضد ') || normName.includes(' vs ')) {
        const parts = normName.split(/\s+(?:ضد|vs)\s+/);
        if (parts.length === 2) {
            const p1 = parts[0].trim();
            const p2 = parts[1].trim();
            if ((isFuzzyMatch(p1, normTeam) || isFuzzyMatch(p2, normTeam))) return true;
        }
    }

    // Try removing common prefixes
    const prefixes = /^(نادي|ال|اولمبيك|ستاد|اتلتيكو|ريال|اف\s+سي|نادي)\s+/;
    const cleanTeam = normTeam.replace(prefixes, '').trim();
    const cleanName = normName.replace(prefixes, '').trim();
    if (cleanName.includes(cleanTeam) || cleanTeam.includes(cleanName)) return true;

    // Check for partial matches (first word if it's long enough)
    const words = normTeam.split(' ');
    if (words[0] && words[0].length >= 3) {
        if (normName.includes(words[0])) return true;
    }
    
    // Special case for phonetic differences (e.g. AEK)
    if (normTeam.includes('ايك') && normName.includes('اي اي ك')) return true;
    if (normTeam.includes('اي اي ك') && normName.includes('ايك')) return true;
    
    // Special case for "ت" prefix in some transliterations (e.g. Celje)
    if (normTeam.startsWith('ت') && normName.includes(normTeam.substring(1))) return true;
    if (normName.includes('ت' + normTeam)) return true;
    
    // Check for common aliases
    const aliases: Record<string, string[]> = {
        'ريال مدريد': ['الريال', 'مدريد'],
        'برشلونه': ['البارسا', 'برسا'],
        'مانشستر سيتي': ['مان سيتي', 'السيتي'],
        'مانشستر يونايتد': ['مان يونايتد', 'اليونايتد'],
        'بايرن ميونخ': ['البايرن', 'ميونخ'],
        'باريس سان جيرمان': ['باريس', 'بي اس جي', 'سان جيرمان'],
        'اولمبيك مارسيليا': ['مارسيليا'],
        'اولمبيك ليون': ['ليون'],
        'ستاد رين': ['رين'],
        'ستراسبورج': ['ستراسبورغ'],
        'ليل': ['لو بوانت ليل'],
        'نيس': ['نيس'],
        'لانس': ['لانس'],
        'نانت': ['نانت'],
        'تولوز': ['تولوز'],
        'مونبلييه': ['مونبلييه'],
        'بريست': ['بريست'],
        'لوريان': ['لوريان'],
        'أوكسير': ['أوكسير'],
        'أنجيه': ['أنجيه'],
        'ستاد ريمس': ['ريمس'],
        'ليفربول': ['الريدز'],
        'ميلان': ['الروسونيري'],
        'انتر ميلان': ['الانتر'],
        'يوفنتوس': ['اليوفي'],
        'النصر': ['العالمي'],
        'الهلال': ['الزعيم'],
        'الاتحاد': ['العميد'],
        'الاهلي': ['الراقي', 'نادي القرن'],
        'الوداد': ['الواك'],
        'الرجاء': ['الرجا'],
        'ايك اثينا': ['أي إي ك أثينا', 'أيك', 'أي إي ك', 'ايك'],
        'تسيليي': ['سيليي', 'تسيليي', 'سيليه', 'سيليي nk', 'سيليه nk'],
        'شاختار دونيتسك': ['شاختار', 'شاختار دونتسك', 'شاختار دونيستك'],
        'ليخ بوزنان': ['ليك بوزنان', 'ليخ', 'ليك', 'ليخ بوزنان بولندا'],
        'رييكا': ['رييكا', 'رييكا كرواتيا', 'رييكا hnk'],
        'ارسنال': ['الارسنال', 'الغانرز'],
        'تشيلسي': ['البلوز'],
        'توتنهام': ['السبيرز'],
        'اتلتيكو مدريد': ['الأتليتي', 'اتلتيكو'],
        'بوروسيا دورتموند': ['دورتموند'],
        'روما': ['الذئاب'],
        'نابولي': ['البارتينوبي'],
        'اياكس': ['العملاق الهولندي']
    };

    for (const [key, list] of Object.entries(aliases)) {
        const normKey = normalizeArabic(key);
        if (normTeam.includes(normKey) || normKey.includes(normTeam)) {
            for (const alias of list) {
                if (normName.includes(normalizeArabic(alias))) return true;
            }
        }
    }

    return false;
};


export const getKoooraDataForDates = async (dates: string[]) => {
    try {
        return await Promise.all(dates.map(date => fetchKoooraData(date).catch(e => {
            console.warn(`Failed to fetch kooora data for date ${date}`, e);
            return null;
        })));
    } catch (e) {
        console.warn("Failed to fetch kooora data for dates", e);
        return [];
    }
};



// --- Persistent Cache Helpers ---
const getStorageItem = (key: string) => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved) return null;
        const parsed = JSON.parse(saved);
        if (Date.now() - parsed.timestamp > parsed.ttl) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.value;
    } catch { return null; }
};

const setStorageItem = (key: string, value: any, ttl = 30 * 60 * 1000) => {
    try {
        localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now(), ttl }));
    } catch (e) { console.warn("Storage full", e); }
};

// Global promise for Kooora data to avoid redundant requests
const koooraDataPromise: Record<string, Promise<any> | null> = {};

const fetchKoooraData = async (date?: string) => {
    const targetDate = date ? date.split('T')[0] : getMoroccanDateString(0);
    
    if (koooraDataPromise[targetDate]) {
        return koooraDataPromise[targetDate];
    }

    // Check persistent storage first for fast load
    const cached = getStorageItem(`kooora_data_${targetDate}`);
    if (cached) {
        return { success: true, data: cached };
    }

    koooraDataPromise[targetDate] = (async () => {
        try {
            // Try local server API first to benefit from server-side caching and proxy rotation
            const apiUrl = `/api/kooora/channels?date=${targetDate}`;
            try {
                const res = await fetch(apiUrl);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.data) {
                        setStorageItem(`kooora_data_${targetDate}`, json.data, 30 * 60 * 1000);
                        return json;
                    }
                }
            } catch (e) {
                console.warn("Local server Kooora API fetch failed, falling back to absolute URL", e);
            }

            // Fallback to absolute yallamatch API via proxy if local server failed
            const fallbackApiUrl = `https://yallamatch.pages.dev/api/kooora/channels?date=${targetDate}`;
            try {
                const res = await fetchWithRetry(fallbackApiUrl, 8000);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.data) {
                        setStorageItem(`kooora_data_${targetDate}`, json.data, 30 * 60 * 1000);
                        return json;
                    }
                }
            } catch (e) {
                console.warn("Kooora absolute API fetch failed, falling back to other sources", e);
            }

            const allMatches: any[] = [];

            // Try LiveOnSat absolute API
            try {
                const losUrl = `https://yallamatch.pages.dev/api/liveonsat/channels?date=${targetDate}`;
                const res = await fetchWithRetry(losUrl, 5000);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.matches) {
                        const losMatches = json.matches.map((m: any) => ({
                            name: m.match,
                            channels: (m.channels || []).map((c: any) => ({ name: typeof c === 'string' ? c : c.name }))
                        }));
                        allMatches.push(...losMatches);
                    }
                }
            } catch (e) {
                console.warn("LiveOnSat direct API fetch failed in KoooraData", e);
            }

            const isToday = targetDate === getMoroccanDateString(0);
            
            const urlsToScrape = [];
            if (isToday) {
                urlsToScrape.push('https://www.kooora.com/%D8%A3%D8%AD%D8%AF%D8%A7%D8%AB-%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9/%D9%83%D8%B1%D8%A9-%D8%A7%D9%84%D9%82%D8%AF%D9%85');
                urlsToScrape.push('https://www.kooora.com/%D9%83%D8%B1%D8%A9-%D8%A7%D9%84%D9%82%D8%AF%D9%85/%D9%85%D8%A8%D8%A7%D8%B1%D9%8A%D8%A7%D8%AA-%D8%A7%D9%84%D9%8A%D9%88%D9%85');
            } else {
                const [year, month, day] = targetDate.split('-');
                urlsToScrape.push(`https://www.kooora.com/default.aspx?region=-1&area=0&dd=${parseInt(day)}&mm=${parseInt(month)}&yy=${year}`);
            }

            // Parallelize scraping if multiple URLs
            await Promise.all(urlsToScrape.map(async (koooraUrl) => {
                try {
                    const res = await fetchWithRetry(koooraUrl, 5000);
                    const html = await res.text();
                    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
                    if (match) {
                        const data = JSON.parse(match[1]);
                        const pageData = data.props?.pageProps?.data || {};
                        
                        // Structure 1: scheduleGroups
                        const scheduleGroups = pageData.scheduleGroups || [];
                        scheduleGroups.forEach((group: any) => {
                            (group.events || []).forEach((m: any) => {
                                allMatches.push({
                                    name: m.name,
                                    url: m.urlLink?.url,
                                    channels: (m.schedule || []).map((s: any) => ({ name: s.name }))
                                });
                            });
                        });

                        // Structure 2: indexed data
                        Object.keys(pageData).forEach(key => {
                            const group = pageData[key];
                            if (group && group.matches && Array.isArray(group.matches)) {
                                group.matches.forEach((m: any) => {
                                    let matchName = m.name;
                                    if (!matchName && m.teamA && m.teamB) {
                                        matchName = `${m.teamA.name} ضد ${m.teamB.name}`;
                                    }
                                    allMatches.push({
                                        name: matchName,
                                        url: m.urlLink?.url || m.url,
                                        channels: (m.tvChannels || m.broadcasts || m.schedule || []).map((s: any) => ({ name: s.name || s }))
                                    });
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.warn(`Direct fetch failed for ${koooraUrl}`, e);
                }
            }));
            
            if (allMatches.length > 0) {
                setStorageItem(`kooora_data_${targetDate}`, allMatches, 30 * 60 * 1000); // 30 min persistent cache
                return { success: true, data: allMatches };
            }
        } catch (e) {
            console.warn("Kooora data fetch failed", e);
        } finally {
            // Clear promise after some time to allow refresh if needed
            setTimeout(() => { koooraDataPromise[targetDate] = null; }, 10000);
        }
        return null;
    })();

    // Handle background rejections to avoid unhandledrejection
    koooraDataPromise[targetDate]?.catch(() => {});

    return koooraDataPromise[targetDate];
};

export const preloadKoooraData = async () => {
    try {
        const dates = [
            getMoroccanDateString(-1),
            getMoroccanDateString(0),
            getMoroccanDateString(1)
        ];
        console.log("Preloading Kooora data for:", dates);
        
        // Multi-layered preloading for reliability
        return await Promise.allSettled(dates.flatMap(date => [
            fetchKoooraData(date),
            fetch(`/api/kooora/channels?date=${date}`).then(res => res.json()).catch(() => null)
        ]));
    } catch (e) {
        console.warn("Preload failed", e);
        return [];
    }
};

export const parseUtcDate = (dateString: string, timezone?: string): Date => {
    if (!dateString) return new Date();
    
    // If we have a timezone like "+01:00", try to combine it with the date string
    if (timezone && !dateString.includes('Z') && !dateString.includes('+') && (timezone.startsWith('+') || timezone.startsWith('-'))) {
        return new Date(dateString.replace(' ', 'T') + timezone);
    }

    // If it already contains a 'Z' or a '+' (has timezone info), use it as is.
    if (dateString.includes('Z') || dateString.includes('+')) {
        return new Date(dateString);
    }
    // Otherwise, assume it's UTC and append 'Z'
    return new Date(dateString.replace(' ', 'T') + 'Z');
};

// 365Scores API Configuration
const SCORES365_COMPETITIONS_URL = `https://webws.365scores.com/web/competitions/?appTypeId=5&langId=27&timezoneName=${USER_TIMEZONE}`;
const SCORES365_GAMES_BASE = `https://webws.365scores.com/web/games/?appTypeId=5&langId=27&timezoneName=${USER_TIMEZONE}&sports=1`;

// Polyfill for Promise.any
const promiseAny = <T>(promises: Promise<T>[]): Promise<T> => {
    return new Promise((resolve, reject) => {
        const errors: any[] = [];
        let rejectedCount = 0;
        if (promises.length === 0) {
             reject(new Error('No promises provided'));
             return;
        }

        promises.forEach((promise, index) => {
            Promise.resolve(promise)
                .then(resolve)
                .catch(error => {
                    errors[index] = error;
                    rejectedCount++;
                    if (rejectedCount === promises.length) {
                        reject(new Error(`All promises were rejected. Last error: ${error?.message || error}`));
                    }
                });
        });
    });
};

// Helper to fetch with retry logic - changed to sequential to avoid overwhelming upstreams
const fetchWithRetry = async (targetUrl: string, timeout = 15000): Promise<Response> => {
    let lastError: any = null;

    // In local dev only the same-origin /api/proxy works — the cross-origin fallbacks
    // (yallamatch.pages.dev/api/proxy returns 403; api.allorigins.win is CORS-blocked) can
    // never succeed from localhost and only add console noise plus retry latency. The local
    // proxy already performs its own server-side rotation, so a single entry is enough.
    const isLocal = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const activeProxies = isLocal ? PROXIES.slice(0, 1) : PROXIES;

    for (let i = 0; i < activeProxies.length; i++) {
        const proxyGenerator = activeProxies[i];
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const proxyUrl = proxyGenerator(targetUrl);

        try {
            const response = await fetch(proxyUrl, { 
                signal: controller.signal,
                cache: 'no-store'
            });
            clearTimeout(id);
            
            if (response.status === 429) {
                console.warn(`[API] Rate limited (429) by proxy ${i} for ${targetUrl}. Waiting before next attempt...`);
                // Wait 1s if rate limited before trying next proxy
                await new Promise(resolve => setTimeout(resolve, 1000));
                throw new Error('Rate limited');
            }

            if (!response.ok) throw new Error(`Status ${response.status}`);
            
            let text = await response.text();
            
            if (proxyUrl.includes('api.allorigins.win/get')) {
                try {
                    const json = JSON.parse(text);
                    if (json.contents) {
                        text = json.contents;
                    }
                } catch (e) {
                    // Ignore parse error
                }
            }
            
            return new Response(text, { 
                status: 200, 
                statusText: 'OK', 
                headers: response.headers 
            });
        } catch (e: any) {
            clearTimeout(id);
            lastError = e;
            console.debug(`[API] Proxy ${i} failed for ${targetUrl}: ${e.message}`);
            // Continue to next proxy
        }
    }

    console.warn(`[API] All proxies failed for URL: ${targetUrl}`, lastError);
    throw lastError || new Error('Failed to fetch data from all proxies');
};

// Endpoints
const YALLA_TARGET_BASE = 'https://www.messisporat.com/matches/npm/';
const MESSISPORAT_EVENTS_BASE = 'https://www.messisporat.com/matches/npm/events/';
const MESSISPORAT_STATS_BASE = 'https://www.messisporat.com/matches/npm/stats/';
const MESSISPORAT_H2H_BASE = 'https://www.messisporat.com/matches/npm/h2h/';
const YALLA_ASSETS_BASE = 'https://www.messisporat.com'; 
const YALLA_MATCH_PAGE_BASE = 'https://www.messisporat.com/matches/';

const fixUrl = (url: string) => (!url ? '' : (url.startsWith('http') ? url : `${YALLA_ASSETS_BASE}${url.startsWith('/') ? url : `/${url}`}`));

export interface Yanb8League {
    id: string;
    name: string;
    logoUrl: string;
    url: string;
}

// --- Helpers ---

export const getMoroccanDateString = (offsetDays = 0): string => {
  // Use a fixed reference to "now" in Morocco time to calculate the date string
  const d = new Date(Date.now() + serverTimeOffset);
  const moroccoDate = new Intl.DateTimeFormat('en-CA', { 
    timeZone: USER_TIMEZONE, 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).format(d);
  
  const [year, month, day] = moroccoDate.split('-');
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  
  return date.toISOString().split('T')[0];
};

const get365DateString = (offsetDays = 0): string => {
  const date = new Date(Date.now() + serverTimeOffset);
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-GB', { timeZone: USER_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
};

const formatToMoroccoTime = (d: Date | string): string => {
    try {
        const date = typeof d === 'string' ? parseUtcDate(d) : d;
        return new Intl.DateTimeFormat('en-GB', { 
            timeZone: USER_TIMEZONE, 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        }).format(date);
    } catch (e) { return '00:00'; }
};

const getLeagueCode = (leagueName: string): string => {
    const map: Record<string, string> = {
        'الدوري الإنجليزي الممتاز': '7', 'الدوري الإسباني': '11', 'الدوري الإيطالي': '13',
        'الدوري الألماني': '15', 'الدوري الفرنسي': '14', 'دوري أبطال أوروبا': '572',
    };
    for (const key in map) if (leagueName.includes(key)) return map[key];
    return '';
};

const map365MatchToMatch = (game: any): Match => {
    if (!game) return {} as Match;
    let status = MatchStatus.UPCOMING;
    let statusText = 'لم تبدأ';
    const stId = game.status?.id || game.Status?.Id || -1;
    const stName = game.status?.name || game.Status?.Name || '';
    const matchDate = parseUtcDate(game.startTime || game.StartTime || '');
    
    // 365Scores Status IDs:
    // 1: Not Started
    // 2: In Play
    // 3: Finished
    // 4: Postponed
    // 5: Cancelled
    // 6: After Extra Time
    // 7: After Penalties
    // 8: Half Time
    // 9: Abandoned
    // 10: Suspended
    // 11: Interrupted
    
    if ([2, 6, 7, 8, 11].includes(stId)) { 
        status = MatchStatus.LIVE;
        const rawStatus = (game.gameTimeDisplay || game.GameTimeDisplay || stName || 'مباشر');
        statusText = rawStatus === 'شوط' ? 'الإستراحة' : rawStatus.replace(/\bHT\b/gi, 'الإستراحة');
        
        if (stId === 8 || stName.toLowerCase().includes('half') || stName.toUpperCase() === 'HT' || stName.includes('استراحة') || stName.includes('نصف') || stName.includes('شوط') || stName === 'الإستراحة') { 
            status = MatchStatus.HALF_TIME; 
            statusText = 'الإستراحة'; 
        } 
        else if (stId === 6) { statusText = 'وقت إضافي'; } 
        else if (stId === 7) { statusText = 'ركلات ترجيح'; }
        else if (stId === 11) { statusText = 'متوقفة'; }
    } else if (stId === 3) { 
        status = MatchStatus.FINISHED; 
        statusText = 'انتهت'; 
    } else if ([4, 10].includes(stId)) { 
        status = MatchStatus.FINISHED; 
        statusText = 'مؤجلة'; 
    } else if ([5, 9].includes(stId)) { 
        status = MatchStatus.FINISHED; 
        statusText = 'ملغاة'; 
    } else { 
        statusText = formatToMoroccoTime(matchDate); 
    }
    
    return {
        id: game.id,
        channel: (game.channel && typeof game.channel === 'string' && game.channel.trim() !== "N/A" && game.channel.trim() !== "غير محدد") ? game.channel.trim() : '',
        league: game.competitionDisplayName || '',
        leagueCode: String(game.competitionId),
        leagueLogoUrl: game.competitionId ? `https://imagecache.365scores.com/image/upload/f_png,w_100,h_100,c_limit,q_auto:eco/competitions/${game.competitionId}` : undefined,
        teamA: { name: game.homeCompetitor?.name || 'Home', logoUrl: `https://imagecache.365scores.com/image/upload/f_png,w_100,h_100,c_limit,q_auto:eco/competitors/${game.homeCompetitor?.id}` },
        teamB: { name: game.awayCompetitor?.name || 'Away', logoUrl: `https://imagecache.365scores.com/image/upload/f_png,w_100,h_100,c_limit,q_auto:eco/competitors/${game.awayCompetitor?.id}` },
        scoreA: status === MatchStatus.UPCOMING ? 0 : (game.homeCompetitor?.score >= 0 ? Math.floor(game.homeCompetitor.score) : 0),
        scoreB: status === MatchStatus.UPCOMING ? 0 : (game.awayCompetitor?.score >= 0 ? Math.floor(game.awayCompetitor.score) : 0),
        status, statusText,
        time: formatToMoroccoTime(matchDate),
        utcDate: matchDate.toISOString(),
        round: `الجولة ${game.roundNum || ''}`,
    };
};

export const mapStingMatchToMatch = (data: any): Match => {
    if (!data) return {} as Match;
    let status = MatchStatus.UPCOMING;
    const rawStatus = data["Match-Status"] || 'لم تبدأ';
    let statusText = rawStatus === 'شوط' ? 'الإستراحة' : rawStatus.replace(/\bHT\b/gi, 'الإستراحة');
    const timeNow = data["Time-Now"];

    const matchDate = parseUtcDate(data["Time-Start"], data["Time-Zone"]);
    const now = new Date(Date.now() + serverTimeOffset);
    
    // Use Moroccan timezone for comparison
    const getMoroccanDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: USER_TIMEZONE }).format(d);
    const matchDateStr = getMoroccanDate(matchDate);
    const nowDateStr = getMoroccanDate(now);
    
    const isPastDay = matchDateStr < nowDateStr;
    const isFutureDay = matchDateStr > nowDateStr;
    
    const duration = 2.5 * 60 * 60 * 1000; // 2.5 hours buffer
    const isLongPast = matchDate.getTime() + duration < now.getTime();

    if (statusText.includes('لم تبدأ') || statusText.includes('مجدولة')) {
        status = MatchStatus.UPCOMING;
    } else if (statusText.includes('انتهت') || statusText.includes('ركلات الترجيح') || isLongPast) {
        status = MatchStatus.FINISHED;
        if (isLongPast && !statusText.includes('انتهت')) statusText = 'انتهت';
    } else if (statusText.includes('تأجلت') || statusText.includes('مؤجلة')) {
        status = MatchStatus.FINISHED;
        statusText = 'مؤجلة';
    } else if (statusText.includes('استراحة') || statusText === 'الإستراحة' || statusText.toUpperCase() === 'HT') {
        status = MatchStatus.HALF_TIME;
        statusText = 'الإستراحة';
    } else if ((timeNow >= 0 || statusText.includes('جارية') || statusText.includes('الإستراحة') || statusText.includes('مباشر')) && now.getTime() >= matchDate.getTime()) {
        if (isLongPast && !statusText.includes('مباشر')) {
            status = MatchStatus.FINISHED;
            statusText = 'انتهت';
        } else {
            status = MatchStatus.LIVE;
        }
    } else if (matchDate < now && !isFutureDay) {
        // Match should have started but no live status yet
        status = MatchStatus.LIVE;
        statusText = 'جارية';
    }

    const rawLeagueName = data["Cup-Name"] || '';
    
    // Extract round if it exists in league name (e.g. "League - Round 16")
    let league = rawLeagueName;
    let round = data["Group"] || data["Round"] || data["Week"] || '';
    
    const roundMatch = rawLeagueName.match(/\s*[-–—]\s*(دور الـ.*|الجولة.*|الدور.*|مرحلة.*|نصف النهائي|ربع النهائي|النهائي)$/);
    if (roundMatch) {
        league = rawLeagueName.substring(0, roundMatch.index).trim();
        if (!round || round === 'N/A' || round === 'غير متوفرة') {
            round = roundMatch[1].trim();
        }
    }

    // Further clean league name from common suffixes if not already handled
    league = league.replace(/\s*[-–—]?\s*(المجموعات|المجموعة).*/g, '').trim();

    return {
        id: data["Match-id"],
        channel: (data["Tv"] && typeof data["Tv"] === 'string' && data["Tv"].trim() !== "N/A" && data["Tv"].trim() !== "غير محدد") ? data["Tv"].trim() : '',
        league: league,
        leagueCode: getLeagueCode(rawLeagueName),
        leagueLogoUrl: fixUrl(data["Cup-Logo"]),
        teamA: { name: data["Team-Right"]?.Name || 'فريق A', logoUrl: fixUrl(data["Team-Right"]?.Logo) },
        teamB: { name: data["Team-Left"]?.Name || 'فريق B', logoUrl: fixUrl(data["Team-Left"]?.Logo) },
        scoreA: parseInt(data["Team-Right"]?.Goal) || 0,
        scoreB: parseInt(data["Team-Left"]?.Goal) || 0,
        status, statusText,
        time: formatToMoroccoTime(matchDate),
        utcDate: matchDate.toISOString(), 
        round: round,
    };
};

// --- API Functions (Stateless) ---

export const fetchMatchesByDate = async (dateTab: DateString): Promise<Match[]> => {
  let offset = 0;
  if (dateTab === 'yesterday') offset = -1;
  else if (dateTab === 'tomorrow') offset = 1;

  const dateString = getMoroccanDateString(offset);
  const storageKey = `matches_${dateString}`;

  // 1. Check persistent cache first for fast load
  const cached = getStorageItem(storageKey);
  if (cached) {
      // Re-fetch in background to update (SWR)
      (async () => {
          try {
              const fresh = await fetchFromMessisporatInternal(dateString);
              if (fresh && fresh.length > 0) {
                  setStorageItem(storageKey, fresh, 5 * 60 * 1000); // 5 min TTL
              }
          } catch (e) { /* ignore background error */ }
      })().catch(() => {});
      return cached;
  }

  try {
      const matches = await fetchFromMessisporatInternal(dateString);
      if (matches && matches.length > 0) {
          setStorageItem(storageKey, matches, 5 * 60 * 1000);
      }
      return matches;
  } catch (e) {
      console.warn("Primary fetch failed, attempting 365Scores:", e);
      try {
          const m365 = await fetch365ScoresInternal(offset);
          if (m365 && m365.length > 0) {
              setStorageItem(storageKey, m365, 5 * 60 * 1000);
          }
          return m365;
      } catch { return []; }
  }
};

const fetchFromMessisporatInternal = async (dateString: string): Promise<Match[]> => {
    try {
        // Try local server API first (which has deduplication and caching)
        const response = await fetch(`/api/matches?date=${dateString}`);
        if (response.ok) {
            const data = await response.json();
            const rawMatches = data["STING-WEB-Matches"] || [];
            return rawMatches.map((m: any) => mapStingMatchToMatch(m)).filter((match: Match) => {
                if (!match.league) return false;
                return isMajorLeague(match.league);
            });
        }
        throw new Error(`Local API returned ${response.status}`);
    } catch (e) {
        // Fallback to absolute URL via proxy
        const url = `https://yallamatch.pages.dev/api/matches?date=${dateString}`;
        const response = await fetchWithRetry(url);
        const data = await response.json();
        const rawMatches = data["STING-WEB-Matches"] || [];
        return rawMatches.map((m: any) => mapStingMatchToMatch(m)).filter((match: Match) => {
            if (!match.league) return false;
            return isMajorLeague(match.league);
        });
    }
};

const fetch365ScoresInternal = async (offset: number): Promise<Match[]> => {
    const dateStr365 = get365DateString(offset);
    const url = `${SCORES365_GAMES_BASE}&startDate=${dateStr365}&endDate=${dateStr365}`;
    const response = await fetchWithRetry(url, 12000); 
    const data = await response.json();
    return (data.games || []).map(map365MatchToMatch).filter((match: Match) => {
         if (!match.league) return false;
         return isMajorLeague(match.league);
    });
};

export const fetchLiveMatches = async (): Promise<Match[]> => {
    try {
        const url = `https://yallamatch.pages.dev/api/live`;
        const response = await fetchWithRetry(url);
        const data = await response.json();
        const rawMatches = data["STING-WEB-Matches"] || [];
        return rawMatches.map((m: any) => mapStingMatchToMatch(m));
    } catch { 
        try {
            const response = await fetch(`${getApiBase()}/api/live`);
            if (!response.ok) return [];
            const data = await response.json();
            const rawMatches = data["STING-WEB-Matches"] || [];
            return rawMatches.map((m: any) => mapStingMatchToMatch(m));
        } catch { return []; }
    }
};

// Simple global cache for channels to avoid redundant heavy fetches
const channelCache = new Map<number, { channels: (string | ChannelInfo)[] | null, timestamp: number }>();
const CHANNEL_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Details cache to avoid redundant heavy fetches during navigation
const detailsCache = new Map<number, { data: MatchDetails, timestamp: number }>();
const DETAILS_CACHE_TTL = 30 * 1000; // 30 seconds

export const fetchMatchChannel = async (matchId: number, teamA?: string, teamB?: string, date?: string): Promise<(string | ChannelInfo)[] | null> => {
    // 1. Check memory cache first
    const cached = channelCache.get(matchId);
    if (cached && Date.now() - cached.timestamp < CHANNEL_CACHE_TTL) {
        return cached.channels;
    }

    // 2. Check persistent storage for fast load
    const storageKey = `channels_${matchId}`;
    const stored = getStorageItem(storageKey);
    if (stored) {
        // Return stored but re-fetch in background to update (SWR)
        (async () => {
            try {
                const fresh = await fetchMatchChannelFromSources(matchId, teamA, teamB, date);
                if (fresh) {
                    setStorageItem(storageKey, fresh, 60 * 60 * 1000); // 1hr
                    channelCache.set(matchId, { channels: fresh, timestamp: Date.now() });
                }
            } catch (e) {
                console.debug("Background channel update failed", e);
            }
        })().catch(() => {});
        return stored;
    }

    const finalChannels = await fetchMatchChannelFromSources(matchId, teamA, teamB, date);
    
    if (finalChannels) {
        setStorageItem(storageKey, finalChannels, 60 * 60 * 1000); // 1hr
        channelCache.set(matchId, { channels: finalChannels, timestamp: Date.now() });
    }
    
    return finalChannels;
};

const koooraDailyChannelsPromiseCache = new Map<string, Promise<any>>();
const koooraDailyChannelsDataCache = new Map<string, { data: any, timestamp: number }>();

const liveOnSatDailyChannelsPromiseCache = new Map<string, Promise<any>>();
const liveOnSatDailyChannelsDataCache = new Map<string, { data: any, timestamp: number }>();
const DAILY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const fetchLiveOnSatDailyChannels = async (targetDate: string, signal?: AbortSignal) => {
    const cachedData = liveOnSatDailyChannelsDataCache.get(targetDate);
    if (cachedData && Date.now() - cachedData.timestamp < DAILY_CACHE_TTL) {
        return cachedData.data;
    }

    if (liveOnSatDailyChannelsPromiseCache.has(targetDate)) {
        return liveOnSatDailyChannelsPromiseCache.get(targetDate);
    }

    const fetchPromise = (async () => {
        try {
            const params = new URLSearchParams();
            if (targetDate) params.append('date', targetDate);

            const apiUrl = `https://yallamatch.pages.dev/api/liveonsat/channels?${params.toString()}`;
            try {
                const res = await fetchWithRetry(apiUrl, 5000);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.matches) {
                        return json.matches;
                    }
                }
            } catch (e) {
                console.debug("LiveOnSat direct API fetch failed", e);
            }

            const res = await fetch(`${getApiBase()}/api/liveonsat/channels?${params.toString()}`, { signal });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.matches) {
                    return json.matches;
                }
            }
            return null;
        } finally {
            liveOnSatDailyChannelsPromiseCache.delete(targetDate);
        }
    })();

    liveOnSatDailyChannelsPromiseCache.set(targetDate, fetchPromise);
    const data = await fetchPromise;
    if (data) {
        liveOnSatDailyChannelsDataCache.set(targetDate, { data, timestamp: Date.now() });
    }
    return data;
};

const fetchKoooraDailyChannels = async (targetDate: string, signal?: AbortSignal) => {
    // 1. Check data cache
    const cachedData = koooraDailyChannelsDataCache.get(targetDate);
    if (cachedData && Date.now() - cachedData.timestamp < DAILY_CACHE_TTL) {
        return cachedData.data;
    }

    // 2. Check if a fetch is already in progress for this date
    if (koooraDailyChannelsPromiseCache.has(targetDate)) {
        return koooraDailyChannelsPromiseCache.get(targetDate);
    }

    const fetchPromise = (async () => {
        try {
            const params = new URLSearchParams();
            if (targetDate) params.append('date', targetDate);

            // Try absolute yallamatch API first
            const apiUrl = `https://yallamatch.pages.dev/api/kooora/channels?${params.toString()}`;
            try {
                const res = await fetchWithRetry(apiUrl, 5000);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.data) {
                        return json.data;
                    }
                }
            } catch (e) {
                console.debug("Kooora direct API fetch failed", e);
            }

            // Fallback to local server proxy
            const res = await fetch(`${getApiBase()}/api/kooora/channels?${params.toString()}`, { signal });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    return json.data;
                }
            }
            return null;
        } finally {
            // Remove from promise cache once done (whether success or fail)
            koooraDailyChannelsPromiseCache.delete(targetDate);
        }
    })();

    // Store in promise cache
    koooraDailyChannelsPromiseCache.set(targetDate, fetchPromise);

    const data = await fetchPromise;
    if (data) {
        koooraDailyChannelsDataCache.set(targetDate, { data, timestamp: Date.now() });
    }
    return data;
};

// Extracted internal fetcher for clean SWR
const fetchMatchChannelFromSources = async (matchId: number, teamA?: string, teamB?: string, date?: string): Promise<(string | ChannelInfo)[] | null> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 

        // Pre-normalize for speed
        const normTeamA = teamA ? normalizeArabic(teamA) : '';
        const normTeamB = teamB ? normalizeArabic(teamB) : '';
        const targetDate = date ? date.split('T')[0] : getMoroccanDateString(0);

        const results = await Promise.allSettled([
            // Source 1: Backend API (Kooora)
            (async () => {
                try {
                    const data = await fetchKoooraDailyChannels(targetDate, controller.signal);
                    if (data && data.length > 0) {
                        const koooraMatch = data.find((m: any) => {
                            if (!m.name) return false;
                            const normName = normalizeArabic(m.name);
                            return isFuzzyMatch(normName, normTeamA) && isFuzzyMatch(normName, normTeamB);
                        });
                        if (koooraMatch?.channels?.length > 0) {
                            return koooraMatch.channels.map((c: any) => ({ name: c.name, logo: fixUrl(c.logo), url: c.url }));
                        }
                    }
                } catch (e) {
                    console.debug("Kooora backend channel fetch failed", e);
                } 
                return null;
            })(),
            // Source 2: beIN EPG
            (async () => {
                if (!teamA || !teamB) return null;
                try {
                    const params = new URLSearchParams();
                    if (targetDate) params.append('date', targetDate);
                    params.append('teamA', teamA);
                    params.append('teamB', teamB);
                    const apiUrl = `https://yallamatch.pages.dev/api/bein-channels?${params.toString()}`;
                    const res = await fetch(apiUrl, { signal: controller.signal });
                    
                    if (res.ok) {
                        const data = await res.json();
                        return data.channels?.length > 0 ? data.channels : null;
                    }
                } catch (e) {
                    console.debug("beIN EPG channel fetch failed", e);
                } return null;
            })(),
            // Source 3: Messisporat
            (async () => {
                try {
                    const res = await fetchWithRetry(`https://www.messisporat.com/matches/npm/events/?MatchID=${matchId}&lang=27&time=%2B00%3A00`, 4000);
                    const data = await res.json();
                    const info = data?.["STING-WEB-Match-Details"]?.["Match-Info"];
                    const tv = info?.["Tv"] || info?.["Channel"];
                    return tv && tv !== "N/A" && tv !== "غير محدد" ? tv.split('|').map((c: string) => c.trim()).filter(Boolean) : null;
                } catch (e) {
                    console.debug("Messisporat channel fetch failed", e);
                } return null;
            })(),
            // Source 4: LiveOnSat
            (async () => {
                try {
                    const data = await fetchLiveOnSatDailyChannels(targetDate, controller.signal);
                    if (data && data.length > 0) {
                        const losMatch = data.find((m: any) => {
                            const matchName = m.match || m.name;
                            if (!matchName) return false;
                            const normName = normalizeArabic(matchName);
                            return isFuzzyMatch(normName, normTeamA) && isFuzzyMatch(normName, normTeamB);
                        });
                        if (losMatch?.channels?.length > 0) {
                            return losMatch.channels.map((c: any) => typeof c === 'string' ? c : c.name);
                        }
                    }
                } catch (e) {
                    console.debug("LiveOnSat channel fetch failed", e);
                }
                return null;
            })()
        ]);

        clearTimeout(timeoutId);

        // Deduplicate and prioritize info objects
        const channelMap = new Map<string, string | ChannelInfo>();
        results.forEach(res => {
            if (res.status === 'fulfilled' && res.value) {
                (res.value as any[]).forEach(ch => {
                    const name = typeof ch === 'string' ? ch : ch.name;
                    const existing = channelMap.get(name);
                    if (!existing || (typeof ch === 'object' && typeof existing === 'string')) {
                        channelMap.set(name, ch);
                    }
                });
            }
        });

        if (channelMap.size > 0) {
            const sorted = Array.from(channelMap.values()).sort((a, b) => {
                const nameA = typeof a === 'string' ? a : a.name;
                const nameB = typeof b === 'string' ? b : b.name;
                const isAr = (s: string) => /[\u0600-\u06FF]/.test(s);
                if (isAr(nameA) && !isAr(nameB)) return -1;
                if (!isAr(nameA) && isAr(nameB)) return 1;
                return 0;
            });
            return sorted;
        }

        // Last fallback: Scraping
        try {
            const koooraData = await fetchKoooraData(targetDate);
            const koooraMatch = koooraData?.data?.find((m: any) => isFuzzyMatch(normalizeArabic(m.name), normTeamA) && isFuzzyMatch(normalizeArabic(m.name), normTeamB));
            if (koooraMatch?.channels?.length > 0) return koooraMatch.channels.map((c: any) => ({ name: c.name, logo: fixUrl(c.logo), url: c.url }));
        } catch (e) {
            console.warn("fetchMatchChannel fallback error", e);
        }

    } catch (e) {
        console.warn("fetchMatchChannelFromSources error", e);
    }
    return null;
};

export const fetchLiveScoreUpdates = async (matchIds: number[]): Promise<Partial<Match>[]> => {
    // This function implicitly calls fetchMatchesByDate, which is now stateless. 
    // The caching responsibility is on the caller (App.tsx) if they choose to use useCache,
    // but typically live score updates bypass cache or have very short TTL.
    try {
        const matches = await fetchMatchesByDate('today');
        return matches.filter(m => matchIds.includes(m.id)).map(m => ({
            id: m.id, scoreA: m.scoreA, scoreB: m.scoreB, status: m.status, statusText: m.statusText
        }));
    } catch { return []; }
};

export const fetchKoooraEvents = async (teamA: string, teamB: string, date?: string): Promise<any[] | null> => {
    try {
        const koooraData = await fetchKoooraData(date);
        if (koooraData && koooraData.success && koooraData.data) {
            const normTeamA = normalizeArabic(teamA);
            const normTeamB = normalizeArabic(teamB);

            const koooraMatch = koooraData.data.find((m: any) => {
                if (!m.name) return false;
                const normName = normalizeArabic(m.name);
                
                // Split by " ضد " or " vs "
                const parts = normName.split(/\s+(?:ضد|vs)\s+/);
                const koooraTeamA = parts[0] ? normalizeArabic(parts[0]) : '';
                const koooraTeamB = parts[1] ? normalizeArabic(parts[1]) : '';
                
                const matchA = isFuzzyMatch(normName, normTeamA) || (koooraTeamA && isFuzzyMatch(normTeamA, koooraTeamA));
                const matchB = isFuzzyMatch(normName, normTeamB) || (koooraTeamB && isFuzzyMatch(normTeamB, koooraTeamB));
                
                const matchARev = isFuzzyMatch(normName, normTeamB) || (koooraTeamA && isFuzzyMatch(normTeamB, koooraTeamA));
                const matchBRev = isFuzzyMatch(normName, normTeamA) || (koooraTeamB && isFuzzyMatch(normTeamA, koooraTeamB));
                
                return (matchA && matchB) || (matchARev && matchBRev);
            });
            
            if (koooraMatch && koooraMatch.url) {
                const fetchEvents = async () => {
                    const url = koooraMatch.url.startsWith('/') ? `https://www.kooora.com${koooraMatch.url}` : koooraMatch.url;
                    
                    // 1. Try our high-efficiency backend JSON API first
                    try {
                        const backendUrl = `${getApiBase()}/api/kooora/events?url=${encodeURIComponent(url)}`;
                        const response = await fetch(backendUrl);
                        if (response.ok) {
                            const json = await response.json();
                            if (json && json.success) {
                                // Extract from nextData if returned from server, which has the complete dataset
                                const nextData = json.nextData;
                                if (nextData) {
                                    const allEvents: any[] = [];
                                    
                                    const keyEvents = nextData?.props?.pageProps?.data?.match?.keyEvents;
                                    if (Array.isArray(keyEvents)) allEvents.push(...keyEvents);
                                    
                                    const matchEvents = nextData?.props?.pageProps?.data?.match?.events;
                                    if (Array.isArray(matchEvents)) allEvents.push(...matchEvents);
                                    
                                    const matchGoals = nextData?.props?.pageProps?.data?.match?.goals;
                                    if (Array.isArray(matchGoals)) allEvents.push(...matchGoals.map((g: any) => ({ ...g, type: 'GOAL' })));
                                    
                                    const matchTimeline = nextData?.props?.pageProps?.data?.match?.timeline;
                                    if (Array.isArray(matchTimeline)) allEvents.push(...matchTimeline);
                                    
                                    const lineups = nextData?.props?.pageProps?.data?.match?.lineups;
                                    if (lineups) {
                                        const extractFromTeam = (team: any, side: string) => {
                                            if (!team) return;
                                            const processPlayer = (player: any) => {
                                                if (Array.isArray(player.events)) {
                                                    const subs = player.events
                                                        .filter((e: any) => e.type === 'SUBSTITUTION')
                                                        .map((e: any) => ({ ...e, side }));
                                                    allEvents.push(...subs);
                                                }
                                            };
                                            if (Array.isArray(team.lineup)) team.lineup.forEach(processPlayer);
                                        };
                                        extractFromTeam(lineups.teamA, 'TEAM_A');
                                        extractFromTeam(lineups.teamB, 'TEAM_B');
                                    }

                                    if (allEvents.length > 0) {
                                        const uniqueEvents = [];
                                        const seen = new Set();
                                        for (const ev of allEvents) {
                                            const side = ev.side || ev.team || '';
                                            const minute = ev.period?.minute || ev.minute || 0;
                                            const type = String(ev.type || '').toUpperCase();
                                            const player = ev.player?.name || ev.playerName || ev.playerIn?.name || '';
                                            
                                            const key = `${side}-${minute}-${type}-${player}`;
                                            if (!seen.has(key)) {
                                                seen.add(key);
                                                uniqueEvents.push(ev);
                                            }
                                        }
                                        return uniqueEvents;
                                    }
                                }

                                // Fallback to json.data which has the pre-selected basic events if nextData is missing
                                if (Array.isArray(json.data) && json.data.length > 0) {
                                    return json.data;
                                }
                            }
                        }
                    } catch (err) {
                        console.warn("[API] Backend kooora events api failed, trying direct scraper fallback:", err);
                    }

                    // 2. Direct Scraper Fallback (Client-side proxying if backend failed)
                    try {
                        const res = await fetchWithRetry(url);
                        const html = await res.text();
                        const matchScript = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
                        if (matchScript) {
                            const data = JSON.parse(matchScript[1]);
                            
                            const allEvents: any[] = [];
                            
                            // 1. Get keyEvents (goals, cards)
                            const keyEvents = data?.props?.pageProps?.data?.match?.keyEvents;
                            if (Array.isArray(keyEvents)) {
                                allEvents.push(...keyEvents);
                            }

                            // 2. Get all events if keyEvents is incomplete
                            const matchEvents = data?.props?.pageProps?.data?.match?.events;
                            if (Array.isArray(matchEvents)) {
                                allEvents.push(...matchEvents);
                            }

                            // 3. Get goals specifically
                            const matchGoals = data?.props?.pageProps?.data?.match?.goals;
                            if (Array.isArray(matchGoals)) {
                                allEvents.push(...matchGoals.map((g: any) => ({ ...g, type: 'GOAL' })));
                            }

                            // 4. Get timeline events
                            const matchTimeline = data?.props?.pageProps?.data?.match?.timeline;
                            if (Array.isArray(matchTimeline)) {
                                allEvents.push(...matchTimeline);
                            }
                            
                            // 5. Get substitutions from lineups
                            const lineups = data?.props?.pageProps?.data?.match?.lineups;
                            if (lineups) {
                                const extractFromTeam = (team: any, side: string) => {
                                    if (!team) return;
                                    const processPlayer = (player: any) => {
                                        if (Array.isArray(player.events)) {
                                            const subs = player.events
                                                .filter((e: any) => e.type === 'SUBSTITUTION')
                                                .map((e: any) => ({ ...e, side })); // Add side to substitution events
                                            allEvents.push(...subs);
                                        }
                                    };
                                    if (Array.isArray(team.lineup)) team.lineup.forEach(processPlayer);
                                };
                                extractFromTeam(lineups.teamA, 'TEAM_A');
                                extractFromTeam(lineups.teamB, 'TEAM_B');
                            }
                            
                            if (allEvents.length > 0) {
                                // Deduplicate events with a more robust key
                                const uniqueEvents = [];
                                const seen = new Set();
                                for (const ev of allEvents) {
                                    // Create a unique key based on core properties
                                    const side = ev.side || ev.team || '';
                                    const minute = ev.period?.minute || ev.minute || 0;
                                    const type = String(ev.type || '').toUpperCase();
                                    const player = ev.player?.name || ev.playerName || ev.playerIn?.name || '';
                                    
                                    const key = `${side}-${minute}-${type}-${player}`;
                                    if (!seen.has(key)) {
                                        seen.add(key);
                                        uniqueEvents.push(ev);
                                    }
                                }
                                
                                return uniqueEvents;
                            }
                        }
                        
                        // Fallback: Try a different parser or return null
                        console.warn("Could not find __NEXT_DATA__ in Kooora HTML or it was empty");
                        return null;
                    } catch (e) {
                        console.error("Error parsing Kooora events", e);
                    }
                    return null;
                };

                const eventsData = await fetchEvents();
                if (eventsData) {
                    return Array.isArray(eventsData) ? eventsData : (eventsData as any).data || null;
                }
            }
        }
    } catch (e) {
        console.warn("Failed to fetch Kooora events", e);
    }
    return null;
};

export const fetchMatchDetails = async (match: Match): Promise<MatchDetails> => {
    // Check cache first
    const cached = detailsCache.get(match.id);
    if (cached && Date.now() - cached.timestamp < DETAILS_CACHE_TTL) {
        return cached.data;
    }

    const fetchFromSources = async () => {
        const matchId = match.id;
        
        const koooraEventsPromise = Promise.race([
            fetchKoooraEvents(match.teamA.name, match.teamB.name, match.utcDate).catch(() => null),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
        ]);

        const detailsUrl = `https://yallamatch.pages.dev/api/match-details?id=${matchId}`;
        const h2hUrl = `https://yallamatch.pages.dev/api/h2h?id=${matchId}`;
        // The yallamatch match-details API serves lineup/events/info but carries NO statistics, so the
        // "الإحصائيات" tab must come from the dedicated messisporat stats endpoint, whose payload puts
        // Statistics-1/Statistics-2 at the top level. Fetched alongside the others below.
        const statsUrl = `${MESSISPORAT_STATS_BASE}?MatchID=${matchId}`;

        // True when a payload actually carries head-to-head rows — either the dedicated endpoint's
        // new shape ({ matches: [...], lastFive: [...] }) or the old shape embedded in match details
        // ({ "STING-WEB-Match-Details": {...} }). Used so we keep real H2H instead of an empty hull.
        const hasH2HData = (r: any) => !!(r && (
            (Array.isArray(r.matches) && r.matches.length > 0) ||
            (Array.isArray(r.lastFive) && r.lastFive.length > 0) ||
            r["STING-WEB-Match-Details"]
        ));
        // True when a payload carries statistics rows (top-level or embedded).
        const hasStatsData = (r: any) => !!(r && (
            (Array.isArray(r["Statistics-1"]) && r["Statistics-1"].length > 0) ||
            r["STING-WEB-Match-Details"]?.["Statistics-1"]
        ));

        // h2hResult feeds "أخر المواجهات المباشرة" and statsResult feeds "الإحصائيات". Both used to be
        // tied to match-details succeeding, so the common match-details-only response (which has H2H
        // and stats in neither) left both sections empty. Track the best of each independently.
        let bestH2h: any = null;
        let bestStats: any = null;

        try {
            // Try absolute yallamatch API first, plus the messisporat stats endpoint it doesn't cover.
            const [detailsRes, h2hRes, statsRes] = await Promise.all([
                fetchWithRetry(detailsUrl, 5000).then(r => r.json()).catch(() => null),
                fetchWithRetry(h2hUrl, 5000).then(r => r.json()).catch(() => null),
                fetchWithRetry(statsUrl, 5000).then(r => r.json()).catch(() => null)
            ]);

            if (hasH2HData(h2hRes)) bestH2h = h2hRes;
            if (hasStatsData(statsRes)) bestStats = statsRes;

            if (detailsRes && detailsRes["STING-WEB-Match-Details"]) {
                return {
                    eventsResult: detailsRes,
                    statsResult: bestStats || detailsRes,
                    h2hResult: bestH2h || detailsRes,
                    koooraEvents: await koooraEventsPromise
                };
            }
        } catch (e) {
            console.warn("Direct details fetch failed, trying local proxy", e);
        }

        try {
            // Fallback: match details + H2H via the local server proxy; stats still from messisporat.
            const [detailsRes, h2hRes, statsRes] = await Promise.all([
                fetch(`/api/match-details?id=${matchId}`).then(r => r.ok ? r.json() : null).catch(() => null),
                fetch(`/api/h2h?id=${matchId}`).then(r => r.ok ? r.json() : null).catch(() => null),
                fetchWithRetry(statsUrl, 5000).then(r => r.json()).catch(() => null)
            ]);

            if (!bestH2h && hasH2HData(h2hRes)) bestH2h = h2hRes;
            if (!bestStats && hasStatsData(statsRes)) bestStats = statsRes;

            if (detailsRes && detailsRes["STING-WEB-Match-Details"]) {
                return {
                    eventsResult: detailsRes,
                    statsResult: bestStats || detailsRes,
                    h2hResult: bestH2h || detailsRes,
                    koooraEvents: await koooraEventsPromise
                };
            }
        } catch (e) {
            console.warn("Local match-details fetch failed", e);
        }

        // match-details was unavailable everywhere, but still surface any H2H / stats we fetched so
        // those sections render their data instead of the empty-state placeholders.
        return { eventsResult: null, statsResult: bestStats, h2hResult: bestH2h, koooraEvents: await koooraEventsPromise };
    };

    const results = await fetchFromSources();

    const { eventsResult, statsResult, h2hResult, koooraEvents } = results;

    try {
        const eventsData = eventsResult?.["STING-WEB-Match-Details"];
        const statsData = statsResult;
        const h2hData = h2hResult;

        const fixAssetUrl = (url: string) => (!url ? undefined : (url.startsWith('http') ? url : `${YALLA_ASSETS_BASE}${url.startsWith('/') ? url : `/${url}`}`));
        const mapPlayer = (p: any): Player => {
            const statsArr = p.Stats || [];
            const getStat = (name: string) => { const s = statsArr.find((x: any) => x.Name === name || x.Type === name); return s ? parseFloat(s.Value) : 0; };
            return {
                name: p["Player-Name"] || 'لاعب', number: p["Player-Number"] || 0, position: p["Position"] || 'غير محدد',
                logoUrl: fixAssetUrl(p["Player-Logo"]), stats: { goals: getStat('Goals'), assists: getStat('Assists'), rating: parseFloat(p.Rating || '0') }
            };
        };

        const lineupRoot = eventsData?.["Match-Lineup"];
        const homePlayers = lineupRoot?.["Home-Team"]?.["Team"] || [];
        const awayPlayers = lineupRoot?.["Away-Team"]?.["Team"] || [];
        
        const koooraEventsData = koooraEvents;
        let timeline: TimelineEvent[] = [];
        
        const mapKoooraEvent = (e: any): TimelineEvent | null => {
            let type: TimelineEvent['type'] = 'goal';
            let playerIn = '';
            let playerOut = '';
            let isPenalty = false;
            let isOwnGoal = false;
            let assist = '';
            
            // Determine side
            let side = (e.side === 'TEAM_A' || e.side === 1 || e.side === '1' || e.team === 1 || e.team === '1') ? 'A' : 'B';
            const eType = String(e.type || '').toUpperCase();
            
            if (eType === 'GOAL' || eType === 'GOAL_PENALTY' || eType === 'GOAL_OWN' || eType === 'GOAL_VAR') {
                type = 'goal';
                playerIn = e.player?.name || e.playerName || e.playerIn?.name || 'هدف';
                isPenalty = eType === 'GOAL_PENALTY';
                isOwnGoal = eType === 'GOAL_OWN';
                
                // Flip side for own goals so they appear for the team that gets the point
                if (isOwnGoal) {
                    side = side === 'A' ? 'B' : 'A';
                }

                // Handle assist
                if (e.assist?.player?.name) {
                    assist = e.assist.player.name;
                }
            } else if (eType === 'GOAL_CANCELLED' || eType === 'VAR_GOAL_CANCELLED') {
                return null;
            } else if (eType === 'CARD_YELLOW' || eType === 'YELLOW_CARD') {
                type = 'yellow-card';
                playerIn = e.player?.name || e.playerName || e.playerIn?.name || '';
            } else if (eType === 'CARD_RED' || eType === 'CARD_YELLOW_RED' || eType === 'RED_CARD') {
                type = 'red-card';
                playerIn = e.player?.name || e.playerName || e.playerIn?.name || '';
            } else if (eType === 'SUBSTITUTION' || eType === 'SUB') {
                type = 'substitution';
                playerIn = e.in?.name || e.player?.name || e.playerName || e.playerIn?.name || '';
                playerOut = e.out?.name || e.playerOut?.name || '';
            } else {
                return null;
            }
            
            const isPenaltyShootout = e.isPenaltyShootout || e.period?.type === 'PENALTY_SHOOTOUT' || e.period?.type === 'PENALTIES';
            
            return {
                minute: e.period?.minute || e.minute || 0,
                extraTime: e.period?.extra || e.extra || undefined,
                type,
                team: side as 'A' | 'B',
                playerIn,
                playerOut,
                assist,
                isPenalty,
                isOwnGoal,
                isPenaltyShootout
            };
        };

        const koooraEventsList = Array.isArray(koooraEvents) ? koooraEvents : [];
        const koooraTimeline = koooraEventsList.map(mapKoooraEvent).filter(Boolean) as TimelineEvent[];
        
        const fallbackEventsList = Array.isArray(eventsData?.["Match-Events"]) ? eventsData["Match-Events"] : [];
        const fallbackTimeline = fallbackEventsList.map((e: any) => {
            let eventType: TimelineEvent['type'] | null = null;
            const name = e["Event-Name"] || '';
            const logo = e["Event-Logo"] || '';
            
            // Handle Event-Player as object or string
            const playerObj = e["Event-Player"];
            const playerIn = typeof playerObj === 'object' ? playerObj?.Name : playerObj;
            const playerInImage = typeof playerObj === 'object' ? fixUrl(playerObj?.IMG) : undefined;
            
            // Handle extra player information
            const extraPlayerName = playerObj?.Extra?.[0]?.Name; 
            const extraPlayerImage = playerObj?.Extra?.[0]?.IMG ? fixUrl(playerObj?.Extra?.[0]?.IMG) : undefined;
            
            const isPenaltyShootout = logo.includes('subType=3') || name.includes('الضّربات الجّزائيّة');
            
            if (name.includes('صفراء') || name.includes('Yellow')) eventType = 'yellow-card';
            else if (name.includes('حمراء') || name.includes('Red')) eventType = 'red-card';
            else if (name.includes('هدف') || name.includes('Goal') || logo.includes('id=1&')) eventType = 'goal';
            else if (name.includes('تبديل') || name.includes('خروج') || name.includes('Substitution') || name.includes('Substitute') || logo.includes('id=1000')) eventType = 'substitution';
            else if (extraPlayerName) eventType = 'substitution'; // fallback if no clear name but has extra player

            if (!eventType) return null;

            const playerOut = eventType === 'substitution' ? extraPlayerName : undefined;
            const playerOutImage = eventType === 'substitution' ? extraPlayerImage : undefined;
            const assist = eventType === 'goal' ? extraPlayerName : undefined;

            return { 
                minute: parseInt(e["Event-Time"]) || 0, 
                type: eventType, 
                team: e.Place === 'right' ? 'A' : 'B', 
                playerIn: playerIn || 'لاعب', 
                playerInImage: playerInImage,
                playerOut: playerOut,
                playerOutImage: playerOutImage,
                assist: assist,
                isPenaltyShootout
            } as TimelineEvent;
        }).filter(Boolean);

        // Use the timeline that has more goals, prioritizing Kooora if they are equal
        const koooraGoalsCount = koooraTimeline.filter(e => e.type === 'goal' && !e.isPenaltyShootout).length;
        const fallbackGoalsCount = fallbackTimeline.filter(e => e.type === 'goal' && !e.isPenaltyShootout).length;
        
        if (koooraGoalsCount >= fallbackGoalsCount && koooraGoalsCount > 0) {
            timeline = koooraTimeline;
        } else if (fallbackGoalsCount > 0) {
            timeline = fallbackTimeline;
        } else {
            timeline = koooraTimeline;
        }

        timeline.sort((a, b) => (a.minute + (a.extraTime || 0) / 100) - (b.minute + (b.extraTime || 0) / 100));

        const penaltyScoreA = timeline.filter(e => e.team === 'A' && e.isPenaltyShootout && e.type === 'goal').length;
        const penaltyScoreB = timeline.filter(e => e.team === 'B' && e.isPenaltyShootout && e.type === 'goal').length;

        // Try getting stats from different possible paths in the JSON
        const rawStats1 = statsData?.["Statistics-1"] || statsData?.stats?.["Statistics-1"] || statsData?.["STING-WEB-Match-Details"]?.["Statistics-1"] || statsData?.["STING-WEB-Match-Details"]?.stats?.["Statistics-1"];
        const rawStats2 = statsData?.["Statistics-2"] || statsData?.stats?.["Statistics-2"] || statsData?.["STING-WEB-Match-Details"]?.["Statistics-2"] || statsData?.["STING-WEB-Match-Details"]?.stats?.["Statistics-2"];
        
        const stats1 = Array.isArray(rawStats1) ? rawStats1 : [];
        const stats2 = Array.isArray(rawStats2) ? rawStats2 : [];
        const statistics: MatchStatistic[] = stats1.map((s1: any) => {
            const s2 = stats2.find((item: any) => item.Name === s1.Name);
            return { type: s1.Name || 'إحصائية', homeValue: s1.Value?.toString() || '0', awayValue: s2?.Value?.toString() || '0' };
        });

        const h2hMatches: H2HMatch[] = [];
        const recentMatchesA: H2HMatch[] = [];
        const recentMatchesB: H2HMatch[] = [];

        const rawDetails = h2hData?.["STING-WEB-Match-Details"] || h2hData || {};
        
        // The h2h API returns team-logo URLs missing the .php script name (.../team-logo/?id=123),
        // which messisporat answers with an HTML error page instead of an image — so the logo renders
        // blank. Insert the script name to match the working URL form (.../team-logo/team-logo.php?id=).
        const fixLogoUrl = (raw: any): string =>
            fixUrl(raw).replace(/\/team-logo\/\?id=/i, '/team-logo/team-logo.php?id=');

        const mapH2HItem = (matchItem: any): H2HMatch => {
            // New Format Support (yallamatch simple JSON structure)
            if (matchItem.homeTeam && typeof matchItem.homeTeam === 'object' && ('goals' in matchItem.homeTeam || 'Name' in matchItem.homeTeam)) {
                // Check if it's the specific new format with nested objects but lowercase keys
                if ('goals' in matchItem.homeTeam || 'name' in matchItem.homeTeam) {
                   return {
                        date: matchItem.date || matchItem.Date || '',
                        league: matchItem.competition || matchItem.league || 'مواجهة سابقة',
                        homeTeam: matchItem.homeTeam.name || matchItem.homeTeam.Name || '',
                        awayTeam: matchItem.awayTeam.name || matchItem.awayTeam.Name || '',
                        homeScore: parseInt(matchItem.homeTeam.goals ?? matchItem.homeTeam.Goal ?? 0),
                        awayScore: parseInt(matchItem.awayTeam.goals ?? matchItem.awayTeam.Goal ?? 0),
                        homeLogo: fixLogoUrl(matchItem.homeTeam.logo || matchItem.homeTeam.Logo),
                        awayLogo: fixLogoUrl(matchItem.awayTeam.logo || matchItem.awayTeam.Logo),
                        leagueLogo: fixUrl(matchItem.competitionLogo || matchItem.CompetitionLogo)
                    };
                }
            }

            const homeTeam = typeof matchItem["Team-Right"] === 'object' ? (matchItem["Team-Right"]?.Name || '') : String(matchItem["Team-Right"] || '');
            const awayTeam = typeof matchItem["Team-Left"] === 'object' ? (matchItem["Team-Left"]?.Name || '') : String(matchItem["Team-Left"] || '');
            
            // Try different score fields
            const homeScore = parseInt(matchItem["Team-Right"]?.Goal || matchItem["Goal_Right"] || matchItem["Score_Right"] || 0);
            const awayScore = parseInt(matchItem["Team-Left"]?.Goal || matchItem["Goal_Left"] || matchItem["Score_Left"] || 0);

            return {
                date: matchItem["Date"] || matchItem["Match-Date"] || '', 
                league: matchItem["Cup-Name"] || matchItem["League"] || matchItem["Competition-Name"] || 'مواجهة سابقة',
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                homeScore,
                awayScore,
                homeLogo: typeof matchItem["Team-Right"] === 'object' ? fixLogoUrl(matchItem["Team-Right"].Logo) : undefined,
                awayLogo: typeof matchItem["Team-Left"] === 'object' ? fixLogoUrl(matchItem["Team-Left"].Logo) : undefined,
                leagueLogo: fixUrl(matchItem["Cup-Logo"] || matchItem["League-Logo"]) || undefined
            };
        };

        // Pick the first source that actually has rows. Using plain `||` here was a bug: an empty
        // `matches: []` array is truthy, so it short-circuited the chain and the populated `lastFive`
        // (the new API returns both) was never consulted — leaving the section empty when it had data.
        const nonEmptyArray = (...candidates: any[]) =>
            candidates.find(c => Array.isArray(c) && c.length > 0) || [];
        const rawH2H = nonEmptyArray(
            rawDetails["Match-H2H"],
            rawDetails["matches"],
            rawDetails["lastFive"],
            rawDetails["STING-WEB-H2H"],
        );
        if (Array.isArray(rawH2H)) {
            rawH2H.forEach((item: any) => h2hMatches.push(mapH2HItem(item)));
        }

        // Sort H2H matches by date descending
        h2hMatches.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date.localeCompare(a.date);
        });

        const rawTeamAMatches = rawDetails["Team-Right-Matches"] || rawDetails["Team-H-Matches"] || eventsData?.["Team-Right-Matches"] || eventsData?.["Team-H-Matches"] || [];
        const rawTeamBMatches = rawDetails["Team-Left-Matches"] || rawDetails["Team-A-Matches"] || eventsData?.["Team-Left-Matches"] || eventsData?.["Team-A-Matches"] || [];

        if (Array.isArray(rawTeamAMatches)) {
            rawTeamAMatches.forEach((item: any) => recentMatchesA.push(mapH2HItem(item)));
        }
        if (Array.isArray(rawTeamBMatches)) {
            rawTeamBMatches.forEach((item: any) => recentMatchesB.push(mapH2HItem(item)));
        }

        const jsonInfo = eventsData?.["Match-Info"] || {};
        const jsonCard = eventsData?.["Match-Card"] || {};
        const formatRound = (val: any) => (!val || val === "N/A" || val === "غير محدد" ? undefined : (/^\d+$/.test(String(val).trim()) ? `الجولة ${String(val).trim()}` : String(val).trim()));

        const getCoach = (side: any): Coach | undefined => {
            const c = side?.["Coach"];
            if (!c || !c["Name"]) return undefined;
            return {
                name: c["Name"],
                photoUrl: fixAssetUrl(c["Logo"]) || (c["Id"] ? `https://imagecache.365scores.com/image/upload/f_png,w_100,h_100,c_limit,q_auto:eco/instructors/${c["Id"]}` : undefined)
            };
        };

        const getValidValue = (...values: any[]) => {
            for (const val of values) {
                if (val && val !== "N/A" && val !== "غير محدد") {
                    return val;
                }
            }
            return undefined;
        };

        const koooraChannel = await Promise.race([
            fetchMatchChannel(match.id, match.teamA.name, match.teamB.name).catch(() => null),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
        ]);

        // Extract latest score and status from events data
        const matchScore = eventsData?.["Match-Score"];
        let scoreA = match.scoreA;
        let scoreB = match.scoreB;
        let status = match.status;
        let statusText = match.statusText;

        if (matchScore) {
            scoreA = parseInt(matchScore["Goal-Right"]) || 0;
            scoreB = parseInt(matchScore["Goal-Left"]) || 0;
            
            const rawStatus = matchScore["Match-Status"];
            if (rawStatus) {
                const mapped = mapStingMatchToMatch({ ...match, "Match-Status": rawStatus, "Time-Now": matchScore["Time-Now"] });
                status = mapped.status;
                statusText = mapped.statusText;
            }
        }

        const details: MatchDetails = {
            statistics,
            lineupHome: homePlayers.filter((p: any) => p.Status === "Starting").map(mapPlayer),
            lineupAway: awayPlayers.filter((p: any) => p.Status === "Starting").map(mapPlayer),
            benchHome: homePlayers.filter((p: any) => p.Status === "Substitute").map(mapPlayer),
            benchAway: awayPlayers.filter((p: any) => p.Status === "Substitute").map(mapPlayer),
            homeCoach: getCoach(lineupRoot?.["Home-Team"]),
            awayCoach: getCoach(lineupRoot?.["Away-Team"]),
            formationHome: lineupRoot?.["Home-Team"]?.["Formation"] || '',
            formationAway: lineupRoot?.["Away-Team"]?.["Formation"] || '',
            timeline: timeline.sort((a, b) => a.minute - b.minute),
            homeGoals: timeline.filter(e => e.team === 'A' && e.type === 'goal' && !e.isPenaltyShootout).map(e => ({ 
                minute: e.minute, 
                scorerName: e.playerIn,
                scorerImage: e.playerInImage 
            })),
            awayGoals: timeline.filter(e => e.team === 'B' && e.type === 'goal' && !e.isPenaltyShootout).map(e => ({ 
                minute: e.minute, 
                scorerName: e.playerIn,
                scorerImage: e.playerInImage
            })),
            penaltyScoreA,
            penaltyScoreB,
            h2h: h2hMatches,
            recentMatchesA,
            recentMatchesB,
            matchInfo: {
                stadium: getValidValue(jsonInfo["Club-Name"], jsonInfo["Stadium"], match.stadium),
                referee: getValidValue(jsonInfo["Match-Referee"], jsonInfo["Referee"], match.referee),
                commentator: getValidValue(jsonInfo["Commentator"], match.commentator),
                channel: koooraChannel || (getValidValue(jsonInfo["Tv"], match.channel) ? String(getValidValue(jsonInfo["Tv"], match.channel)).split('|').map(c => c.trim()).filter(Boolean) : undefined),
                round: formatRound(jsonCard["Round"]) || formatRound(jsonInfo["Round"]) || formatRound(jsonInfo["Week"]) || match.round
            },
            scoreA,
            scoreB,
            status,
            statusText
        };
        
        detailsCache.set(match.id, { data: details, timestamp: Date.now() });
        return details;
    } catch (err) {
        console.error("Match detail fetch failed:", err);
        return { statistics: [], lineupHome: [], lineupAway: [], benchHome: [], benchAway: [], formationHome: '', formationAway: '', timeline: [], homeGoals: [], awayGoals: [], h2h: [] };
    }
};

export const fetchMatchHighlights = async (match: Match): Promise<GoalEvent[]> => {
    try {
        // Warning: This calls fetchMatchDetails which is stateless now. 
        // Component should wrap this in useCache or fetch details first.
        const details = await fetchMatchDetails(match);
        const goals: GoalEvent[] = [];
        details.homeGoals.forEach(g => goals.push({ teamName: match.teamA.name, scorerName: g.scorerName, minute: g.minute }));
        details.awayGoals.forEach(g => goals.push({ teamName: match.teamB.name, scorerName: g.scorerName, minute: g.minute }));
        return goals.sort((a, b) => a.minute - b.minute);
    } catch { return []; }
};

export const fetchKeyEvents = async (match: Match): Promise<TimelineEvent[]> => {
    const details = await fetchMatchDetails(match);
    return details.timeline;
}

export const fetchYanb8Leagues = async (): Promise<Yanb8League[]> => {
    try {
        const response = await fetchWithRetry(SCORES365_COMPETITIONS_URL, 6000);
        const data = await response.json();

        // -------------------------------------------------------------
        // FORCE ADD ALL MAJOR COMPETITIONS THE USER REQUESTED
        // -------------------------------------------------------------
        const CUPS_IDS = [
            572, // دوري أبطال أوروبا
            573, // الدوري الأوروبي
            7685, // دوري المؤتمر الأوروبي
            624, // دوري أبطال أفريقيا
            627, // الكونفدرالية
            623, // دوري أبطال آسيا للنخبة
            568, // دوري أبطال آسيا 2 
            472, // السوبر الأوروبي
            460, // السوبر الإفريقي (maybe 460? fallback to fetch all cups just in case)
            5096, // كأس العالم للأندية
            329, // كأس الأمم الأوروبية
            167, // كأس الأمم الإفريقية
            6067, // كأس آسيا
            5930, // كأس العالم
            7674, // كأس العرب
            5452, // كأس الخليج
            605, // تصفيات كأس العالم آسيا
            588, // تصفيات أمم أفريقيا
            13, // كأس ملك إسبانيا
            15, // كأس السوبر الإسباني
            5, // كأس الاتحاد الإنجليزي
            9, // كأس الكاراباو
            156, // السوبر الإنجليزي الدرع الخيرية (maybe)
            20, // كأس إيطاليا
            24, // كأس السوبر الإيطالي (maybe)
            28, // كأس المانيا
            37, // كأس فرنسا

            // --- Major domestic leagues (not present in the timezone's base competition list, so
            //     they must be force-fetched too, otherwise the page shows only cups). ---
            7,   // الدوري الإنجليزي (Premier League)
            11,  // الدوري الإسباني (La Liga)
            17,  // الدوري الإيطالي (Serie A)
            25,  // الدوري الألماني (Bundesliga)
            35,  // الدوري الفرنسي (Ligue 1)
            649, // الدوري السعودي (Saudi Pro League)
            552, // الدوري المصري (Egyptian Premier League)
            113, // الدوري البرازيلي
            141, // الدوري المكسيكي
        ];

        const cupsUrl = `https://webws.365scores.com/web/competitions/?appTypeId=5&langId=27&timezoneName=${USER_TIMEZONE}&competitions=${CUPS_IDS.join(',')}`;
        let cupsComps = [];
        try {
            const cupsRes = await fetchWithRetry(cupsUrl, 5000);
            const cupsData = await cupsRes.json();
            cupsComps = cupsData.competitions || [];
        } catch(e) {
            console.error("Failed to fetch custom cups:", e);
        }

        // Add U-17 AFCON - Morocco 2026 manually
        cupsComps.push({
            id: 'afcon_u17_2026',
            name: 'كأس إفريقيا لأقل من 17 سنة – المغرب 2026',
            logoUrl: 'https://imagecache.365scores.com/image/upload/f_png,w_200,h_200,c_limit,q_auto:eco/competitors/282'
        });
        
        const toLeague = (c: any): Yanb8League => ({
            id: String(c.id),
            name: c.name,
            url: '',
            // Preserve a custom logo (e.g. the manual U-17 entry); otherwise build the 365scores one.
            logoUrl: c.logoUrl || `https://imagecache.365scores.com/image/upload/f_png,w_200,h_200,c_limit,q_auto:eco/competitions/${c.id}`,
        });

        // The timezone's base competition list is noisy (other sports, women's/youth/reserve
        // leagues), so filter it down to real standing leagues. The forced cups + the manual U-17
        // entry are hand-picked important competitions — always keep them so they can never be
        // filtered out (previously isStandingLeague here, then isMajorLeague in the view, silently
        // dropped force-added cups like the Carabao Cup, Super Cups and Euro).
        const baseComps = (data.competitions || []).map(toLeague).filter((l: Yanb8League) => isStandingLeague(l.name));
        const forcedComps = cupsComps.map(toLeague);

        // Forced cups first so they win the de-dup against any noisy base duplicate.
        const uniqueComps = Array.from(new Map([...forcedComps, ...baseComps].map(l => [l.id, l])).values());

        return uniqueComps
            .sort((a: any, b: any) => {
                const getPriority = (name: string) => {
                    const n = name.toLowerCase();
                    // 1. الدوريات الكبرى والمحلية
                    if (n.includes('إنجليزي') && !n.includes('كأس')) return 10;
                    if (n.includes('إسباني') && !n.includes('كأس')) return 11;
                    if (n.includes('إيطالي') && !n.includes('كأس')) return 12;
                    if (n.includes('ألماني') && !n.includes('كأس')) return 13;
                    if (n.includes('فرنسي') && !n.includes('كأس')) return 14;
                    if (n.includes('روشن') || (n.includes('سعودي') && !n.includes('كأس'))) return 15;
                    if (n.includes('مغربي') && !n.includes('كأس')) return 16;
                    if (n.includes('مصر') && !n.includes('كأس')) return 17;
                    
                    // 2. البطولات القارية والعالمية (أندية)
                    if (n.includes('أبطال أوروبا')) return 20;
                    if (n.includes('أوروبي') && !n.includes('أمم') && !n.includes('سوبر')) return 21; // Europa League
                    if (n.includes('مؤتمر')) return 22;
                    if (n.includes('أبطال أفريقيا')) return 23;
                    if (n.includes('كونفدرالية')) return 24;
                    if (n.includes('أبطال آسيا')) return 25;
                    if (n.includes('سوبر أوروبي')) return 26;
                    if (n.includes('سوبر إفريقي')) return 27;
                    if (n.includes('عالم للأندية')) return 28;

                    // 3. البطولات القارية والعالمية (منتخبات)
                    if (n.includes('عالم') && !n.includes('أندية') && !n.includes('تصفيات')) return 30;
                    if ((n.includes('أمم أوروبا') || n.includes('يورو')) && !n.includes('تصفيات')) return 31;
                    if (n.includes('أمم أفريقيا') && !n.includes('تصفيات')) return 32;
                    if (n.includes('آسيا') && !n.includes('أبطال') && !n.includes('تصفيات')) return 33;
                    if (n.includes('عرب')) return 34;
                    if (n.includes('خليج')) return 35;
                    if (n.includes('تصفيات') || n.includes('ودية')) return 36;
                    
                    // 4. الكؤوس المحلية للأندية
                    if (n.includes('كأس الاتحاد الإنجليزي') || n.includes('كأس رابطة') || n.includes('سوبر إنجليزي')) return 40;
                    if (n.includes('كأس ملك إسبانيا') || n.includes('سوبر إسباني')) return 41;
                    if (n.includes('كأس إيطاليا') || n.includes('سوبر إيطالي')) return 42;
                    if (n.includes('كأس ألمانيا') || n.includes('سوبر ألماني')) return 43;
                    if (n.includes('كأس فرنسا') || n.includes('سوبر فرنسي')) return 44;
                    
                    return 99; // Default priority
                };

                const priorityA = getPriority(a.name);
                const priorityB = getPriority(b.name);

                if (priorityA !== priorityB) return priorityA - priorityB;
                
                // Alphabetical sort for equal priority
                return a.name.localeCompare(b.name);
            });
    } catch { return []; }
};

// Standings/scorers are fetched server-side (GET /api/standings, /api/scorers) rather than
// directly from ESPN/365Scores here, so the ESPN-then-365Scores fallback chain shares a single
// circuit breaker instance across all clients instead of one that resets on every page reload.
export const fetchYanb8Standings = async (leagueId: string): Promise<StandingGroup[]> => {
    try {
        const response = await fetch(`/api/standings?leagueId=${leagueId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch standings:', error);
        return [];
    }
};

// Knockout bracket for cup competitions; resolves to null for plain leagues
// (or non-numeric ids like the ESPN slugs / the manual U-17 entry).
export const fetchCompetitionBracket = async (leagueId: string): Promise<CompetitionBracket | null> => {
    if (!/^\d+$/.test(leagueId)) return null;
    try {
        const response = await fetch(`/api/bracket?leagueId=${leagueId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch bracket:', error);
        return null;
    }
};

export const fetchLeagueTopScorers = async (leagueId: string): Promise<Scorer[]> => {
    try {
        const response = await fetch(`/api/scorers?leagueId=${leagueId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch scorers:', error);
        return [];
    }
};

export const fetchNewsArticle = async (id: string): Promise<NewsArticle | null> => {
    try {
        const response = await fetch(`/api/news/article?id=${encodeURIComponent(id)}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch article:', error);
        return null;
    }
};

export const fetchFootballNews = async (): Promise<NewsItem[]> => {
    try {
        const response = await fetch('/api/news');
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch news:', error);
        return [];
    }
};

export const fetchLeagueMatches = async (leagueId: string): Promise<Match[]> => {
    try {
        const response = await fetchWithRetry(`${SCORES365_GAMES_BASE}&competitions=${leagueId}`);
        const data = await response.json();
        return ((data && Array.isArray(data.games)) ? data.games : []).map(map365MatchToMatch);
    } catch { return []; }
};
