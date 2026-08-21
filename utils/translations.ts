
import { MatchStatus } from '../types';

export const LEAGUE_TRANSLATIONS: { [key: string]: string } = {
    'UEFA Champions League': 'دوري أبطال أوروبا',
    'European Championship': 'بطولة أمم أوروبا',
    'Premier League': 'الدوري الإنجليزي الممتاز',
    'Championship': 'دوري البطولة الإنجليزية (تشامبيونشيب)',
    'Primera Division': 'الدوري الإسباني',
    'Bundesliga': 'الدوري الألماني',
    'Serie A': 'الدوري الإيطالي',
    'Ligue 1': 'الدوري الفرنسي',
    'Eredivisie': 'الدوري الهولندي',
    'Primeira Liga': 'الدوري البرتغالي',
    'FIFA World Cup': 'كأس العالم',
    "Saudi Professional League": "دوري روشن السعودي",
    "Egyptian Premier League": "الدوري المصري الممتاز",
    "Moroccan Pro League": "الدوري المغربي",
    "AFC Champions League": "دوري أبطال آسيا",
    // Women's Africa Cup of Nations — 365scores' current season for comp 8746 is "المغرب 2026".
    "كأس أمم أفريقيا للسيدات": "كأس أمم إفريقيا للسيدات 2026",
    "Club World Cup": "كأس العالم للأندية",
    "UAE Pro League": "الدوري الإماراتي",
    "Moroccan Throne Cup": "كأس العرش المغربي",
};

