# ComfyChat: Production-Grade Architecture & Phase 2 Plan

To ensure this project can be commercialized, sold, or deployed to the public securely, we are upgrading the architecture from a casual MVP to a **Production-Grade Ecosystem**. Security, networking, and synchronization will be engineered robustly from the ground up.

---

## 1. Enterprise WebRTC Voice Architecture (Zero-Cost & Scalable)

To support voice chat in both standard rooms and the Theater without incurring massive bandwidth costs, we use WebRTC. Here is how it handles different networks:

### A. Local Area Network (LAN)
If users are on the same Wi-Fi, WebRTC uses **Host Candidates** (or mDNS). The audio data travels directly from Device A to Device B over the local router. It does not require internet, and latency is near zero.

### B. Wide Area Network (Internet / Different Wi-Fi)
We use **STUN (Session Traversal Utilities for NAT)**. 
- We configure the app to hit `stun:stun.l.google.com:19302`. 
- The STUN server simply echoes back the user's public IP address. Once exchanged, the audio data travels directly between the users. **This is completely free and works for ~85% of standard internet users.**

### C. The Production Reality (Symmetric NATs & TURN)
In enterprise environments (corporate/university networks), strict firewalls block STUN. For these ~15% of users, P2P will fail. 
- **Production Design:** We will architect the frontend so that it expects an `iceServers` array from the Python backend upon login. 
- For now, the Python backend will serve the free STUN server. But when you are ready to commercialize, you simply update the Python server to provide paid **TURN server** credentials (e.g., Twilio or Metered) to fallback when STUN fails. *The frontend code will not need to change.*

---

## 2. Production Security Layer (JWT & Abstraction)

We cannot trust simple `userId` strings stored in `localStorage`, as malicious users can easily edit them to evade bans.

### Cryptographic Identity (JWT)
1. **First Connection:** When a user opens the app, the server generates a cryptographically signed **JSON Web Token (JWT)** containing a unique immutable ID and signs it with a secret key.
2. **Storage:** The browser stores this JWT. 
3. **Validation:** Every Socket.io connection must pass this JWT. The server verifies the signature. If a user modifies their JWT, the signature becomes invalid, and the socket is immediately rejected.
4. **Banning:** When a Mod bans a user, the server adds the immutable ID inside the JWT to the database. Even if the user uses a VPN, their JWT betrays them. If they clear their browser cache to get a new JWT, the secondary **IP Ban** catches them.

### Database Abstraction Pattern
We will build a `DatabaseRepository` interface.
- **Local Dev:** `SQLiteRepository` (Fast, offline, local testing).
- **Production:** `PostgresRepository` or `FirebaseRepository`.
You switch between them by changing a single `.env` variable (`DB_MODE=sqlite` vs `DB_MODE=postgres`).

---

## 3. Robust Theater Ecosystem (YouTube Sync)

Syncing YouTube videos across different internet speeds is complex because users buffer at different rates. We will not use a "dumb" client-to-client sync; we will use an Authoritative Server State.

### The State Machine
1. **Server Authority:** The Python server maintains the exact state of the Theater Room: `videoId`, `isPlaying`, `serverStartTime`, and `startOffset`.
2. **Buffering Grace:** When the Admin presses "Play", the server tells all clients to load the video and buffer. It waits 2 seconds, then broadcasts a "Sync Execution" command so all clients start playing at the exact same millisecond.
3. **Drift Correction:** Every 5 seconds, clients ping the server with their current playback time. If a client is lagging due to slow internet (drift > 2 seconds), the client's video is aggressively hard-seeked to match the server time.

### UI/UX Design
Instead of copying `syncVibe` wholesale, we will build a custom, highly-polished **Cinematic Mode**.
- The main chat slides away or becomes a translucent overlay.
- A 20-seat visual grid displays connected avatars.
- The YouTube IFrame dominates the screen with custom theater-lighting CSS effects behind it.

---

## 4. Execution Sub-Phases

### Phase 2A: Core Security & Database Layer
- Implement `DatabaseRepository` (SQLite for now, structured for Postgres/Firebase).
- Implement JWT generation, signing, and Socket.io authentication middleware.
- Build the persistent Ban System (JWT ID + IP).

### Phase 2B: Moderator & Admin Systems
- Build the `pedarayudu.html` SuperAdmin dashboard (protected by master password).
- Implement the "Server Master Switch" (On/Off override).
- Add the hidden "Mod Invite Code" in settings to elevate users to Moderators.
- Grant Mods the ability to Kick and Delete, logging all actions to the Database.

### Phase 2C: The Robust Theater Room
- Build the `theater.html` cinematic UI and ticketing logic (2-minute expiring URLs).
- Implement the Authoritative Server State machine for YouTube syncing.
- Implement the WebRTC audio integration for theater seats.
