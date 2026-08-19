// Per-route metadata for the SPA. index.html ships one <title>/description/canonical
// for every route, so without this a match page and the homepage index identically.
// These helpers update the document head on navigation (client-side, but Google renders
// SPAs) and, for match pages, emit a SportsEvent JSON-LD block for rich results.
import type { Match } from '../types';

const SITE = 'https://www.yallamatch.online';
const DEFAULT_TITLE = 'يلا ماتش | مباريات اليوم بث مباشر - Yalla Match';
const DEFAULT_DESC =
    'يلا ماتش: مواعيد مباريات اليوم، النتائج المباشرة، القنوات الناقلة والمعلقين، ترتيب الدوريات والبطولات وآخر أخبار كرة القدم.';
const DEFAULT_OG_IMAGE = `${SITE}/og-image.jpg`;

const setTag = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
    let el = document.head.querySelector(selector) as HTMLElement | null;
    if (!el) { el = create(); document.head.appendChild(el); }
    el.setAttribute(attr, value);
};

const setMeta = (key: 'name' | 'property', name: string, content: string) =>
    setTag(`meta[${key}="${name}"]`, () => { const m = document.createElement('meta'); m.setAttribute(key, name); return m; }, 'content', content);

const setCanonical = (href: string) =>
    setTag('link[rel="canonical"]', () => { const l = document.createElement('link'); l.setAttribute('rel', 'canonical'); return l; }, 'href', href);

// Base keyword set for every page — the popular Arabic football-streaming search terms.
const BASE_KEYWORDS = 'يلا ماتش, yalla match, يلا شوت, yalla shoot, كورة لايف, kora live, فابور تي في, fabor tv, يلا كورة, yalla kora, كووورة, kooora, مباريات اليوم, بث مباشر, القنوات الناقلة, مشاهدة المباريات';

export interface PageMeta {
    title?: string;
    description?: string;
    path?: string;   // canonical path, e.g. "/", "/news", or a match slug
    image?: string;
    keywords?: string; // extra, page-specific keywords prepended to the base set
}

// Update title + description + canonical + Open Graph/Twitter for the current route.
export const setPageMeta = ({ title, description, path, image, keywords }: PageMeta = {}): void => {
    const t = title ? `${title} | يلا ماتش` : DEFAULT_TITLE;
    const d = description || DEFAULT_DESC;
    const url = `${SITE}${path && path !== '/' ? path : '/'}`;
    const img = image || DEFAULT_OG_IMAGE;

    document.title = t;
    setMeta('name', 'description', d);
    setMeta('name', 'keywords', keywords ? `${keywords}, ${BASE_KEYWORDS}` : BASE_KEYWORDS);
    setCanonical(url);
    setMeta('property', 'og:title', t);
    setMeta('property', 'og:description', d);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', img);
    setMeta('name', 'twitter:title', t);
    setMeta('name', 'twitter:description', d);
    setMeta('name', 'twitter:image', img);
};

export const resetPageMeta = (): void => setPageMeta();

const JSONLD_ID = 'yalla-match-jsonld';

// SportsEvent structured data for a single match — the highest-value SEO signal for
// a fixtures site (earns rich results). Removed again when leaving the match page.
export const setMatchJsonLd = (match: Match, slug: string): void => {
    removeMatchJsonLd();
    const data = {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: `${match.teamA?.name} ضد ${match.teamB?.name}`,
        sport: 'Soccer',
        startDate: match.utcDate || undefined,
        eventStatus:
            match.status === 'LIVE' ? 'https://schema.org/EventScheduled'
            : match.status === 'FINISHED' ? 'https://schema.org/EventCompleted'
            : 'https://schema.org/EventScheduled',
        url: `${SITE}${slug}`,
        competitor: [
            { '@type': 'SportsTeam', name: match.teamA?.name, ...(match.teamA?.logoUrl ? { logo: match.teamA.logoUrl } : {}) },
            { '@type': 'SportsTeam', name: match.teamB?.name, ...(match.teamB?.logoUrl ? { logo: match.teamB.logoUrl } : {}) },
        ],
        ...(match.league ? { superEvent: { '@type': 'SportsOrganization', name: match.league } } : {}),
        ...(match.channel ? { broadcastOfEvent: { '@type': 'BroadcastEvent', name: match.channel } } : {}),
    };
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = JSONLD_ID;
    s.text = JSON.stringify(data);
    document.head.appendChild(s);
};

export const removeMatchJsonLd = (): void => {
    document.getElementById(JSONLD_ID)?.remove();
};