export const TEAM_TRANSLATIONS: { [key: string]: string } = {
    // Saudi Pro League
    'Al-Ahli SFC': 'الأهلي',
    'Al-Hilal SFC': 'الهلال',
    'Al-Ittihad Club': 'الاتحاد',
    'Al-Nassr FC': 'النصر',

    // England
    'Arsenal FC': 'أرسنال',
    'Arsenal': 'أرسنال',
    'Aston Villa FC': 'أستون فيلا',
    'Aston Villa': 'أستون فيلا',
    'Brighton & Hove Albion FC': 'برايتون',
    'Brighton': 'برايتون',
    'Chelsea FC': 'تشيلسي',
    'Chelsea': 'تشيلسي',
    'Everton FC': 'إيفرتون',
    'Everton': 'إيفرتون',
    'Leicester City FC': 'ليستر سيتي',
    'Liverpool FC': 'ليفرپول',
    'Liverpool': 'ليفربول',
    'Manchester City FC': 'مانشستر سيتي',
    'Manchester City': 'مانشستر سيتي',
    'Manchester United FC': 'مانشستر يونايتد',
    'Manchester United': 'مانشستر يونايتد',
    'Newcastle United FC': 'نيوكاسل يونايتد',
    'Newcastle': 'نيوكاسل',
    'Tottenham Hotspur FC': 'توتنهام هوتسبر',
    'Tottenham': 'توتنهام',
    'West Ham United FC': 'وست هام يونايتد',
    'West Ham': 'وست هام',
    'Wolverhampton Wanderers FC': 'ولفرهامبتون',
    'Wolves': 'ولفرهامبتون',
    
    // Spain
    'Athletic Club': 'أتلتيك بيلباو',
    'Athletic Bilbao': 'أتلتيك بيلباو',
    'Atlético de Madrid': 'أتلتيكو مدريد',
    'Atletico Madrid': 'أتلتيكو مدريد',
    'Atletico': 'أتلتيكو مدريد',
    'FC Barcelona': 'برشلونة',
    'Barcelona': 'برشلونة',
    'Real Betis Balompié': 'ريال بيتيس',
    'Real Betis': 'ريال بيتيس',
    'Real Madrid CF': 'ريال مدريد',
    'Real Madrid': 'ريال مدريد',
    'Real Sociedad de Fútbol': 'ريال سوسيداد',
    'Real Sociedad': 'ريال سوسيداد',
    'Sevilla FC': 'إشبيلية',
    'Sevilla': 'إشبيلية',
    'Valencia CF': 'فالنسيا',
    'Villarreal CF': 'فياريال',
    'Celta de Vigo': 'سيلتا فيغو',
    'RCD Espanyol': 'إسبانيول',
    'Elche CF': 'إلتشي',
    'Getafe CF': 'خيتافي',

    // Italy
    'AC Milan': 'ميلان',
    'ACF Fiorentina': 'فيورنتينا',
    'AS Roma': 'روما',
    'Atalanta BC': 'أتالانتا',
    'FC Internazionale Milano': 'إنتر ميلان',
    'Juventus': 'يوفنتوس',
    'SS Lazio': 'لاتسيو',
    'SSC Napoli': 'نابولي',

    // Germany
    'Bayer 04 Leverkusen': 'باير ليفركوزن',
    'Borussia Dortmund': 'بوروسيا دورتموند',
    'Borussia Mönchengladbach': 'بوروسيا مونشنغلادباخ',
    'Eintracht Frankfurt': 'آ. فرانكفورت',
    'FC Bayern München': 'بايرن ميونيخ',
    'RB Leipzig': 'لايبزيج',
    'TSG 1899 Hoffenheim': 'هوفنهايم',
    'VfL Wolfsburg': 'فولفسبورج',

    // France
    'AS Monaco FC': 'موناكو',
    'LOSC Lille': 'ليل',
    'Olympique Lyonnais': 'أولمبيك ليون',
    'Olympique de Marseille': 'أولمبيك مارسيليا',
    'Paris Saint-Germain FC': 'باريس سان جيرمان',
    'Stade Rennais FC 1901': 'ستاد رين',
    'RC Strasbourg Alsace': 'ستراسبورج',
    'Strasbourg': 'ستراسبورج',
    'OGC Nice': 'نيس',
    'Nice': 'نيس',
    'RC Lens': 'لانس',
    'Lens': 'لانس',
    'Angers SCO': 'أنجيه',
    'Toulouse FC': 'تولوز',
    'FC Lorient': 'لوريان',
    'AJ Auxerre': 'أوكسير',
    'Stade Brestois 29': 'بريست',
    'FC Nantes': 'نانت',
    'Stade de Reims': 'ستاد ريمس',
    'Montpellier HSC': 'مونبلييه',
    'AC Ajaccio': 'أجاكسيو',
    'Clermont Foot 63': 'كليرمون',
    'ESTAC Troyes': 'تروا',
    'Le Havre AC': 'لو آفر',
    'Le Havre': 'لو آفر',
    'AS Saint-Étienne': 'سانت إيتيان',
    'Saint-Etienne': 'سانت إيتيان',
    'FC Metz': 'ميتز',
    'Metz': 'ميتز',
    'USL Dunkerque': 'دانكيرك',
    'Dunkerque': 'دانكيرك',
    'Paris FC': 'باريس أف.سي.',
    'Paris FC (FRA)': 'باريس أف.سي.',
    'Le Havre (FRA)': 'لو آفر',
    'Rodez AF': 'روديز',
    'Pau FC': 'باو',
    'Amiens SC': 'أميان',
    'EA Guingamp': 'غانغان',
    'Stade Lavallois': 'لافال',
    'SM Caen': 'كاين',
    'FC Annecy': 'أنسي',
    'Grenoble Foot 38': 'غرونوبل',
    'SC Bastia': 'باستيا',
    'Red Star FC': 'ريد ستار',
    'FC Martigues': 'مارتيغ',
    'ES Troyes AC': 'تروا',

    // Ukraine
    'FC Shakhtar Donetsk': 'شاختار دونيتسك',
    'Shakhtar Donetsk': 'شاختار دونيتسك',

    // Poland
    'KKS Lech Poznań': 'ليخ بوزنان',
    'Lech Poznan': 'ليخ بوزنان',

    // Greece
    'AEK Athens FC': 'أيك أثينا',
    'AEK Athens': 'أيك أثينا',

    // Slovenia
    'NK Celje': 'تسيليي',
    'Celje': 'تسيليي',

    // Croatia
    'HNK Rijeka': 'رييكا',
    'Rijeka': 'رييكا',

    // England (additional)
    'Crystal Palace FC': 'كريستال بالاس',
    'Crystal Palace': 'كريستال بالاس',
    'Nottingham Forest FC': 'نوتنغهام فورست',
    'Nottingham Forest': 'نوتنغهام فورست',
    'Fulham FC': 'فولهام',
    'Fulham': 'فولهام',
    'Brentford FC': 'برينتفورد',
    'Brentford': 'برينتفورد',
    'AFC Bournemouth': 'بورنموث',
    'Bournemouth': 'بورنموث',

    // Italy (additional)
    'Fiorentina': 'فيورنتينا',
    'Bologna FC 1909': 'بولونيا',
    'Bologna': 'بولونيا',
    'Torino FC': 'تورينو',
    'Torino': 'تورينو',
    'Udinese Calcio': 'أودينيزي',
    'Udinese': 'أودينيزي',

    // Spain (additional)
    'Rayo Vallecano de Madrid': 'رايو فايكانو',
    'Rayo Vallecano': 'رايو فايكانو',
    'CA Osasuna': 'أوساسونا',
    'Osasuna': 'أوساسونا',
    'RCD Mallorca': 'مايوركا',
    'Mallorca': 'مايوركا',

    // Netherlands (Eredivisie)
    'AFC Ajax': 'أياكس',
    'Ajax': 'أياكس',
    'PSV Eindhoven': 'آيندهوفن',
    'PSV': 'آيندهوفن',
    'Feyenoord Rotterdam': 'فينورد',
    'Feyenoord': 'فينورد',
    'AZ Alkmaar': 'ألكمار',
    'AZ': 'ألكمار',
    'FC Twente': 'توينتي',
    'FC Utrecht': 'أوتريخت',

    // Turkey
    'Samsunspor': 'سامسونسبور',
    'Galatasaray SK': 'غلطة سراي',
    'Galatasaray': 'غلطة سراي',
    'Fenerbahçe SK': 'فنربخشة',
    'Fenerbahce': 'فنربخشة',
    'Beşiktaş JK': 'بشكتاش',
    'Besiktas': 'بشكتاش',
    'Trabzonspor': 'طرابزون سبور',

    // Other continental clubs seen in AFC / Europa / Conference competitions
    'FC Noah': 'نوح',
    'Noah': 'نوح',
    'FC Strasbourg': 'ستراسبورج',
    'Fiorentina ACF': 'فيورنتينا',

    // AFC clubs (Champions League Elite / Two)
    'Al Wasl': 'الوصل',
    'Al Wasl FC': 'الوصل',
    'Esteghlal': 'استقلال طهران',
    'Esteghlal FC': 'استقلال طهران',
    'Al Muharraq': 'المحرق',
    'Muharraq': 'المحرق',
    'Al Wehdat': 'الوحدات',
    'Al Ahli SC': 'الأهلي',
    'Arkadag': 'أركاداغ',
    'Khaldiya': 'الخالدية',
    'Andijan': 'أنديجان',
    'Al Ain': 'العين',
    'Al Ain FC': 'العين',
    'Al Sadd': 'السد',
    'Al Sadd SC': 'السد',
    'Al Duhail': 'الدحيل',
    'Al Duhail SC': 'الدحيل',
    'Al Shorta': 'الشرطة',
    'Sharjah': 'الشارقة',
    'Sharjah FC': 'الشارقة',

    // National Teams
    'Argentina': 'الأرجنتين',
    'Belgium': 'بلجيكا',
    'Brazil': 'البرازيل',
    'Egypt': 'مصر',
    'England': 'إنجلترا',
    'France': 'فرنسا',
    'Germany': 'ألمانيا',
    'Italy': 'إيطاليا',
    'Morocco': 'المغرب',
    'Netherlands': 'هولندا',
    'Portugal': 'البرتغال',
    'Qatar': 'قطر',
    'Saudi Arabia': 'السعودية',
    'Spain': 'إسبانيا',
};

