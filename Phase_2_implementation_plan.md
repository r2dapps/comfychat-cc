# ComfyChat Phase 2: The Theater Microservice

Based on your vision of a true "Movie Lover's Theater," we will keep the Theater completely uncoupled as its own independent Node.js Microservice (`theater_server.js`). This guarantees you can plug it into *any* future app without relying on the Python chat server.

---

## 1. Supported Media Sources & DRM Reality

Before we build the syncing engine, we must define exactly what media sources are technically possible in a browser-based watch party.

### ✅ What WORKS perfectly (Iframe & HTML5)
- **YouTube, Vimeo, Dailymotion:** Any platform with an official Embed API works perfectly. We can sync `play`, `pause`, and `seek` accurately.
- **Direct `.mp4` URLs:** If you host a movie file on a cloud server (AWS S3, Google Drive direct link, etc.), we can sync a standard HTML5 `<video>` player perfectly.

### ❌ What DOES NOT work (Netflix, Prime, Hulu)
- **The DRM Blockade:** Netflix uses strict Digital Rights Management (Widevine) and blocks iframes. You **cannot** embed Netflix in your app, even if users log in with their credentials. 
- *Note:* Apps like "Teleparty" (formerly Netflix Party) only work because they are **Browser Extensions** that inject code directly into the Netflix website. Our app is a standalone website, so it cannot bypass DRM.

### ⚠️ Streaming a Downloaded Movie from your PC
- You cannot stream a local `.mp4` from your hard drive into an iframe for other people to watch. 
- **The Solution:** For this specific use case, we would need to implement a "Screen Share" WebRTC feature (like Discord), where you share your screen and stream the video directly to your friends. *We can plan this for Phase 3 if desired.*

---

## 2. The YouTube Strategy (API vs Login)

**Why we use the Server API instead of User Login:**
We want the absolute lowest friction for your friends. If we force them to log in to YouTube via OAuth just to watch a video, many will bounce.
- **Our Approach:** The Admin (You) provides a free **YouTube Data API v3 Key** to the Node.js server. The server handles all the searching and playlist fetching. 
- The users simply load the official YouTube Iframe Player (which YouTube provides for free). It feels 100% genuine and official, but requires absolutely zero login effort from your friends!

---

## 3. The True Theater UX & Workflow

### Step 1: The Box Office (Ticketing)
- Users receive a direct link (`theater.html?ticket=movieNight`).
- They arrive at a "Lobby" screen to select their Avatar, Username, and book a seat on the visual map *before* entering.

### Step 2: Entering the Cinema
- A beautiful CSS Theater screen (dark ambient lighting, curtains).
- **The Show Must Go On:** The server dictates the time. If a user joins 15 minutes late, their video instantly seeks to the 15-minute mark.

### Step 3: Mobile-First Interaction
- A collapsible **Emoji Reaction Card** (🍿, 😱, 😂) tailored for quick reactions during the movie.

---

## 4. Theater Admin & Content Control

### The Projection Booth (Admin Panel)
- **Queue Management:** Searching adds videos to the **Up-Next Queue** instead of playing instantly.
- **The Countdown:** When the Admin hits "Start Show," a 10-second cinematic countdown timer appears before the iframe loads and syncs perfectly.
- **Handling Ads:** The Admin can use a "Force Sync" button if an ad throws everyone out of sync.

---

## 5. Execution Phases

### Phase 2A: Node.js Security & State
- Implement Firebase RTDB in `theater_server.js` to save room state.
- Integrate the official YouTube Data API.

### Phase 2B: The True Theater UI/UX
- Rebuild `theater.html` with the Curtain/Lighting design and the Lobby Ticketing flow.
- Add the Cinematic Countdown Timer and Emoji Reaction Card.

### Phase 2C: The Projection Booth
- Implement the "Add to Queue" logic.
- Perfect the Authoritative Server Sync machine.
