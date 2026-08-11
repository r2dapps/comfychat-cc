# ComfyChat Phase 2: The Theater Microservice

This document outlines the final, robust architecture for the Node.js Theater Microservice. It is designed to be a standalone, plug-and-play module with strict Admin controls and massive media support.

---

## 1. Supported Media Sources

We are engineering the Theater to support the maximum amount of media possible without violating DRM restrictions. 

### ✅ Official Iframe Support (Synced via Iframe APIs)
- **YouTube:** Native support with zero API keys required.
- **Vimeo:** Official player embedding.
- **Dailymotion:** Official player embedding.
- **Twitch:** Live streams and VODs.

### ✅ Direct Cloud Media (Synced via HTML5 `<video>`)
- **Direct `.mp4` / `.webm` URLs:** Any direct video link hosted on AWS, Cloudinary, etc.
- **Google Drive Videos:** Using the Google Drive direct-download link trick, we can stream Drive videos straight into the HTML5 player!

### ✅ Huge Local Files (2GB+ Movies)
- **WebTorrent Sync:** You select a 2GB movie on your PC. Your browser "seeds" it to your friends via WebRTC data channels. They stream it directly from you without any cloud servers involved.
- **Bring-Your-Own-File:** Everyone downloads the exact same 2GB movie file beforehand. Everyone selects the file locally on their own PC. The server simply syncs the timestamps (`play`/`pause`/`seek`), using zero bandwidth!

*(Note: Netflix, Prime Video, and Hulu are strictly blocked by DRM and cannot be embedded in this app).*

---

## 2. Admin vs. Member Roles (Clean Structure)

We must define strict boundaries between who controls the theater and who watches.

### How Roles are Defined
1. **The Admin (Projectionist):** The user who clicks "Generate Ticket" in the Box Office Lobby is officially the **Room Creator**. 
   - The Node.js server generates an **Admin Token (JWT)** for this specific user. 
   - Only a browser holding this Admin Token will render the "Projection Booth" controls.
2. **The Members (Audience):** When the Admin shares the ticket link with friends, those friends join as Members.
   - They receive a **Guest Token**. 
   - They can chat, react with emojis, and book seats for voice chat, but they *cannot* control the movie.

### The Projection Booth (Admin Powers)
The Admin has exclusive access to a hidden control panel below the video:
- **Search & Add to Queue:** The Admin can search for videos or paste URLs.
- **Start Show:** Initiates the 10-second cinematic countdown timer for everyone.
- **Force Sync:** If a user gets an ad or their internet lags, the Admin clicks this to instantly drag all members to the correct timestamp.
- **Kick Member:** The Admin can boot disruptive users from the theater.

### Member Powers
- **Request a Song/Movie:** Members can search for videos, but clicking them does *not* add them to the queue. It sends a "Request" to the Admin, who can approve or deny it.

---

## 3. The Search Engine (youtubei.js)

You asked to make sure the keyless search is legit and handles huge playlists like your `Sunofy` local mode.
- **What is it?** We will use `youtubei.js` (The Innertube API). 
- **Is it legit?** Yes. This is the exact internal API that the official YouTube Web Client and YouTube Music app use. It does not scrape HTML (which is what gets you IP-blocked). It talks directly to YouTube's internal JSON endpoints.
- **Capabilities:** It can instantly pull massive 100+ track playlists, full channel uploads, and high-quality search results without ever needing an API key. It is the most robust keyless solution available.

---

## 4. Execution Phases

### Phase 2A: Node.js Security & Roles
- Implement the Admin Token (JWT) vs Guest Token generation in `theater_server.js`.
- Integrate `youtubei.js` for massive, keyless playlist/search fetching.
- Wire up Firebase RTDB to save the Room State persistently.

### Phase 2B: The True Theater UI/UX
- Build the "Lobby" for ticketing and seat booking.
- Build the "Cinematic UI" (dark ambient lighting, curtains, embedded iframe).
- Add the collapsible Emoji Reaction Card (🍿, 😱, 😂).

### Phase 2C: The Projection Booth & Advanced Media
- Build the strict Admin controls (Add to Queue, Force Sync, Approve Requests).
- Implement HTML5 `<video>` syncing for Google Drive and Local Files.
- Wrap the app in a PWA `manifest.json` for future Android APK conversion.