const translate = (translations: { [key: string]: string }, text: string | null | undefined): string => {
    if (!text) return '';
    return translations[text] || text;
};

// English competition / stage / round fragments that show up inside otherwise-Arabic
// league names (e.g. "دوري أبطال آسيا 2 - Preliminary Round"). Replaced in place so the
// whole label reads Arabic. Order matters: longer / more specific patterns first so
// "Round of 16" and "Semi-final" win before the bare "Round"/"Final".
const COMPETITION_PHRASES: [RegExp, string][] = [
    [/preliminary\s+round/gi, 'الدور التمهيدي'],
    [/qualifying\s+round/gi, 'الدور التأهيلي'],
    [/qualifiers?/gi, 'التصفيات'],
    [/qualification/gi, 'التصفيات'],
    [/play-?offs?/gi, 'الملحق'],
    [/group\s+stage/gi, 'دور المجموعات'],
    [/round\s+of\s+16/gi, 'دور الـ16'],
    [/round\s+of\s+32/gi, 'دور الـ32'],
    [/last\s+16/gi, 'دور الـ16'],
    [/quarter[-\s]?finals?/gi, 'ربع النهائي'],
    [/semi[-\s]?finals?/gi, 'نصف النهائي'],
    [/third\s+place/gi, 'المركز الثالث'],
    [/knockout(\s+stage)?/gi, 'الأدوار الإقصائية'],
    [/regular\s+season/gi, 'الموسم المنتظم'],
    [/group\s+([A-H])\b/gi, 'المجموعة $1'],
    [/matchday/gi, 'الجولة'],
    [/\bround\b/gi, 'الجولة'],
    [/\bweek\b/gi, 'الأسبوع'],
    [/\bfinal\b/gi, 'النهائي'],
    [/\bapertura\b/gi, 'أبيرتورا'],
    [/\bclausura\b/gi, 'كلاوسورا'],
    [/\bfriendly\b/gi, 'ودية'],
    [/\bfriendlies\b/gi, 'مباريات ودية'],
];

// Translate a league / competition label: exact-dictionary hit first, then in-place
// translation of any English round/stage fragments, then tidy the separators left
// behind (stray "-" or double spaces).
export const translateLeague = (name?: string | null): string => {
    if (!name) return '';
    if (LEAGUE_TRANSLATIONS[name]) return LEAGUE_TRANSLATIONS[name];
    let out = name;
    for (const [re, ar] of COMPETITION_PHRASES) out = out.replace(re, ar);
    return out.replace(/\s*-\s*$/,'').replace(/^\s*-\s*/,'').replace(/\s{2,}/g, ' ').trim();
};
export const translateTeam = (name: string) => translate(TEAM_TRANSLATIONS, name);


export const mapApiStatus = (status: string | null): { status: MatchStatus; statusText: string } => {
    switch (status) {
        case 'IN_PLAY':
            return { status: MatchStatus.LIVE, statusText: 'مباشرة' };
        case 'PAUSED':
            return { status: MatchStatus.HALF_TIME, statusText: 'الإستراحة' };
        case 'FINISHED':
            return { status: MatchStatus.FINISHED, statusText: 'انتهت المباراة' };
        case 'TIMED':
        case 'SCHEDULED':
            return { status: MatchStatus.UPCOMING, statusText: 'لم تبدأ بعد' };
        case 'POSTPONED':
             return { status: MatchStatus.UPCOMING, statusText: 'مؤجلة' };
        default:
            return { status: MatchStatus.UPCOMING, statusText: 'مجدولة' };
    }
};

