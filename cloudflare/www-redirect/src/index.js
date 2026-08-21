/**
 * Redirect www.yallamatch.online -> yallamatch.online at the Cloudflare edge.
 *
 * Why a Worker and not a DNS/origin fix: www returns Cloudflare 526. The edge
 * certificate covers *.yallamatch.online, so the browser handshake is fine — what
 * fails is the ORIGIN-PULL, because the origin's certificate does not cover the
 * www hostname. A Worker route answers at the edge and never fetches the origin,
 * so the broken leg is never walked.
 *
 * This is a mitigation, not a cure. The proper fix is to add www as an alias on
 * the origin so its certificate covers it; this Worker can then be deleted.
 *
 * The apex is the canonical host everywhere else: WordPress's home_url(),
 * utils/seo.ts SITE, index.html, robots.txt and both sitemap generators.
 */
export default {
    fetch(request) {
        const url = new URL(request.url);

        // Defensive: this Worker is routed only at www.*, but if it is ever
        // attached to the apex by mistake, passing the request through beats
        // redirecting the apex to itself forever.
        if (url.hostname !== 'www.yallamatch.online') {
            return fetch(request);
        }

        url.hostname = 'yallamatch.online';
        // 301: permanent, so crawlers consolidate signals onto the apex. Path,
        // query and hash are preserved by mutating only the hostname.
        return Response.redirect(url.toString(), 301);
    },
};
