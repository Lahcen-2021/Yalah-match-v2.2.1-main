# Product Requirements Document (PRD) / وثيقة متطلبات المنتج

## Project Name: يلا ماتش - Yalla Match (Remix V2.2.1)
**Project Subtitle:** Exclusive TV Guide, Live Ticker, and Match Coverage Hub (كأس إفريقيا لأقل من 17 سنة – المغرب 2026)
**Date:** May 2026

---

## 1. Executive Summary & Core Value Proposition / الملخص التنفيذي وتقديم المشروع

**يلا ماتش (Yalla Match)** is a modern, responsive, high-fidelity Arabic football companion application designed to deliver real-time football schedules, live match updates, commentator rosters, team lineups, and high-performance streaming channels. 

The application is specifically optimized for localized sport events—specifically holding exclusive, tailored coverage for the **CAF U-17 African Cup of Nations (كأس إفريقيا لأقل من 17 سنة – المغرب 2026)** hosted in Morocco.

### Core Value Proposition:
1. **Hyper-Localized Focus:** Complete, localized Arabic translations for teams, leagues, and sports details alongside explicit coverage for youth continental cups.
2. **Speed-First Architecture:** Persistent Firestore caching coupled with in-memory retention to scale rendering speeds, bypass scraping bottlenecks, and guarantee sub-second page transition times.
3. **Advanced Interactive UI:** Dynamic match-detail view equipped with live statistics visual meters, interactive football pitches for starter lineups with custom overlays, vertical timeline logs, and a unified stream viewer.

---

## 2. Product Architecture & Technical Stack / البنية التقنية للمشروع

The platform utilizes a modern full-stack decoupled architecture tailored for lightweight execution, real-time sync, and extreme caching efficiency.

```
       ┌────────────────────────┐
       │   React SPA Client     │
       │ (Vite + TS + Tailwind) │
       └───────────┬────────────┘
                   │ HTTPS API Requests
                   ▼
       ┌────────────────────────┐      In-Memory Cache (Short)
       │ Express Node.js Server │ ◄───────────────────────────┐
       │ (esbuild bundled .cjs) │                             │
       └───────────┬────────────┘                             │
                   │                                          │
                   ├──────────────────► [Firebase Firestore] ─┘
                   │                    Persistent Cache Collection
                   │                    - matches_YYYY-MM-DD (15s/1h TTL)
                   │                    - details_ID (30s TTL)
                   │                    - kooora_YYYY-MM-DD (KOOORA_TTL)
                   │
                   ▼ Data Harvesting
       ┌────────────────────────┐
       │     External APIs      │
       │ & Cheerio Web Scrapers │
       └────────────────────────┘
```

### Client-Side Technologies:
* **Frontend Library:** React (v19) utilizing functional components, custom hooks, and React Context (`CacheContext`) for memory optimization.
* **Styling Framework:** Tailwind CSS (v4) with `@tailwindcss/vite` configuration, yielding clean display typography, rich dark layouts, and custom interactive panels.
* **Animations:** Framer Motion / Motion for elegant micro-interactions, spring animations on active tab state changes, and slide overlays.
* **Icons:** `lucide-react` for standard UI symbols.
* **Video Playback:** Native HLS supporting `video.js`, `plyr`, and `hls.js` for custom live sports broadcasting, player-disposal management, and poster loading.

### Server-Side & Middleware:
* **Runtime:** Node.js Express server running fully decoupled backend API routers proxying queries and running background scrape workloads.
* **Production Build System:** Bundled via `esbuild` down to a single compact file (`dist/server.cjs`) to evade runtime relative path resolution overheads in production container environments (Cloud Run).
* **Data Scraper:** Cheerio library used to parse online real-time HTML feeds (Kooora channels schedule, commentator details, live TV grids) and normalize results with robust translation arrays.