// Official high-quality logos for major leagues
export const LEAGUE_LOGOS: { [key: string]: string } = {
    'الدوري الإنجليزي الممتاز': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Premier_League_Logo.svg/1200px-Premier_League_Logo.svg.png',
    'الدوري الإنجليزي': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Premier_League_Logo.svg/1200px-Premier_League_Logo.svg.png',
    'دوري البطولة الإنجليزية (تشامبيونشيب)': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/96/EFL_Championship_logo.svg/1200px-EFL_Championship_logo.svg.png',
    'الدوري الإسباني': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/LaLiga_logo_2023.svg/1200px-LaLiga_logo_2023.svg.png',
    'الدوري الإيطالي': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Serie_A_logo_2022.svg/1200px-Serie_A_logo_2022.svg.png',
    'الدوري الألماني': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/df/Bundesliga_logo_%282017%29.svg/1200px-Bundesliga_logo_%282017%29.svg.png',
    'الدوري الفرنسي': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Ligue1_McDonald%27s_logo.svg/800px-Ligue1_McDonald%27s_logo.svg.png',
    'دوري روشن السعودي': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f7/Saudi_Pro_League_logo.svg/800px-Saudi_Pro_League_logo.svg.png',
    'الدوري السعودي': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f7/Saudi_Pro_League_logo.svg/800px-Saudi_Pro_League_logo.svg.png',
    'الدوري الهولندي': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Eredivisie_logo.svg/800px-Eredivisie_logo.svg.png',
    'الدوري البرتغالي': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bb/Liga_Portugal_logo_2023.svg/800px-Liga_Portugal_logo_2023.svg.png',
    'دوري أبطال أوروبا': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/UEFA_Champions_League_logo_2.svg/800px-UEFA_Champions_League_logo_2.svg.png',
    'دوري أبطال اوروبا': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/UEFA_Champions_League_logo_2.svg/800px-UEFA_Champions_League_logo_2.svg.png',
    'دوري ابطال اوروبا': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/UEFA_Champions_League_logo_2.svg/800px-UEFA_Champions_League_logo_2.svg.png',
    'UEFA Champions League': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/UEFA_Champions_League_logo_2.svg/800px-UEFA_Champions_League_logo_2.svg.png',
    'Champions League': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/UEFA_Champions_League_logo_2.svg/800px-UEFA_Champions_League_logo_2.svg.png',
    'بطولة أمم أوروبا': 'https://upload.wikimedia.org/wikipedia/en/thumb/0/04/UEFA_Euro_2024_Logo.svg/1200px-UEFA_Euro_2024_Logo.svg.png',
    'كأس العالم': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/FIFA_World_Cup_logo.svg/1200px-FIFA_World_Cup_logo.svg.png',
    'كأس العرش المغربي': 'https://upload.wikimedia.org/wikipedia/ar/0/0e/%D8%B4%D8%B9%D8%A7%D8%B1_%D9%83%D8%A3%D8%B3_%D8%A7%D9%84%D8%B9%D8%B1%D8%B4.png',
};

export const getLeagueLogo = (leagueName: string): string | undefined => {
    if (!leagueName) return undefined;
    if (LEAGUE_LOGOS[leagueName]) return LEAGUE_LOGOS[leagueName];
    
    // Normalize: remove Hamzas, convert Ta Marbuta to Ha, and Alif Maqsura (ى) to Ya (ي)
    const normalized = leagueName.trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ');

    const lowerLeague = leagueName.toLowerCase();
    if (lowerLeague.includes('champions league') || lowerLeague.includes('ucl')) return LEAGUE_LOGOS['دوري أبطال أوروبا'];
    if (lowerLeague.includes('premier league') || lowerLeague.includes('epl')) return LEAGUE_LOGOS['الدوري الإنجليزي الممتاز'];
    if (lowerLeague.includes('la liga') || lowerLeague.includes('laliga')) return LEAGUE_LOGOS['الدوري الإسباني'];
    if (lowerLeague.includes('serie a')) return LEAGUE_LOGOS['الدوري الإيطالي'];
    if (lowerLeague.includes('ligue 1')) return LEAGUE_LOGOS['الدوري الفرنسي'];
    if (lowerLeague.includes('bundesliga')) return LEAGUE_LOGOS['الدوري الألماني'];
    if (lowerLeague.includes('eredivisie')) return LEAGUE_LOGOS['الدوري الهولندي'];
    if (lowerLeague.includes('world cup')) return LEAGUE_LOGOS['كأس العالم'];
    if (lowerLeague.includes('euro 2024') || lowerLeague.includes('uefa euro')) return LEAGUE_LOGOS['بطولة أمم أوروبا'];

    if (normalized.includes('دوري ابطال اوروبا') || 
        normalized.includes('دوري ابطال اوربا') || 
        normalized.includes('دوري الابطال') || 
        normalized.includes('تشامبيونز ليج') ||
        normalized.includes('ابطال اوروبا') ||
        normalized.includes('ابطال اوربا') ||
        normalized.includes('ucl') ||
        normalized.includes('champions league') ||
        normalized.includes('uefa champions league')
    ) return LEAGUE_LOGOS['دوري أبطال أوروبا'];
    if (normalized.includes('الدوري الانجليزي')) return LEAGUE_LOGOS['الدوري الإنجليزي الممتاز'];
    if (normalized.includes('الدوري الاسباني') || normalized.includes('لا ليغا') || normalized.includes('لاليغا')) return LEAGUE_LOGOS['الدوري الإسباني'];
    if (normalized.includes('الدوري الايطالي')) return LEAGUE_LOGOS['الدوري الإيطالي'];
    if (normalized.includes('الدوري الفرنسي')) return LEAGUE_LOGOS['الدوري الفرنسي'];
    if (normalized.includes('دوري روشن') || normalized.includes('الدوري السعودي')) return LEAGUE_LOGOS['دوري روشن السعودي'];
    if (normalized.includes('الدوري الهولندي')) return LEAGUE_LOGOS['الدوري الهولندي'];
    if (normalized.includes('الدوري الالماني') || normalized.includes('بوندسليغا')) return LEAGUE_LOGOS['الدوري الألماني'];
    if (normalized.includes('كاس العالم')) return LEAGUE_LOGOS['كأس العالم'];
    if (normalized.includes('امم اوروبا') || normalized.includes('يورو')) return LEAGUE_LOGOS['بطولة أمم أوروبا'];
    
    return undefined;
};

