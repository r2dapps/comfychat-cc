# ComfyChat Phase 2: The Theater Microservice

Based on your vision of a true "Movie Lover's Theater," we will keep the Theater completely uncoupled as its own independent Node.js Microservice (`theater_server.js`). This guarantees you can plug it into *any* future app without relying on the Python chat server.

---

## 1. The True Theater UX & Workflow

We are shifting the UI to feel exactly like going to a real cinema, while preserving the ease of use of your existing tabs.

### Step 1: The Box Office (Ticketing)
- Users receive a direct link (`theater.html?ticket=movieNight`).
- They arrive at a "Lobby" screen. Here, they select their Avatar, Username, and Interests *before* they are allowed inside.
- If they want to Voice Chat, they must "Book a Seat" on the visual map before entering.

### Step 2: Entering the Cinema
- When they enter, they see a beautiful CSS Theater screen (dark ambient lighting, curtains framing the edges).
- The video player is strictly an embedded `iframe`. 
- **The Show Must Go On:** The server dictates the time. If a user joins 15 minutes late, their video instantly seeks to the 15-minute mark. The movie never stops for anyone.

### Step 3: Mobile-First Interaction
- We will keep your easy-to-use tab system (Seating, Queue, Request, Chat) at the bottom for mobile users.
- We will integrate the **Emoji Reaction Card** (the same full grid of emojis used in the global chat) into a collapsible floating menu specifically tailored for quick reactions during the movie (e.g., 🍿, 😱, 😂).

---

## 2. Theater Admin & Content Control

Since this is a standalone Node.js app, we will build its own dedicated Admin controls right into the Theater itself.

### The Projection Booth (Admin Panel)
- Only the user who generates the ticket is granted the Admin Token.
- **Queue Management:** Searching for a YouTube video will *no longer* play it instantly. Instead, it adds it to the **Up-Next Queue**.
- **The Countdown:** When the Admin is ready to start a movie, they hit "Start Show." A beautiful 10-second cinematic countdown timer appears for everyone in the room before the iframe loads and syncs perfectly.
- **Handling Ads:** Because YouTube iframes show ads, the Admin can use a "Force Sync" button if an ad throws everyone out of sync, instantly dragging all users back to the exact correct timestamp.

---

## 3. Hardening the Node.js Server

To make this Theater production-ready for your friends across the country:

1. **Replace `yt-search`:** We will swap this out for the official YouTube Data API (v3) so your Render server never gets IP blocked while searching.
2. **Persistent State (Firebase):** We will wire the Node.js server to Firebase RTDB. The current movie, the exact timestamp, and the Up-Next Queue will constantly save to Firebase. If your free Render server restarts, it automatically pulls the data and resumes the movie exactly where it left off!

---

## 4. Execution Phases

### Phase 2A: Node.js Security & State
- Implement Firebase RTDB in `theater_server.js` to save room state.
- Replace `yt-search` with the official YouTube Data API.

### Phase 2B: The True Theater UI/UX
- Rebuild `theater.html` with the Curtain/Lighting design and the Lobby Ticketing flow.
- Add the Cinematic Countdown Timer.
- Add the full Emoji Reaction collapsible card.

### Phase 2C: The Projection Booth
- Implement the "Add to Queue" (no instant play) logic.
- Perfect the Authoritative Server Sync machine to handle late-joiners and ad interruptions.
