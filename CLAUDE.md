# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Yalla Match (يلا ماتش)** is a modern, responsive Arabic football companion application that delivers real-time football schedules, live match updates, commentator rosters, team lineups, and streaming channel information. It's specifically optimized for the CAF U-17 African Cup of Nations (Morocco 2026) and integrates multiple data sources with persistent Firebase Firestore caching.

### Project Type
- **Full-stack web application**: React SPA frontend + Node.js Express backend
- **Deployment**: Netlify (frontend) + Cloud Run or similar (backend API)
- **Database**: Firebase Firestore with document-level caching strategy

## Technology Stack

### Frontend
- **React 19** with TypeScript and functional components
- **Vite 6** as the bundler with React plugin
- **Tailwind CSS 4** with `@tailwindcss/vite` for styling
- **Framer Motion / Motion** for animations and micro-interactions
- **Video playback**: `video.js`, `hls.js`, `plyr`, `plyr-react` for HLS streaming
- **Icons**: `lucide-react` for UI symbols
- **Firebase SDK** for Firestore integration

### Backend
- **Express 5** Node.js server
- **TypeScript (tsx)** for server runtime
- **Cheerio** for web scraping and HTML parsing
- **CORS & compression** middleware

### Development
- **TypeScript ~5.8.2** as the language
- **ESLint 9** with TypeScript support and React hooks plugins
- **Vite plugins**: React refresh, Tailwind CSS

## Build & Development Commands

```bash
# Development server (hot reload, runs on :3000)
npm run dev
npm run start

# Production build (outputs to dist/)
npm run build

# Preview production build locally
npm run preview

# Linting (strict: fails on warnings)
npm run lint
```

The development server uses Vite with HMR disabled (`hmr: false`) and watches all directories except `/data/**` to avoid performance issues with large JSON files.

## High-Level Architecture

### Core Data Flow

```
React SPA Client (Vite)
         ↓ (HTTP API)
Express Server (Node.js)
         ├─→ In-Memory Cache (10s-1h TTL)
         ├─→ Firebase Firestore (15s-4h TTL)
         └─→ External Data Sources
                ├─ STING-WEB-Matches API (yallamatch.pages.dev)
                ├─ Cheerio Web Scrapers (Kooora, 365Scores, etc.)
                ├─ ESPN APIs (standings, stats, summaries)
                └─ BeIN EPG data
```

### Client-Side Architecture

**Entry Point**: `index.tsx`
- Wraps app in `CacheProvider` (React Context for in-memory caching)
- Global error boundary handling and unhandled promise rejection suppression
- Mounts `App.tsx` to DOM root

**Main App State** (`App.tsx`):
- Manages view state: `matches | tournaments | standings | contact | channels | privacy | terms`
- Manages date tabs: `yesterday | today | tomorrow | live`
- Lazy loads view components via React.lazy()
- Implements match priority sorting using `MAJOR_LEAGUES_PRIORITY` object (keeps tournament/cup matches at top)
- Handles timezone sync via `syncWithServer()` to detect `serverTimeOffset`

**View Components**:
- **MatchCard**: Individual match display card with score, teams, status, channel
- **MatchDetailView**: Full match details overlay (77KB - largest component)
  - Interactive soccer pitch lineup with player positions
  - Live event timeline (goals, substitutions, cards)
  - Match statistics comparative graphics
  - H2H (head-to-head) historical match data
  - Multi-player streaming integration
- **StandingsView** / **U17AfconStandings**: Tournament standings and group tables
- **TournamentsView**: Tournament directory and U-17 AFCON details
- **ChannelsView**: Broadcasting channel directory with logos and links
- **DateTabs**: Quick navigation between date ranges

### Server-Side Architecture (`server.ts`)

**API Routes**:
- `GET /api/health`: Timestamp sync endpoint
- `GET /api/matches?date=YYYY-MM-DD`: Main matches endpoint with dual cache strategy
- `GET /api/proxy?url=...`: CORS proxy for scraping external APIs