export const getShortLeagueName = (leagueName: string): string => {
    if (!leagueName) return '';
    if (leagueName === 'الدوري الإنجليزي الممتاز') return 'الدوري الإنجليزي';
    if (leagueName === 'دوري روشن السعودي') return 'دوري روشن';
    if (leagueName === 'دوري أبطال أوروبا') return 'أبطال أوروبا';
    if (leagueName === 'كأس العرش المغربي' || leagueName.includes('كأس العرش')) return 'كأس العرش';
    if (leagueName === 'كأس أمم إفريقيا تحت 17' || leagueName.includes('إفريقيا تحت 17') || leagueName.includes('امم افريقيا تحت 17')) return 'كأس أمم إفريقيا\nتحت 17';
    return leagueName;
};

export const getShortChannelName = (channelName: any): string => {
    if (!channelName) return '';
    const name = typeof channelName === 'string' ? channelName : (channelName.name || '');
    if (!name) return '';
    let shortName = name;
    shortName = shortName.replace(/بي إن سبورت ماكس/g, 'بى إن ماكس');
    shortName = shortName.replace(/بي إن سبورت/g, 'بي إن');
    shortName = shortName.replace(/beIN Sports/gi, 'beIN');
    shortName = shortName.replace(/أون تايم سبورتس/g, 'أون تايم');
    shortName = shortName.replace(/أبوظبي الرياضية/g, 'أبوظبي');
    return shortName;
};

export const CHANNEL_LOGOS: { [key: string]: string } = {
    'bein_generic': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/IlXAlJRwHjQgSyY1L5O4a.png',
    '1': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/IlXAlJRwHjQgSyY1L5O4a.png',
    '2': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/IlXAlJRwHjQgSyY1L5O4a.png',
    '3': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/IlXAlJRwHjQgSyY1L5O4a.png',
    '4': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/IlXAlJRwHjQgSyY1L5O4a.png',
    '5': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/IlXAlJRwHjQgSyY1L5O4a.png',
    '6': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/IlXAlJRwHjQgSyY1L5O4a.png',
    '7': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/IlXAlJRwHjQgSyY1L5O4a.png',
    '8': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/IlXAlJRwHjQgSyY1L5O4a.png',
    '9': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/IlXAlJRwHjQgSyY1L5O4a.png',
    'max1': 'https://upload.wikimedia.org/wikipedia/commons/9/9c/The_new_logo_of_beIN_MAX_1_at_2017.png',
    'max2': 'https://upload.wikimedia.org/wikipedia/commons/6/6f/BeIN_Sports_MAX.png',
    'thmanyah': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/kPcfg6ikDQt-keOKX9Wbw.png?quality=60&auto=webp&format=pjpg',
    'abu': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/Vwrw-P-8-MqQYHCQrM2W-.png?quality=60&auto=webp&format=pjpg',
    'abu1': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/Vwrw-P-8-MqQYHCQrM2W-.png?quality=60&auto=webp&format=pjpg',
    'abu2': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/Vwrw-P-8-MqQYHCQrM2W-.png?quality=60&auto=webp&format=pjpg',
    'arryadia': 'https://wsrv.nl/?url=https%3A%2F%2Fcdn.sportfeeds.io%2Ftv-schedule%2Fchannel%2Fimages%2FpFbqcBbuk2UkPcljlkrNu.jpg&output=webp&q=80&w=20',
    'on': 'https://upload.wikimedia.org/wikipedia/commons/2/22/On_Time_Sports_Logo.png',
    'dubai': 'https://upload.wikimedia.org/wikipedia/commons/4/41/Dubai_Sports_Channel_Logo.png',
    'mbc': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/MBC_Masr_Logo.svg/1200px-MBC_Masr_Logo.svg.png',
    'mbc2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/MBC_Masr_2_Logo.svg/1200px-MBC_Masr_2_Logo.svg.png',
    'algeria': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/EPTV_1.svg/1200px-EPTV_1.svg.png',
    'starzplay': 'https://wsrv.nl/?url=https%3A%2F%2Fcdn.sportfeeds.io%2Ftv-schedule%2Fchannel%2Fimages%2FgGKOgFCA7gkaqRZLmUGOz.jpg&output=webp&q=80&w=20',
    'tod': 'https://wsrv.nl/?url=https%3A%2F%2Fcdn.sportfeeds.io%2Ftv-schedule%2Fchannel%2Fimages%2F3wgLZhks6UOCpHmoDJ8qi.png&output=webp&q=80&w=20',
    'dazn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/DAZN_Logo.svg/1200px-DAZN_Logo.svg.png',
    'sky': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Sky_Sports_logo_2020.svg/1200px-Sky_Sports_logo_2020.svg.png',
    'espn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/1200px-ESPN_wordmark.svg.png',
    'sporttv': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Sport_TV_logo.svg/1200px-Sport_TV_logo.svg.png',
    'shahid': 'https://cdn.sportfeeds.io/tv-schedule/channel/images/o5gx-GvXp49r8n1SnF6CM.jpg?quality=60&amp;auto=webp&amp;format=pjpg',
};

