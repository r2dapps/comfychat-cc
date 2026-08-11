# ComfyChat Phase 2: The Complete Ecosystem Plan

To ensure we do not lose track of the core `comfyChat-cc` project while building the Theater, this plan covers the **entire ecosystem**. We are building a robust, dual-backend microservices architecture that can scale infinitely on free cloud tiers or run flawlessly on a single local PC.

---

## 1. Hosting Architecture Strategies

You proposed a brilliant strategy to stay on the free tier forever. We will design the code to support two distinct hosting environments:

### A. The "Forever Free" Split-Cloud Strategy
To prevent exceeding CPU/RAM limits on free platforms (like Render), we will deploy the two services completely separately:
- **Server 1 (Python Chat Backend):** Hosted on Render Account A (or Heroku). Handles World Chat, DMs, WebRTC signaling, and the `pedarayudu.html` Admin controls.
- **Server 2 (Node.js Theater Backend):** Hosted on Render Account B (or Railway/Vercel). Dedicated entirely to YouTube scraping (via Innertube API), queue management, and video state syncing.
- **The Bridge:** Both servers connect to the same **Firebase RTDB**. This acts as the central brain. If you ban a user via `pedarayudu.html` on Server 1, the Firebase database instantly notifies Server 2 to kick them from the Theater.

### B. The "Dedicated Local PC" Strategy
When you want maximum performance without cloud limits, you can host the entire ecosystem from your laptop or a dedicated PC at home.
- You simply run both `python server.py` (Port 5000) and `node theater_server.js` (Port 5001) simultaneously on your PC.
- You map your router's port forwarding to your PC, or use a tool like Ngrok/Cloudflare Tunnels. 
- You still use Firebase RTDB as the database, ensuring your bans and admin logs persist even if you shut your PC down for the night.

---

## 2. Core Comfy-Chat (`pedarayudu.html`) Administration

We will build the core SuperAdmin dashboard on the Python backend.

### The "Pedarayudu" Dashboard
- A hidden frontend interface strictly for you.
- **Server Active Status:** A manual `[ON / OFF]` toggle. When switched OFF, the app blocks all new connections and kicks current users from *both* the chat and the theater.
- **Persistent Device Banning:** Implements IP Ban + local `localStorage` Ban token to ensure users cannot simply bypass the block with a VPN.
- **Moderator Logs:** View activity logs of on-ground moderators (who kick/delete messages in chat).

---

## 3. The Node.js Theater Microservice

### Supported Media Sources
- **Official Iframes:** YouTube (via keyless `youtubei.js`), Vimeo, Dailymotion, Twitch.
- **Cloud Media:** Direct `.mp4` URLs and Google Drive videos synced via HTML5 `<video>`.
- **2GB+ Local Files:** Synced via WebTorrent (P2P seeding) or the "Bring Your Own File" local-selection method (zero bandwidth).

### Admin vs. Member Roles (Clean Structure)
1. **The Admin (Projectionist):** The room creator receives an **Admin JWT**. They control the "Projection Booth" (Add to Queue, Start Show Countdown, Force Sync).
2. **The Members (Audience):** Users clicking the ticket link receive a **Guest JWT**. They can chat and react (🍿, 😱) but can only *request* videos for the Admin to approve.

### The True Theater UX
- **Box Office:** A Lobby to pick an avatar and book a seat before entering.
- **Cinematic UI:** Dark ambient lighting, curtains, and an embedded iframe with collapsible side panels.
- **PWA:** A `manifest.json` allows users to install the Theater/Chat as a native Android app.

---

## 4. Execution Roadmap

We will build the Core Chat Admin first, then bridge the Theater.

### Phase 2A: The Python Core & Pedarayudu
- Implement Firebase RTDB connection in `server.py`.
- Generate Admin/Guest JWTs.
- Build the `pedarayudu.html` SuperAdmin Ban system and Master Switch.

### Phase 2B: Node.js Security & The Theater Bridge
- Wire `theater_server.js` to the same Firebase RTDB.
- Implement JWT verification so the Theater respects Python's bans.
- Replace `yt-search` with `youtubei.js` for keyless scraping.

### Phase 2C: The True Theater UI/UX
- Rebuild `theater.html` with the Box Office Lobby and Cinematic countdown.
- Implement the "Add to Queue" strict Projection Booth controls.
- Finalize PWA capabilities.
