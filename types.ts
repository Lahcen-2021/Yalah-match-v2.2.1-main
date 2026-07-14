
// The `MatchStatus` enum defines the possible states of a match.
export enum MatchStatus {
  LIVE = 'LIVE',
  FINISHED = 'FINISHED',
  UPCOMING = 'UPCOMING',
  HALF_TIME = 'HALF_TIME',
}

// Represents the clean, processed team data used by UI components.
export interface Team {
  name: string;
  logoUrl: string;
  countryCode?: string;
}

// Represents the clean, processed match data used by UI components.
export interface Match {
  id: number;
  channel: string;
  league: string;
  leagueCode: string; // Added to fetch standings
  leagueLogoUrl?: string;
  teamA: Team;
  teamB: Team;
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  statusText: string;
  time?: string;
  stadium?: string;
  stadiumLogoUrl?: string;
  referee?: string;
  commentator?: string; // Added commentator
  halfTimeScore?: string;
  utcDate: string; // Added to calculate live match timer
  round?: string; // For detail view header
}

// Added for match highlights feature
export interface GoalEvent {
  teamName: string;
  scorerName: string;
  minute: number;
  scorerImage?: string;
}

// --- Types for Match Details Redesign ---
export interface Player {
  name: string;
  position: string; // e.g., 'حارس مرمى', 'الدفاع'
  number: number;
  // Fix: Added logoUrl to Player interface to support player avatars/images in lineups and detail views
  logoUrl?: string;
  // Optional for starters, not needed for bench
  pitchX?: number;
  pitchY?: number;
  // Player stats for tooltip
  stats?: {
      goals?: number;
      assists?: number;
      rating?: number;
  };
}

export interface Coach {
    name: string;
    photoUrl?: string;
}

export interface MatchStatistic {
  type: string;
  homeValue: string; // Can be number or percentage string
  awayValue: string; // Can be number or percentage string
}

export interface H2HMatch {
  date: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeLogo?: string;
  awayLogo?: string;
  leagueLogo?: string;
}

export interface TimelineEvent {
  minute: number;
  extraTime?: number; // Added for 45+2 etc.
  type: 'goal' | 'yellow-card' | 'red-card' | 'substitution';
  team: 'A' | 'B'; // 'A' for home, 'B' for away
  playerIn: string;
  playerInId?: string; // For images
  playerInImage?: string; // For images
  playerOut?: string;
  playerOutId?: string; // For images
  playerOutImage?: string; // For images
  assist?: string; // Added for goal assists
  isPenalty?: boolean;
  isPenaltyShootout?: boolean;
  isOwnGoal?: boolean;
}

export interface GoalInfo {
  minute: number;
  scorerName: string;
  scorerId?: string;
  scorerImage?: string;
}

export interface Standing {
    position: number;
    team: {
        id: number;
        name:string;
        crest: string;
    };
    playedGames: number;
    won: number;
    draw: number;
    lost: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    form: string | null;
}

export interface StandingGroup {
    name: string;
    standings: Standing[];
}

// --- Knockout bracket (cup competitions), served by GET /api/bracket ---
export interface BracketSide {
    id: number;
    name: string;
    winner: boolean;
    score: number | null;      // aggregate score over the tie, null if not played
    penalties: number | null;  // shoot-out score, null if none
}

export interface BracketTie {
    home: BracketSide | null;
    away: BracketSide | null;
    live: boolean;
    startTime: string | null;
    winDescription: string;
}

export interface BracketStage {
    num: number;
    name: string;
    isFinal: boolean;
    isCurrent: boolean;
    ties: BracketTie[];
}

export interface CompetitionBracket {
    title: string;
    stages: BracketStage[];
}

// Football news article aggregated from RSS feeds, served by GET /api/news
export interface NewsItem {
    id: string;
    title: string;
    description: string;
    link: string;
    source: string;
    imageUrl: string;
    publishedAt: string;
    translated: boolean;
}

// Full article body for the in-site reader, served by GET /api/news/article
export interface NewsArticle extends NewsItem {
    paragraphs: string[];
    sourceUrl: string;
}

export interface Scorer {
    rank: number;
    player: {
        id: number;
        name: string;
        imageUrl?: string;
    };
    team: {
        name: string;
        logoUrl: string;
    };
    goals: number;
    assists?: number;
    played?: number;
}

export interface ChannelInfo {
    name: string;
    logo?: string;
    url?: string;
}

export interface MatchInfo {
    stadium?: string;
    referee?: string;
    commentator?: string;
    channel?: (string | ChannelInfo)[];
    round?: string;
}

export interface MatchDetails {
  statistics: MatchStatistic[];
  lineupHome: Player[];
  lineupAway: Player[];
  benchHome: Player[];
  benchAway: Player[];
  homeCoach?: Coach;
  awayCoach?: Coach;
  formationHome: string;
  formationAway: string;
  timeline: TimelineEvent[];
  homeGoals: GoalInfo[];
  awayGoals: GoalInfo[];
  penaltyScoreA?: number;
  penaltyScoreB?: number;
  h2h?: H2HMatch[];
  recentMatchesA?: H2HMatch[];
  recentMatchesB?: H2HMatch[];
  standings?: Standing[];
  matchInfo?: MatchInfo;
  scoreA?: number;
  scoreB?: number;
  status?: MatchStatus;
  statusText?: string;
}


// --- Raw API Data Types for football-data.org ---

export interface FootballDataApiCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
}

export interface FootballDataApiSingleCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string | null;
  area: {
      name: string;
      flag: string | null;
  };
}

export interface FootballDataApiCompetitionsResponse {
    count: number;
    competitions: FootballDataApiSingleCompetition[];
}

export interface FootballDataApiCompetitionTeamsResponse {
    competition: FootballDataApiCompetition;
    teams: FootballDataApiTeam[];
    season: {
        startDate: string;
        endDate: string;
        currentMatchday: number;
    }
}

export interface FootballDataApiTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface FootballDataApiScoreValue {
  home: number | null;
  away: number | null;
}

export interface FootballDataApiScore {
  winner: string | null;
  duration: string;
  fullTime: FootballDataApiScoreValue;
  halfTime: FootballDataApiScoreValue;
}

export interface FootballDataApiReferee {
    id: number;
    name: string;
    type: string;
    nationality: string | null;
}

export interface FootballDataApiMatch {
  area: { flag: string };
  id: number;
  competition: FootballDataApiCompetition;
  utcDate: string;
  status: string;
  venue: string | null;
  matchday: number;
  homeTeam: FootballDataApiTeam;
  awayTeam: FootballDataApiTeam;
  score: FootballDataApiScore;
  referees: FootballDataApiReferee[];
}

export interface FootballDataApiResponse {
    matches: FootballDataApiMatch[];
}

export interface FootballDataApiStandingTableItem {
    position: number;
    team: FootballDataApiTeam;
    playedGames: number;
    form: string | null;
    won: number;
    draw: number;
    lost: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
}

export interface FootballDataApiStanding {
    stage: string;
    type: 'TOTAL' | 'HOME' | 'AWAY';
    group: string | null;
    table: FootballDataApiStandingTableItem[];
}

export interface FootballDataApiStandingsResponse {
    competition: FootballDataApiCompetition;
    standings: FootballDataApiStanding[];
}