### Database & High Performance Persistence:
* **Engine:** Firebase Firestore database instances securely governed by `firestore.rules`.
* **Path:** `/cache/{cacheId}` mapping unique IDs representing date indices or match detail keys.
* **Rules Blueprint:** Restricts malicious deletions or global modifications, allowing seamless public reads while validating structural integrity on creations/updates:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /cache/{cacheId} {
        allow read: if true;
        allow create, update: if isValidId(cacheId) && isValidCache(request.resource.data);
        allow delete: if false;
      }
    }
  }
  ```

---

## 3. Detailed Operational Features / تفاصيل الميزات التشغيلية والوظيفية

### 3.1. Main Schedule Workspace & Time-Zone Mapping
* **Dynamic Date Triad:** Quick-tabs allowing single-tap navigation between **Yesterday (أمس)**, **Today (اليوم)**, and **Tomorrow (غداً)**.
* **Time Sync Core:** Computes automatic offset differences (`serverTimeOffset`) between the user's localized browser runtime timezone (detected dynamically, falling back to Casa, Morocco) and the master server API dates to eliminate scheduling sync issues.
* **League Filters & Dynamic Sorting:** Advanced sorting where official competitions have higher layout priority scoring, followed by localized youth tournaments.
* **Fuzzy Arabic Normalization:** Back-to-back team name matching using specialized text processing filters to match Arabic spelling differences (replacing `ة` with `ه`, normalizing `أ إ آ` to `ا`, stripping harakat, etc.).

### 3.2. CAF U-17 AFCON Morocco Tournament Portal
* **Standings View:** Clean dynamic tables showing Played, Won, Draw, Lost, Points, Goal Difference, and Team Form.
* **Groups Segment:** Clean Group-by-Group division layouts, highlighting progress margins.
* **Top Scorers Lists:** Ranks of players with dynamic images and goals/assists ratios.

### 3.3. Advanced Match Ticker & Live Banner
* **Floating Live Indicator:** Dynamic flashing green counters for ongoing matches with instant minutes tracking.
* **Alarms & Event Notifications:** HTML5 Web Notification integration to subscribe to live alarms, pinging the user on matches starting or score updates.
* **Compact Info Strip:** Instant access to commentator name, broadcasting channel, and current match score on top banner.

### 3.4. Refined Match Detail Overlay (نافذة تفاصيل اللقاء)
A comprehensive dynamic screen accessible upon tapping any match card:
* **Info Header:** Elegant representation of Stadium, Referee, Match Commentator, and active Channel. Includes verified Arabic translation mappers and fallback visual posters representing illuminated stadiums.
* **Live Statistics:** Custom comparative graphics of Possession Percentage, Shots on Target, Goal attempts, and relative technical parameters.
* **Interactive Pitch Lineup (تشكيلة الفريقين):** 
  * A full-scale soccer playground layout visual.
  * Dynamically positions home/away starters over a stylized field using grid coordinates (`pitchX` and `pitchY`).
  * Interactive tooltips displaying player statistics (goals, assists, defensive rankings).
  * Reserves & coach segment showing bench arrangements and coach pictures.
* **Live Event Timeline (شريط أحداث المباراة):** Vertical unified stream logging milestones on specific minute intervals: Goals (soccer balls), substitutions (swapping arrows), yellow cards, red cards, and penalty shootouts logs.
* **Historical Team Form (H2H):** Match-ups tracking the five historical previous scores between both teams to help with game predictions.

### 3.5. Multi-Player Live Streaming Hub (البث المباشر والقنوات الرياضية)
* **High Reliability Player Strategy:** Configures dynamic switching between **Video.js**, **Plyr**, and raw native **HLS**.
* **Auto-Recovery Loop:** Component unmount event listeners guaranteeing complete player.dispose() streams terminations, preventing audio ghosts or resource leakages.
* **Poster Configuration:** Fallback placeholder assets if stream poster links are missing.
* **Broadcasting Directory:** Comprehensive search segment detailing channel lists (TOD, Starzplay, Arryadia, Abu Dhabi Sports 1 & 2, Al Kass, SSC, BeIN Sports MAX) mapping modern logos (`wsrv.nl` optimized WebP formats) for absolute visual fidelity.

---

## 4. User Interface, Experience & Design Language / واجهة المستخدم وتجربة الاستخدام

The application adopts a high-contrast, premium dark/hybrid theme engineered to simulate an interactive television screen.

### Key Visual Directives:
* **Background Canvas:** Soft deep matte-dark and slate backgrounds accompanied by premium off-white modules, minimizing eye fatigue during nighttime sports viewing.
* **Aesthetic Pairings:** Bold "Inter" / "Space Grotesk" typography paired with specialized monospaced fonts ("JetBrains Mono") for precise numerical time structures, goal counts, and statistics indicators.
* **Micro-Interactions (Framer Motion):** Smooth spring-loaded slide entries, subtle hover scales on active widgets, and soft opacity crossfades during transition to stream player viewports.
* **Accessibility Controls:** Sizable click elements (>48px target height on mobile), easily distinguishable color codes for red/yellow cards, and clear contrast ratios on text details.

---

## 5. Caching & Performance Metrics / نظام التخزين المؤقت والأداء

```
┌─────────────────┬─────────────────┬─────────────────────────────┐
│ Data Layer      │ In-Memory TTL   │ Firestore Persistent TTL    │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Live Matches    │ 10 Seconds      │ 15 Seconds                  │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Match History   │ 10 Minutes      │ 1 Hour                      │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Match Details   │ 15 Seconds      │ 30 Seconds                  │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Kooora Channels │ 1 Hour          │ 4 Hours (KOOORA_CACHE_TTL)  │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ LiveOnSat EPG   │ 15 Minutes      │ 1 Hour                      │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

By nesting high-frequency volatile states (Live scores) in immediate memory buffers while pushing structured JSON schemas to Firebase Firestore, Yalla Match achieves **95%+ caching efficiencies**, lowering host network traffic on scrapers and establishing robust fail-safe states if third-party providers suffer temporary outages.

---

## 6. Future Development & Roadmap / خارطة الطريق والتطوير المستقبلي

1. **AI Match Predictions:** Powering Gemini models to evaluate historical matchups (H2H), squad standings, and team forms to estimate likely wins and goals spreads.
2. **Native iOS/Android Handsets:** Native wrapper integrations with localized widget alerts on key lock screens.
3. **Interactive Football Fan Chats:** Real-time channels dedicated to specific tournaments or events, allowing fans to share their thoughts and stream reactions.
4. **Subscription and VIP Alert Packages:** Allowing push categories via messaging triggers (WhatsApp/Telegram API webhooks).

---

## 7. Quality Assurance Checklist (QA) / جدول التحقق من الجودة والجاهزية

- [x] **Universal Responsive Layouts:** Tested scaling from narrow mobile viewpoints (320px) up to ultra-desktop panels (1440px+).
- [x] **Secure Database Connectivity:** Document queries validated with strict safety constraints (`firestore.rules`).
- [x] **Player Memory Management:** Multi-disposal hooks verified to prevent browser memory bloat and media pipeline jams.
- [x] **Robust Search Normalization:** Full tolerance on Arabic keyboard varieties, allowing unified queries.
- [x] **Linter Compliance:** 0 parser warnings or ESLint syntax exceptions.
