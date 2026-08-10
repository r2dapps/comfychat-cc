# Hosting the Theater Server (Node.js)

The `theater_server.js` Node application acts as the backend for the Watch Party feature in ComfyChat. 
It can also act as a **unified real-time backend** for other apps like **yt-fy** and **Sunofy** simply by pointing their Socket.io clients to its hosted URL.

If you choose to host this on a PaaS (like Render, Heroku, or Railway), be aware of the following limitations and considerations:

### 1. In-Memory State Loss (The Biggest Limitation)
The server currently stores all room, queue, and seat data in an in-memory object (`const theaterRooms = {}`). 
If the cloud provider restarts your server (e.g., daily restarts on free tiers, or automated deployments), **all state is wiped** and users will be instantly disconnected. 
* **Solution for Production:** Consider moving state to a persistent database like Redis or Firebase.

### 2. YouTube IP Blocking (Rate Limiting)
The server scrapes YouTube directly using `yt-search` and custom HTML parsers to fetch videos and playlists. 
Because cloud hosting providers use shared IP addresses, YouTube might rate-limit or block the server's IP if it receives too many requests. This will cause search and playlist loading to fail.
* **Solution for Production:** Use official YouTube API keys or route scraper requests through rotating proxies.

### 3. Scaling to Multiple Instances
If you scale your server to multiple instances to handle heavy traffic, users on different instances won't be able to communicate or sync videos with each other.
* **Solution for Production:** You must configure `@socket.io/redis-adapter` so that Socket.io can broadcast events across all instances.

### 4. Cross-App Collisions
If you are using this single server for multiple apps (Sunofy, yt-fy, Theater), reusing the same room codes across different apps will cause event collisions.
* **Solution for Production:** Use **Socket.io Namespaces** (e.g., `io.of('/theater')`, `io.of('/sunofy')`) to create isolated channels for each application so they never interfere with each other.