**Caching Strategy**:
1. **In-memory cache** (10s TTL): Ultra-fast responses for same date queries
2. **Firestore persistent cache** (15s for today, 1h for past/future): Survives server restarts
3. **Fallback chain**: Primary API → secondary API → empty response

**CORS Proxy Rotation**:
Server implements 4-tier proxy rotation with retry logic:
1. Direct fetch
2. api.allorigins.win
3. thingproxy.freeboard.io
4. corsproxy.io

Handles 429 (rate limit) responses with exponential backoff.

### Data Normalization & Team Matching

**File**: `services/api.ts` (94KB)

Key functions for Arabic text processing:
- `normalizeArabic()`: Handles diacritics, character variants (ة→ה, أ→ا), harakat removal with caching
- `isFuzzyMatch()`: Complex Arabic/Latin team name matching with fallback to `translateTeam()`
- `generateMatchSlug()`: Creates URL-friendly match identifiers

**Competition Mapping**:
- Team translations via `TEAM_TRANSLATIONS` object in `utils/translations.ts`
- League priorities via `MAJOR_LEAGUES_PRIORITY` for UI sorting
- Special handling for CAF competitions and youth tournaments

### Firebase Integration

**Configuration**:
- `services/firebase.ts`: Initializes Firebase with custom Firestore database ID from `firebase-applet-config.json`
- `services/firestoreCache.ts`: Implements `getCachedData()` / `setCachedData()` with TTL validation

**Firestore Security**:
- Document path: `/cache/{cacheId}` (flat structure, no subcollections)
- ID validation: alphanumeric + dash/underscore, max 128 chars
- Schema: `{ data: any, updatedAt: ISO-8601 string }`
- Rules: Public reads, validated creation/update, no deletes (prevent tampering)

**Data Cache Keys**:
- `matches_YYYY-MM-DD`: Daily match list (15s TTL if today, 1h if past/future)
- `details_{matchId}`: Match detail data (30s TTL)
- `kooora_YYYY-MM-DD`: Commentator channel data (4h TTL)
- `standings_{leagueCode}`: League standings (variable TTL)

### Timezone Handling

**User Detection**:
- Browser timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Fallback: `Africa/Casablanca` (Morocco)
- Server syncs with client to detect offset (`serverTimeOffset`)

**Date String Calculation**:
- All dates in Morocco timezone (Africa/Casablanca)
- Format: `YYYY-MM-DD` ISO format
- Functions: `getMoroccanDateString(offsetDays)` on both client/server

### React Context: CacheContext

**Location**: `context/CacheContext.tsx`

Provides in-memory cache for API responses with TTL support:
```typescript
fetchWithCache<T>(
  key: string, 
  fetcher: () => Promise<T>, 
  ttl?: number,
  forceRefresh?: boolean
): Promise<T>
```

Used by components to cache match lists, standings, and detail views.

## File Structure (Key Directories)

```
├── components/              # React UI components (5,168 lines total)
│   ├── MatchDetailView.tsx  # Main match details overlay
│   ├── SoccerLineup.tsx     # Interactive pitch visualization
│   ├── MatchCard.tsx        # Match list card component
│   ├── StandingsView.tsx    # League standings tables
│   ├── U17AfconStandings.tsx # U-17 tournament-specific UI
│   └── ...                  # Other views (channels, tournaments, etc.)
├── services/
│   ├── api.ts              # Main API client (94KB) with normalization
│   ├── firebase.ts         # Firebase initialization
│   └── firestoreCache.ts   # Firestore caching utilities
├── utils/
│   ├── translations.ts     # Team/league translation maps
│   └── notifications.ts    # Web Notification integration
├── context/
│   └── CacheContext.tsx    # React Context for in-memory cache
├── server.ts              # Express server + data scraping
├── App.tsx                # Main app component with routing
├── index.tsx              # Entry point + error boundary
├── types.ts               # TypeScript interfaces and enums
├── constants.ts           # Social media icons
├── vite.config.ts         # Build configuration
├── tsconfig.json          # TypeScript compiler options
├── eslint.config.js       # ESLint v9 flat config
├── netlify.toml           # Netlify deployment config
├── firestore.rules        # Security rules
└── public/
    ├── manifest.json      # PWA manifest
    └── players/           # BeIN Sports player HTML files
```

