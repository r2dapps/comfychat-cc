const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const ytSearch = require('yt-search');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// theater_rooms[room_code] = { admin_sid, queue, video_id, is_playing, current_time }
const theaterRooms = {};

io.on('connection', (socket) => {
    console.log(`[Theater] Connect: ${socket.id}`);

    socket.on('join_theater', (data) => {
        const username = data.username || 'Anonymous';
        const roomCode = data.room || 'default';
        
        socket.join(roomCode);
        
        // Initialize room if not exists
        if (!theaterRooms[roomCode]) {
            theaterRooms[roomCode] = {
                admin_sid: socket.id,
                queue: [],
                video_id: 'aqz-KE-bpKQ',
                is_playing: false,
                current_time: 0
            };
            console.log(`[Theater] Room ${roomCode} created by ${socket.id}`);
        }
        // python bug fix:
        theaterRooms[roomCode].is_playing = theaterRooms[roomCode].is_playing === true;

        const roomState = theaterRooms[roomCode];
        const isAdmin = (roomState.admin_sid === socket.id);
        
        socket.emit('theater_admin_status', { is_admin: isAdmin });
        socket.emit('theater_state_sync', {
            video_id: roomState.video_id,
            is_playing: roomState.is_playing,
            current_time: roomState.current_time
        });
        socket.emit('theater_queue_update', roomState.queue);
        
        const welcomeMsg = isAdmin 
            ? `Welcome Admin ${username}! You control the theater.`
            : `Welcome ${username}! You are watching in view-only mode.`;
            
        socket.emit('theater_chat', { sender: 'System', text: welcomeMsg, isSystem: true });
        
        // Save user context
        socket.data = { room: roomCode, username: username, is_admin: isAdmin };
    });

    socket.on('theater_command', async (data) => {
        const roomCode = socket.data?.room;
        if (!roomCode) return;
        
        const roomState = theaterRooms[roomCode];
        if (!roomState || roomState.admin_sid !== socket.id) return; // Only admin
        
        const cmd = data.command;
        console.log(`[Theater] Command from ${socket.id} in ${roomCode}:`, cmd, data);
        
        if (cmd === 'load_video') {
            roomState.video_id = data.video_id;
            roomState.is_playing = true;
            roomState.current_time = 0;
            io.to(roomCode).emit('theater_action', { action: 'load', video_id: data.video_id });
        } 
        else if (cmd === 'play') {
            roomState.is_playing = true;
            roomState.current_time = data.time || 0;
            io.to(roomCode).emit('theater_action', { action: 'play', time: roomState.current_time });
        } 
        else if (cmd === 'pause') {
            roomState.is_playing = false;
            roomState.current_time = data.time || 0;
            io.to(roomCode).emit('theater_action', { action: 'pause', time: roomState.current_time });
        } 
        else if (cmd === 'seek') {
            roomState.current_time = data.time || 0;
            io.to(roomCode).emit('theater_action', { action: 'seek', time: roomState.current_time });
        }
        else if (cmd === 'search_youtube') {
            const query = data.query || '';
            if (!query) return;
            
            try {
                const r = await ytSearch(query);
                
                const videos = (r.videos || []).slice(0, 10).map(v => ({
                    id: v.videoId,
                    title: v.title,
                    thumbnail: v.thumbnail,
                    duration: v.timestamp || '0:00',
                    channel: v.author?.name || 'Unknown',
                    type: 'video'
                }));
                
                const playlists = (r.lists || []).slice(0, 5).map(p => ({
                    id: p.listId,
                    title: p.title,
                    thumbnail: p.thumbnail,
                    duration: `${p.videoCount} videos`,
                    channel: p.author?.name || 'Unknown',
                    type: 'playlist'
                }));
                
                socket.emit('theater_search_results', [...videos, ...playlists]);
            } catch (err) {
                console.error("Search error:", err);
                socket.emit('theater_search_results', []);
            }
        }
        else if (cmd === 'load_playlist') {
            const playlistId = data.playlist_id;
            if (!playlistId) return;
            
            try {
                const list = await ytSearch({ listId: playlistId });
                if (list && list.videos && list.videos.length > 0) {
                    const first20 = list.videos.slice(0, 20);
                    
                    for (const v of first20) {
                        roomState.queue.push({
                            id: v.videoId,
                            title: v.title,
                            thumbnail: v.thumbnail,
                            channel: v.author?.name || 'Unknown'
                        });
                    }
                    
                    // Load first video immediately
                    const firstVideo = roomState.queue.shift();
                    roomState.video_id = firstVideo.id;
                    roomState.is_playing = true;
                    roomState.current_time = 0;
                    
                    io.to(roomCode).emit('theater_action', { action: 'load', video_id: roomState.video_id });
                    io.to(roomCode).emit('theater_queue_update', roomState.queue);
                }
            } catch (err) {
                console.error("Playlist load error:", err);
            }
        }
    });

    socket.on('theater_chat_msg', (data) => {
        const roomCode = socket.data?.room;
        if (!roomCode) return;
        
        socket.to(roomCode).emit('theater_chat', {
            sender: data.sender || 'Anonymous',
            text: data.text || ''
        });
    });

    socket.on('disconnect', () => {
        console.log(`[Theater] Disconnect: ${socket.id}`);
        // Optional: Assign new admin if old admin leaves
    });
});

const PORT = 5001;
server.listen(PORT, () => {
    console.log(`Theater Server (Node.js) listening on port ${PORT}`);
});
