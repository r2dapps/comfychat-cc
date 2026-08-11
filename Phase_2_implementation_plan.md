# ComfyChat Phase 2: The Theater Microservice

Based on your vision of a true "Movie Lover's Theater," we will keep the Theater completely uncoupled as its own independent Node.js Microservice (`theater_server.js`). This guarantees you can plug it into *any* future app without relying on the Python chat server.

---

## 1. Supported Media Sources & Solutions

You raised excellent points about YouTube API keys and local file streaming. Here is how we will solve them:

### A. Keyless YouTube Scraping
You asked if there is a way to NOT use a YouTube v3 API key. **Yes!**
- Instead of using `yt-search` (which gets IP blocked), we will use `youtubei.js` (Innertube API). 
- This library perfectly mimics the official YouTube web client. It bypasses the need for an API key completely and is much more resilient against IP blocking on cloud servers!

### B. Streaming Large Local Files (The 2GB Sunofy Method)
If you want to stream a 2GB downloaded movie from your PC to your friends without a cloud server, we have two options:
1. **The WebTorrent Method:** You select the 2GB file on your PC. Your browser instantly starts "seeding" it directly to your friends' browsers via WebRTC. As long as your upload speed is good, they will stream it directly from you.
2. **The "Bring Your Own File" Method:** You tell your friends to download the exact same 2GB movie file. Everyone selects the file locally on their own PC. The server simply syncs the `play`/`pause`/`seek` commands, meaning zero bandwidth is used!
*We will implement the HTML5 `<video>` tag to support this local file syncing.*

---

## 2. The True Theater UX & Workflow

### Step 1: The Box Office (Ticketing)
- Users receive a direct link (`theater.html?ticket=movieNight`).
- They arrive at a "Lobby" screen to select their Avatar, Username, and book a seat on the visual map *before* entering.

### Step 2: Entering the Cinema
- A beautiful CSS Theater screen (dark ambient lighting, curtains).
- **The Show Must Go On:** The server dictates the time. If a user joins 15 minutes late, their video instantly seeks to the 15-minute mark.

### Step 3: Mobile-First Interaction & PWA
- A collapsible **Emoji Reaction Card** (🍿, 😱, 😂) tailored for quick reactions during the movie.
- **PWA Ready:** In the final stage, we will add a `manifest.json` and a Service Worker. This will turn ComfyChat into a **Progressive Web App (PWA)**, allowing users to install it on their home screens like a native app. We can easily convert this PWA into an Android `.apk` later!

---

## 3. Theater Admin & Content Control

### The Projection Booth (Admin Panel)
- **Queue Management:** Searching adds videos to the **Up-Next Queue** instead of playing instantly.
- **The Countdown:** When the Admin hits "Start Show," a 10-second cinematic countdown timer appears before the iframe loads and syncs perfectly.
- **Handling Ads:** The Admin can use a "Force Sync" button if an ad throws everyone out of sync.

---

## 4. Execution Phases

### Phase 2A: Node.js Security & State
- Implement Firebase RTDB in `theater_server.js` to save room state.
- Swap `yt-search` for `youtubei.js` for keyless YouTube searching.

### Phase 2B: The True Theater UI/UX
- Rebuild `theater.html` with the Curtain/Lighting design and the Lobby Ticketing flow.
- Add the Cinematic Countdown Timer and Emoji Reaction Card.

### Phase 2C: The Projection Booth & Advanced Media
- Implement the "Add to Queue" logic and Authoritative Server Sync machine.
- Add support for syncing Local File selections (HTML5 Video).
- Finalize PWA (`manifest.json`) structure for future APK conversion.
