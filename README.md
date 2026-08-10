# ComfyChat

A modern, responsive, WebRTC and Socket.IO based web chat application.

## Features

- **Global & Tech Channels:** Participate in real-time group chats.
- **P2P Direct Messaging:** Chat directly with other users via secure WebRTC connections.
- **Voice Calling:** Direct one-on-one audio calling built on WebRTC and PeerJS.
- **Rich Chat Experience:** 
  - Dynamic user-customizable chat bubble colors.
  - Emojis, Replies, Message Editing, and Deletion.
  - Reactions support.
  - Typing indicators.
- **Responsive Design:** 
  - Desktop: Sidebar navigation and main chat window.
  - Mobile: Clean overlaid UI with touch-friendly navigation.
- **Content Filtering (PG-13):** Built-in censorship for foul language, links, and emails.
- **Customizable Themes:** Switch between sleek Day and Night modes.
- **Push Toasts & Notifications:** Interactive toast pop-ups and a dedicated notification center (with sound toggles).

## File Structure

The project has been separated into a clean standard structure:

```
/comfyChat-cc
│
├── index.html       # The main entry HTML file.
├── server.py        # The Python Flask + Socket.IO server.
├── css/
│   └── styles.css   # All CSS styling including Day/Night themes.
└── js/
    └── app.js       # The client-side application logic (WebRTC, Socket).
```

## How to Run

### Requirements
- Python 3.7+
- `flask`
- `flask-socketio`
- `eventlet`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/r2dapps/comfychat-cc.git
   cd comfychat-cc
   ```

2. Install backend dependencies:
   ```bash
   pip install flask flask-socketio eventlet
   ```

3. Start the server:
   ```bash
   python server.py
   ```

4. Open your browser:
   Visit `http://localhost:5000` to start chatting!

## Technologies Used
- HTML5, CSS3, Vanilla JavaScript (ES6)
- [Socket.IO](https://socket.io/) (for signaling and group channels)
- [PeerJS](https://peerjs.com/) (WebRTC wrapper for direct messaging & voice calls)
- [Emoji Picker Element](https://github.com/nolanlawson/emoji-picker-element)
- Python / Flask (Backend Server)