export const getChannelLogo = (channelName: any): string | undefined => {
    if (!channelName) return undefined;
    const name = typeof channelName === 'string' ? channelName : (channelName.name || '');
    if (!name) return undefined;
    const normalized = name.toLowerCase();
    
    // Check for specific app or platform names first
    if (normalized.includes('تطبيق tod') || normalized.includes('tod')) return CHANNEL_LOGOS['tod'];
    if (normalized.includes('تطبيق ثمانية') || normalized.includes('thmanyah') || normalized.includes('ثمانية 1') || normalized.includes('ثمانية')) return CHANNEL_LOGOS['thmanyah'];
    
    // Check for Max channels
    if (normalized.includes('max') || normalized.includes('ماكس')) {
         if (normalized.includes('2')) return CHANNEL_LOGOS['max2'];
         return CHANNEL_LOGOS['max1'];
    }

    // Check for beIN Sports numbered channels
    if (normalized.includes('bein') || normalized.includes('بي إن') || normalized.includes('بي ان')) {
         if (normalized.includes('1')) return CHANNEL_LOGOS['1'];
         if (normalized.includes('2')) return CHANNEL_LOGOS['2'];
         if (normalized.includes('3')) return CHANNEL_LOGOS['3'];
         if (normalized.includes('4')) return CHANNEL_LOGOS['4'];
         if (normalized.includes('5')) return CHANNEL_LOGOS['5'];
         if (normalized.includes('6')) return CHANNEL_LOGOS['6'];
         if (normalized.includes('7')) return CHANNEL_LOGOS['7'];
         if (normalized.includes('8')) return CHANNEL_LOGOS['8'];
         if (normalized.includes('9')) return CHANNEL_LOGOS['9'];
         return CHANNEL_LOGOS['bein_generic'];
    }

    // Other channels
    if (normalized.includes('شاهد') || normalized.includes('shahid')) return CHANNEL_LOGOS['shahid'];
    if (normalized.includes('starzplay')) return CHANNEL_LOGOS['starzplay'];
    // Sources spell it both "أبوظبي" and "أبو ظبي", so match on a space-collapsed
    // copy — otherwise the spaced form fell through to the Arryadia branch below
    // and Abu Dhabi Sports rendered the Moroccan channel's logo.
    const compact = normalized.replace(/\s+/g, '');
    if (compact.includes('أبوظبي') || compact.includes('ابوظبي') || compact.includes('abudhabi') || normalized.includes('ad sports')) {
         if (normalized.includes('1') || normalized.includes('١')) return CHANNEL_LOGOS['abu1'];
         if (normalized.includes('2') || normalized.includes('٢')) return CHANNEL_LOGOS['abu2'];
         return CHANNEL_LOGOS['abu'];
    }
    if (normalized.includes('arryadia') || normalized.includes('الرياضية المغربية') || normalized.includes('المغربية الرياضية') || (normalized.includes('الرياضية') && !compact.includes('أبوظبي') && !compact.includes('ابوظبي') && !normalized.includes('دبي') && !normalized.includes('الكأس') && !normalized.includes('السعودية'))) return CHANNEL_LOGOS['arryadia'];
    if (normalized.includes('أون تايم') || normalized.includes('on time')) return CHANNEL_LOGOS['on'];
    if (normalized.includes('دبي') || normalized.includes('dubai')) return CHANNEL_LOGOS['dubai'];
    if (normalized.includes('mbc')) {
         if (normalized.includes('2')) return CHANNEL_LOGOS['mbc2'];
         return CHANNEL_LOGOS['mbc'];
    }
    if (normalized.includes('algeria') || normalized.includes('الجزائرية')) return CHANNEL_LOGOS['algeria'];
    if (normalized.includes('dazn')) return CHANNEL_LOGOS['dazn'];
    if (normalized.includes('sky sport')) return CHANNEL_LOGOS['sky'];
    if (normalized.includes('espn')) return CHANNEL_LOGOS['espn'];
    if (normalized.includes('sport tv')) return CHANNEL_LOGOS['sporttv'];
    
    return undefined;
};

export const generateMatchSlug = (home: string, away: string, date: string): string => {
    // Remove characters that might interfere with URL parsing (like / or ?)
    // Keep Arabic chars, letters, numbers, spaces, and hyphens
    const clean = (s: string) => s ? s.trim()
        .replace(/[^\w\u0600-\u06FF\s-]/g, '')
        .replace(/\s+/g, '-') : 'unknown';

    let d = '0000-00-00';
    if (date && typeof date === 'string' && date.includes('T')) {
        try {
            d = date.split('T')[0];
        } catch(e) {
            console.error('Error parsing date for slug', e);
        }
    } else if (date) {
        // Fallback if date is just YYYY-MM-DD
        d = date;
    }

    return `/\u0645\u0628\u0627\u0631\u0627\u0629-\u0627\u0644\u064A\u0648\u0645/${clean(home)}-\u0636\u062F-${clean(away)}-${d}`;
};

