// Official, ToS-safe fallback for major leagues only — activates the dead
// FootballDataApiMatch types in types.ts for the first time. Free tier doesn't cover
// Botola/Saudi Pro League/AFCON U17, so those leagues stay on the scraper-only path.
import { config } from "./config.ts";
import type { FootballDataApiMatch, FootballDataApiStandingsResponse } from "../types.ts";

const BASE_URL = "https://api.football-data.org/v4";

// Internal leagueId (matches STANDINGS_LEAGUE_MAP in server.ts / LEAGUE_MAP that used to
// live in services/api.ts) -> football-data.org competition code. Populated only for
// leagues already flagged major by MAJOR_LEAGUES_PRIORITY in App.tsx / isMajorLeague() in
// utils/translations.ts — no new "major league" concept invented here.
export const FOOTBALL_DATA_COMPETITIONS: Record<string, string> = {
    '7': 'PL',    // Premier League
    '11': 'PD',   // La Liga
    '13': 'SA',   // Serie A
    '15': 'BL1',  // Bundesliga
    '14': 'FL1',  // Ligue 1
    '572': 'CL',  // UEFA Champions League
    '564': 'DED', // Eredivisie
    '28': 'WC',   // World Cup
    '281': 'EC',  // European Championship
};

const STATUS_MAP: Record<string, string> = {
    SCHEDULED: 'لم تبدأ',
    TIMED: 'لم تبدأ',
    IN_PLAY: 'جارية',
    PAUSED: 'استراحة',
    FINISHED: 'انتهت',
    POSTPONED: 'مؤجلة',
    SUSPENDED: 'متوقفة',
    CANCELLED: 'ملغاة',
};

async function footballDataFetch(path: string): Promise<any> {
    if (!config.footballDataApiKey) return null;
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'X-Auth-Token': config.footballDataApiKey },
    });
    if (!res.ok) throw new Error(`football-data.org request failed: ${res.status}`);
    return res.json();
}

// Fetches matches across all competitions football-data.org's plan grants access to for
// the given date range — the response is filtered down to FOOTBALL_DATA_COMPETITIONS by
// the caller, since this fallback is intentionally scoped to major leagues only.
export async function fetchFootballDataMatches(dateFrom: string, dateTo: string): Promise<FootballDataApiMatch[]> {
    const data = await footballDataFetch(`/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    return Array.isArray(data?.matches) ? data.matches : [];
}

export async function fetchFootballDataStandings(competitionCode: string): Promise<FootballDataApiStandingsResponse | null> {
    return footballDataFetch(`/competitions/${competitionCode}/standings`);
}

// Adapts a football-data.org match into the same "STING-WEB-Matches" shape the
// messisporat/yallamatch sources return, so nothing in services/api.ts's normalization
// (mapStingMatchToMatch) needs to change to handle this fallback tier.
export function mapFootballDataMatchToSting(match: FootballDataApiMatch): any {
    return {
        "Cup-id": match.competition?.id,
        "Cup-Name": match.competition?.name || '',
        "Cup-Logo": match.competition?.emblem || '',
        "Match-id": match.id,
        "Team-Right": {
            Name: match.homeTeam?.name || match.homeTeam?.shortName || '',
            Logo: match.homeTeam?.crest || '',
            Goal: match.score?.fullTime?.home ?? 0,
        },
        "Team-Left": {
            Name: match.awayTeam?.name || match.awayTeam?.shortName || '',
            Logo: match.awayTeam?.crest || '',
            Goal: match.score?.fullTime?.away ?? 0,
        },
        "Match-Status": STATUS_MAP[match.status] || 'لم تبدأ',
        "Time-Start": match.utcDate,
        "Time-Zone": "+00:00",
        "Tv": '',
    };
}

// Adapts a football-data.org standings response into the same shape /api/standings
// already returns from the ESPN/365Scores tiers.
export function mapFootballDataStandingsToShared(data: FootballDataApiStandingsResponse | null): any[] {
    const standings = Array.isArray(data?.standings) ? data.standings : [];
    return standings
        .filter((group: any) => group.type === 'TOTAL')
        .map((group: any) => ({
            name: group.group || data?.competition?.name || '',
            standings: (Array.isArray(group.table) ? group.table : []).map((row: any) => ({
                position: row.position || 0,
                team: { id: row.team?.id, name: row.team?.name, crest: row.team?.crest },
                playedGames: row.playedGames || 0,
                won: row.won || 0,
                draw: row.draw || 0,
                lost: row.lost || 0,
                points: row.points || 0,
                goalsFor: row.goalsFor || 0,
                goalsAgainst: row.goalsAgainst || 0,
                goalDifference: row.goalDifference || 0,
                form: row.form || '',
            })),
        }));
}
