/**
 * Generates wordpress-theme/yalla-match/inc/team-map.php from TEAM_TRANSLATIONS
 * in utils/translations.ts.
 *
 * Why: the PHP file's header already claimed to be "generated from
 * utils/translations.ts", but no generator existed - it was hand-maintained, so
 * the two copies drifted silently. Every team added to the TS map was invisible
 * to the PHP channel matcher until someone remembered to copy it across.
 *
 * The key normalisation below mirrors, exactly, what the PHP consumer applies to
 * an incoming Latin name before the lookup (inc/api-local.php, yalla_team_ar):
 *
 *     $key = mb_strtolower( $raw, 'UTF-8' );
 *     $key = preg_replace( '/[^a-z0-9\s]/u', ' ', $key );
 *     $key = preg_replace( '/\b(fc|sfc|sc|cf|ac|club|the)\b/u', ' ', $key );
 *     $key = trim( preg_replace( '/\s+/u', ' ', $key ) );
 *
 * Note the second line strips accented letters entirely (they are not in a-z),
 * which is why keys read "bayern m nchen" and "as saint tienne". That is the
 * behaviour of the live matcher, so the generator reproduces it rather than
 * "fixing" it - changing it here without changing the PHP would break lookups.
 *
 * Usage:  npm run gen:team-map        (also run by wordpress-theme/build-theme.ps1)
 *         npm run gen:team-map -- --check   exits non-zero if the file is stale
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TEAM_TRANSLATIONS } from '../utils/translations';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../wordpress-theme/yalla-match/inc/team-map.php');

/** Mirrors yalla_team_ar()'s key normalisation. See the comment above. */
const phpKey = (raw: string): string =>
    raw
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\b(fc|sfc|sc|cf|ac|club|the)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/** Escapes a value for a PHP double-quoted string literal. */
const phpString = (value: string): string =>
    '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$') + '"';

const build = (): string => {
    // Later duplicates lose, matching PHP array-literal semantics, so the map is
    // built in sorted key order for a stable diff.
    const map = new Map<string, string>();
    for (const [latin, arabic] of Object.entries(TEAM_TRANSLATIONS)) {
        const key = phpKey(latin);
        if (!key) continue;
        if (!map.has(key)) map.set(key, arabic);
    }

    const rows = [...map.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `\t\t${phpString(key)} => ${phpString(value)},`)
        .join('\n');

    return `<?php
/**
 * Latin -> Arabic club names.
 *
 * GENERATED FILE - DO NOT EDIT BY HAND.
 * Source: Yalah-match-v2.2.1-main/utils/translations.ts (TEAM_TRANSLATIONS)
 * Regenerate: npm run gen:team-map
 *
 * Lets the channel matcher bridge sources that publish Latin names (liveonsat,
 * the beIN EPG) onto the Arabic match feed.
 */

if ( ! defined( 'ABSPATH' ) ) {
\texit;
}

function yalla_team_latin_map() {
\treturn array(
${rows}
\t);
}
`;
};

const generated = build();
const check = process.argv.includes('--check');

if (check) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (current.replace(/\r\n/g, '\n') !== generated) {
        console.error(`team-map.php is stale. Run: npm run gen:team-map`);
        process.exit(1);
    }
    console.log('team-map.php is up to date.');
} else {
    writeFileSync(OUT, generated, 'utf8');
    const count = (generated.match(/=>/g) || []).length;
    console.log(`Wrote ${OUT} (${count} entries)`);
}