export const NATIONAL_TEAM_TO_CODE: { [key: string]: string } = {
    'Argentina': 'ar', 'Belgium': 'be', 'Brazil': 'br', 'Egypt': 'eg', 'England': 'gb-eng', 'France': 'fr', 'Germany': 'de', 'Italy': 'it', 'Morocco': 'ma', 'Netherlands': 'nl', 'Portugal': 'pt', 'Qatar': 'qa', 'Saudi Arabia': 'sa', 'Spain': 'es',
};

// تم تحديث القائمة لتشمل فقط الدوريات والبطولات المطلوبة
export const MAJOR_TOURNAMENT_NAMES_AR = new Set([
    'كأس العالم',
    'دوري أبطال أوروبا',
    'الدوري الأوروبي',
    'دوري المؤتمر الأوروبي',
    'دوري أبطال أفريقيا',
    'كأس الكونفدرالية الأفريقية',
    'دوري أبطال آسيا',
    'دوري أبطال آسيا للنخبة',
    'دوري أبطال آسيا 2',
    'كأس الأمم الإفريقية',
    'بطولة أمم أوروبا',
    'دوري الأمم الأوروبية',
    'كأس آسيا',
    'كأس العرب',
    'كأس الخليج',
    'كأس العالم للأندية',
    'الدوري الإنجليزي الممتاز',
    'الدوري الإنجليزي',
    'الدوري الإسباني',
    'الدوري الإيطالي',
    'الدوري الألماني',
    'الدوري الفرنسي',
    'الدوري المغربي',
    'كأس العرش المغربي',
    'الدوري المصري الممتاز',
    'دوري روشن السعودي',
    'الدوري السعودي',
    'كأس ملك إسبانيا',
    'كأس الاتحاد الإنجليزي',
    'كأس رابطة المحترفين الإنجليزية',
    'كأس إيطاليا',
    'كأس ألمانيا',
    'كأس فرنسا',
    'كأس السوبر الإسباني',
    'كأس السوبر الإنجليزي',
    'كأس السوبر الإيطالي',
    'كأس السوبر الألماني',
    'كأس السوبر الفرنسي',
    'كأس السوبر الأوروبي',
    'كأس السوبر الإفريقي',
    'كأس أمم إفريقيا تحت 17',
    'تصفيات كأس العالم',
    'تصفيات أمم أفريقيا',
    'تصفيات أمم أوروبا',
    'تصفيات كأس آسيا',
    'مباريات ودية',
    // South American clubs + the English League Cup. Each competition is listed
    // under every spelling the sources use — the match feed writes
    // "كوبا ليبيرتادورس" / "كوبا سود امريكا" / "كأس الكاراباو" while winwin writes
    // "كوبا ليبرتادوريس" / "كوبا سود أمريكانا" / "كأس رابطة الأندية الإنجليزية",
    // and this list is matched by substring so both forms must be present.
    'كوبا ليبرتادوريس',
    'كوبا ليبيرتادورس',
    'كوبا سود أمريكانا',
    'كوبا سود امريكا',
    'كأس رابطة الأندية الإنجليزية',
    'كأس الكاراباو',
    'كاراباو'
]);

const _normalizeArabic = (text: string) => {
    return text.toLowerCase().trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
};

// Women's competitions are filtered out wholesale by UNWANTED_KEYWORDS ('سيدات'/'women'),
// but the Women's Africa Cup of Nations is explicitly wanted on both the matches and
// standings pages — detect it so it can be whitelisted before that filter runs.
export const isWomensAfcon = (leagueName: string): boolean => {
    if (!leagueName) return false;
    const n = leagueName.toLowerCase();
    const norm = _normalizeArabic(leagueName);
    return norm.includes('افريقيا للسيدات') || norm.includes('امم افريقيا للسيدات')
        || (n.includes('women') && n.includes('africa') && n.includes('cup'))
        || n.includes('wafcon') || n.includes('caf.w.nations');
};

const UNWANTED_KEYWORDS = [
    // Women
    'women', 'ladies', 'femmes', 'femenino', 'frauen', 'donne', 'vrouwen', 'kvinner', 'damer',
    'سيدات', 'نسائي', 'إناث', 'بنات',
    // Lower Divisions
    'الدرجة الأولى', 'الدرجة الثانية', 'الدرجة الثالثة', 'الدرجة الرابعة', 'الدرجه الثانيه', 'الدرجه الثالثه',
    'القسم الثاني', 'القسم الثالث', 'القسم الرابع',
    'الدوري المغربي القسم الثاني',
    'division 1', 'division 2', 'division 3', '2nd division', '3rd division',
    'serie b', 'serie c', 'segunda', 'tercera', '2. bundesliga', '3. liga', 'ligue 2',
    'تشامبيونشيب', 'دوري البطولة الإنجليزية', 'league one', 'league two',
    // Youth / Reserves
    'رديف', 'شباب', 'تحت 21', 'تحت 20', 'تحت 19', 'تحت 17', 'u21', 'u20', 'u19', 'u17', 'youth', 'reserve', 'reserves'
];

const ENGLISH_MAJORS = [
    'champions league', 'premier league', 'la liga', 'serie a', 'bundesliga', 
    'ligue 1', 'afc champions', 'europa league', 'conference league',
    'fa cup', 'carabao cup', 'copa del rey', 'coppa italia', 'dfb pokal',
    'caf champions', 'botola', 'saudi professional',
    'world cup', 'euro 20', 'asian cup', 'arab cup', 'club world cup',
    'super cup', 'supercup', 'coupe de france',
    'mar.1', 'eng.fa', 'eng.league_cup', 'esp.copa_del_rey',
    'ita.coppa_italia', 'ger.dfb_pokal', 'fra.coupe_de_france',
    'دوري ابطال اوربا', 'دوري الابطال', 'ابطال اوروبا', 'ابطال افريقيا', 'ابطال اسيا',
    'afcon', 'uefa', 'caf', 'afc'
];