## TypeScript Types

**Core Match Types** (`types.ts`):
- `Match`: Processed match data for UI (id, channel, league, scores, status, teams)
- `MatchStatus`: `LIVE | FINISHED | UPCOMING | HALF_TIME`
- `MatchDetails`: Extended match data (players, stats, timeline events)
- `Player`: Lineup players with position, number, pitch coordinates (pitchX/pitchY)
- `TimelineEvent`: Goal/substitution/card events with minute and player data
- `MatchStatistic`: Possession, shots, etc. with home/away values
- `H2HMatch`: Historical head-to-head match records
- `Standing` / `StandingGroup`: League standings and group stages
- `Scorer`: Top scorers with stats
- `ChannelInfo`: Broadcasting channel metadata

## Configuration & Deployment

### Vite Build Config
- **Code splitting**: Vendor (React/ReactDOM), UI icons, animations, video libraries
- **Minification**: Terser with console/debugger drop
- **CSS minification**: Enabled
- **Chunk size warning**: 1000KB limit
- **Alias**: `@/*` maps to project root

### Netlify Deployment
- Builds via Vite (`npm run build`)
- Redirects `/api/*` to backend (yallamatch.pages.dev)
- SPA fallback: `/*` → `/index.html` (for client-side routing)
- PWA manifest configured

### Environment Variables
- `GEMINI_API_KEY`: Defined in `.env.local` for AI features (referenced in README but not actively used in core features)
- Firebase config loaded from `firebase-applet-config.json`

## HTML Head (Performance)

- **Preconnect**: fonts.googleapis.com, fonts.gstatic.com, wsrv.nl, imagecache.365scores.com
- **Preload**: Tajawal Arabic font (woff2)
- **Defer**: hls.js, video.js scripts
- **Non-blocking CSS**: Fonts loaded with `media="print"` trick
- **Meta tags**: SEO, OG, Twitter cards, manifest link, theme color

## Important Implementation Notes

### Arabic Text Handling
- All text is RTL (`dir="rtl"` in HTML)
- Font stack: "Tajawal" (Arabic), "Inter", "Space Grotesk"
- Normalization cache limited to 2,000 entries to prevent memory bloat
- Diacritics and character variants standardized for matching

### Video Player Strategy
- Multiple player libraries for reliability: video.js → plyr → native HLS
- Component unmount cleanup critical: calls `player.dispose()` to prevent resource leaks
- HLS poster fallback if URL missing
- Supports multiple streaming protocols

### Error Handling
- Global error boundary in App.tsx catches React render errors
- Unhandled promise rejection suppression for expected errors (AbortError, network failures)
- Firestore errors logged but don't block cache operations
- Network errors gracefully fallback to empty states

### Linting Enforcement
- ESLint runs with max-warnings: 0 (zero-tolerance)
- Rules relaxed for: `no-explicit-any`, `no-unused-vars` (due to dynamic code patterns)
- React hooks recommended rules enforced

## Notes for Contributors

1. **Performance**: In-memory cache should be invalidated only when necessary (e.g., after user interaction). Avoid excessive re-renders by leveraging useRef in context.

2. **API Changes**: If external data sources change schema, update type definitions in `types.ts` and normalization logic in `api.ts`.

3. **Timezone Safety**: Always use `getMoroccanDateString()` for server dates. Test date boundary transitions (midnight UTC vs Morocco time).

4. **Firestore Costs**: Monitor cache hit rates via console logs. High miss rates indicate TTL tuning needed or external API reliability issues.

5. **Team Matching**: The fuzzy matching algorithm handles Arabic spelling variants but may need updates if new team names are added. Extend `TEAM_TRANSLATIONS` and test with `isFuzzyMatch()`.

6. **Accessibility**: Match detail view uses large click targets (>48px) for mobile. Verify color contrast for card status indicators (red/yellow cards).

7. **Bundle Analysis**: Vite splits video libs to separate chunk. Monitor `dist/` output size after changes to large dependencies.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
