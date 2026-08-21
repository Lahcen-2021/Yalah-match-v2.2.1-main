// Per-route metadata for the SPA. index.html ships one <title>/description/canonical
// for every route, so without this a match page and the homepage index identically.
// These helpers update the document head on navigation (client-side, but Google renders
// SPAs) and, for match pages, emit a SportsEvent JSON-LD block for rich results.
import type { Match } from '../types';

// Apex, NOT www. www.yallamatch.online returns Cloudflare 526: the edge cert covers
// it, but the origin-pull fails certificate validation there, so only the apex is
// actually reachable. WordPress's own home_url() is the apex too, and it renders the
// correct canonical server-side — which this file then OVERWROTE with the broken host
// on every route change. Keep these in step with index.html and robots.txt.
const SITE = 'https://yallamatch.online';
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

// Stadium resolved by the match-detail fetch, remembered per match id.
//
// Why remember instead of just patching the DOM: App.tsx re-emits this block whenever
// `selectedMatch` changes identity, which the list poll does on a timer. A patch applied
// straight to the element is wiped by the next re-emit, so the location has to be
// re-applied from here every time the block is rebuilt.
let knownLocation: { matchId: number; stadium: string } | null = null;

// SportsEvent structured data for a single match — the highest-value SEO signal for
// a fixtures site (earns rich results). Removed again when leaving the match page.
// The list-level Match rarely carries a stadium; the detail fetch is what resolves one.
const locationOf = (match: Match): string | undefined =>
    match.stadium?.trim() || (knownLocation?.matchId === match.id ? knownLocation.stadium : undefined);

export const setMatchJsonLd = (match: Match, slug: string): void => {
    removeMatchJsonLd();

    // schema.org/EventStatusType has NO "completed" member — the valid values are
    // EventScheduled / EventPostponed / EventCancelled / EventRescheduled /
    // EventMovedOnline. This used to emit `schema.org/EventCompleted` for finished
    // matches, which is not a real type, so the whole eventStatus property was
    // invalid. A match that has been played still "went ahead as scheduled";
    // only a postponement or cancellation changes the status.
    const eventStatus =
        match.statusText?.includes('مؤجلة') ? 'https://schema.org/EventPostponed'
        : match.statusText?.includes('ملغاة') ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled';

    const team = (t?: { name?: string; logoUrl?: string }) => ({
        '@type': 'SportsTeam',
        name: t?.name,
        ...(t?.logoUrl ? { logo: t.logoUrl } : {}),
    });

    // Every broadcaster we know about, structured list first (it is the richer one).
    const channelNames = (match.channels?.length
        ? match.channels.map(c => c.name)
        : (match.channel ? match.channel.split(' - ') : [])
    ).map(n => n.trim()).filter(Boolean);

    const data = {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: `${match.teamA?.name} ضد ${match.teamB?.name}`,
        sport: 'Soccer',
        startDate: match.utcDate || undefined,
        eventStatus,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        url: `${SITE}${slug}`,
        // SportsEvent has dedicated home/away properties; `competitor` alone loses
        // which side is which. Both are emitted — competitor stays for consumers
        // that only understand the generic Event vocabulary.
        homeTeam: team(match.teamA),
        awayTeam: team(match.teamB),
        competitor: [team(match.teamA), team(match.teamB)],
        ...(locationOf(match) ? { location: { '@type': 'Place', name: locationOf(match) } } : {}),
        // superEvent must be an Event (the competition this fixture belongs to), not an
        // Organization — SportsOrganization is a team/governing body, so the old value
        // was a type error that made the property unusable.
        ...(match.league ? { superEvent: { '@type': 'SportsEvent', name: match.league } } : {}),
        // `broadcastOfEvent` is a property OF a BroadcastEvent pointing back at the
        // event — putting it on the SportsEvent (as this did) inverts the relation
        // and is invalid. Event.publication is the correct property, and a
        // BroadcastEvent is a PublicationEvent, so it nests properly here.
        ...(channelNames.length ? {
            publication: channelNames.map(name => ({
                '@type': 'BroadcastEvent',
                name,
                isLiveBroadcast: true,
                ...(match.utcDate ? { startDate: match.utcDate } : {}),
                broadcastOfEvent: { '@type': 'SportsEvent', name: `${match.teamA?.name} ضد ${match.teamB?.name}` },
            })),
        } : {}),
    };
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = JSONLD_ID;
    s.text = JSON.stringify(data);
    document.head.appendChild(s);
};

/**
 * Record the stadium resolved by the match-detail fetch and apply it to the
 * SportsEvent block on the page.
 *
 * App.tsx emits that block from the LIST-level Match, which carries no stadium — only
 * MatchDetailView's `details.matchInfo.stadium` does. Recording it here means a later
 * re-emit (the list poll changes `selectedMatch` identity on a timer) keeps the
 * location instead of dropping it.
 */
export const setMatchJsonLdLocation = (matchId: number, stadium?: string): void => {
    const name = stadium?.trim();
    if (!name || name === 'غير محدد') return;
    knownLocation = { matchId, stadium: name };

    const el = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
    if (!el) return; // not emitted yet — the next setMatchJsonLd picks it up from knownLocation
    try {
        const data = JSON.parse(el.text);
        if (data.location?.name === name) return;
        data.location = { '@type': 'Place', name };
        el.text = JSON.stringify(data);
    } catch {
        // A malformed block is not worth throwing over — the page still renders.
    }
};

export const removeMatchJsonLd = (): void => {
    document.getElementById(JSONLD_ID)?.remove();
};