const NORMALIZED_MAJOR_TOURNAMENT_NAMES = new Set(
    Array.from(MAJOR_TOURNAMENT_NAMES_AR).map(name => _normalizeArabic(name))
);

export const STANDINGS_MAJOR_TOURNAMENTS = new Set([
    'كأس العالم',
    'دوري أبطال أوروبا',
    'الدوري الأوروبي',
    'دوري المؤتمر', // More general
    'دوري أبطال أفريقيا',
    'الكونفدرالية', // More general
    'دوري أبطال آسيا',
    'النخبة', // More general
    'أبطال آسيا 2', // More general
    'كأس الأمم الإفريقية',
    'أمم أفريقيا', // More general
    'بطولة أمم أوروبا',
    'أمّم أوروبا', // More general
    'اليورو',
    'أمم أوروبا', // More general
    'دوري الأمم الأوروبية',
    'كأس آسيا',
    'كأس العرب',
    'كأس الخليج',
    'كأس العالم للأندية',
    'الدوري الإنجليزي الممتاز',
    'الدوري الإنجليزي',
    'الدوري الإسباني',
    'الدوري الإيطالي',
    'الدوري الألماني',
    'الدوري الفرنسي',
    'دوري روشن', // More general
    'الدوري السعودي',
    'الدوري المغربي',
    'كأس العرش المغربي',
    'البطولة الاحترافية', // More general
    'الدوري المصري', // More general
    'كأس ملك إسبانيا',
    'كأس الاتحاد الإنجليزي',
    'كأس رابطة المحترفين', // More general
    'كأس إيطاليا',
    'كأس ألمانيا',
    'كأس فرنسا',
    'كأس السوبر الإسباني',
    'كأس السوبر الإنجليزي',
    'كأس السوبر الإيطالي',
    'كأس السوبر الألماني',
    'كأس السوبر الفرنسي',
    'كأس السوبر الأوروبي',
    'كأس السوبر الإفريقي',
    'كأس أمم إفريقيا تحت 17',
    'تصفيات كأس العالم',
    'تصفيات أمم أفريقيا',
    'تصفيات أمم أوروبا',
    'تصفيات كأس آسيا',
    'المباريات الودية الدولية',
    'مباريات ودية'
]);

export const isStandingLeague = (leagueName: string): boolean => {
    if (!leagueName) return false;
    
    const name = leagueName.toLowerCase();
    const normalizedName = _normalizeArabic(leagueName);

    if (normalizedName.includes('امم افريقيا تحت 17') || normalizedName.includes('إفريقيا تحت 17') || normalizedName.includes('افريقيا تحت 17') || name.includes('u17 africa') || name.includes('u-17 africa')) return true;
    if (isWomensAfcon(leagueName)) return true;

    // 1. إزالة الدوريات والكؤوس النسائية والدرجات الدنيا والشباب أولاً
    for (const keyword of UNWANTED_KEYWORDS) {
        if (name.includes(keyword) || normalizedName.includes(_normalizeArabic(keyword))) return false;
    }

    for (const major of STANDINGS_MAJOR_TOURNAMENTS) {
        const normMajor = _normalizeArabic(major);
        // Direct inclusion
        if (normalizedName.includes(normMajor)) return true;
        
        // Reverse inclusion for specific cases (only if the api name is long enough to avoid generic partial matches)
        if (normalizedName.length > 8 && normMajor.includes(normalizedName)) {
             return true;
        }
    }
    
    return false;
};

export const isMajorLeague = (leagueName: string): boolean => {
    if (!leagueName) return false;
    
    const name = leagueName.toLowerCase();
    const normalizedName = _normalizeArabic(leagueName);
    
    if (normalizedName.includes('امم افريقيا تحت 17') || normalizedName.includes('إفريقيا تحت 17') || normalizedName.includes('افريقيا تحت 17') || name.includes('u17 africa') || name.includes('u-17 africa')) return true;
    if (isWomensAfcon(leagueName)) return true;

    // 1. إزالة الدوريات والكؤوس النسائية والدرجات الدنيا والشباب أولاً
    for (const keyword of UNWANTED_KEYWORDS) {
        if (name.includes(keyword) || normalizedName.includes(_normalizeArabic(keyword))) return false;
    }

    // 2. Check direct set first (fast)
    if (MAJOR_TOURNAMENT_NAMES_AR.has(leagueName)) return true;
    
    // 3. Check for normalized direct set match
    if (NORMALIZED_MAJOR_TOURNAMENT_NAMES.has(normalizedName)) return true;

    // 4. Check for partial matches with Arabic names (normalized)
    for (const major of NORMALIZED_MAJOR_TOURNAMENT_NAMES) {
        if (normalizedName.includes(major) || major.includes(normalizedName)) return true;
    }

    // 5. Extra checks for English names or codes commonly returned by APIs
    for (const major of ENGLISH_MAJORS) {
        if (name.includes(major) || normalizedName.includes(_normalizeArabic(major))) return true;
    }
    
    return false;
};
