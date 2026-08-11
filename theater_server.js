const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { Innertube } = require('youtubei.js');

const SECRET_KEY = "SUPER_SECRET_COMFY_KEY_123";
const db = new sqlite3.Database(path.join(__dirname, 'comfychat.db'));

let yt;
Innertube.create().then(instance => {
    yt = instance;
    console.log('[Theater] Innertube API initialized');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS theater_state (
        room_code TEXT PRIMARY KEY,
        state_json TEXT
    )`);
});

function saveRoomState(roomCode) {
    if (theaterRooms[roomCode]) {
        db.run('INSERT OR REPLACE INTO theater_state (room_code, state_json) VALUES (?, ?)', 
            [roomCode, JSON.stringify(theaterRooms[roomCode])]);
    }
}



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

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.user_id = decoded.user_id;
        socket.role = decoded.role;
        
        const ip = socket.handshake.address;
        db.get('SELECT * FROM banned_users WHERE user_id = ? OR ip_address = ?', [socket.user_id, ip], (err, row) => {
            if (row) return next(new Error('Banned'));
            next();
        });
    });
});

io.on('connection', (socket) => {
    console.log(`[Theater] Connect: ${socket.id}`);

    socket.on('join_theater', (data) => {
        const username = data.username || 'Anonymous';
        const roomCode = data.room || 'default';
        
        socket.join(roomCode);
        
        const finishJoin = () => {
            theaterRooms[roomCode].is_playing = theaterRooms[roomCode].is_playing === true;

            const roomState = theaterRooms[roomCode];
            const isAdmin = (roomState.admin_sid === socket.id) || (socket.role === 'moderator');
            
            if (isAdmin) roomState.admin_sid = socket.id; // claim admin
            
            socket.emit('theater_admin_status', { is_admin: isAdmin });
            socket.emit('theater_state_sync', {
                video_id: roomState.video_id,
                is_playing: roomState.is_playing,
                current_time: roomState.current_time
            });
            socket.emit('theater_queue_update', roomState.queue);
            socket.emit('theater_seats_sync', roomState.seats);
            
            const welcomeMsg = isAdmin 
                ? `Welcome Admin ${username}! You control the theater.`
                : `Welcome ${username}! You are watching in view-only mode.`;
                
            socket.emit('theater_chat', { sender: 'System', text: welcomeMsg, isSystem: true });
            
            socket.data = { room: roomCode, username: username, is_admin: isAdmin };
        };

        if (!theaterRooms[roomCode]) {
            db.get('SELECT state_json FROM theater_state WHERE room_code = ?', [roomCode], (err, row) => {
                if (row && row.state_json) {
                    theaterRooms[roomCode] = JSON.parse(row.state_json);
                    theaterRooms[roomCode].admin_sid = socket.id; // Default new admin
                } else {
                    theaterRooms[roomCode] = {
                        admin_sid: socket.id,
                        queue: [],
                        seats: {}, 
                        video_id: 'aqz-KE-bpKQ',
                        is_playing: false,
                        current_time: 0
                    };
                }
                finishJoin();
            });
        } else {
            finishJoin();
        }
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
            saveRoomState(roomCode);
        } 
        else if (cmd === 'play') {
            roomState.is_playing = true;
            roomState.current_time = data.time || 0;
            io.to(roomCode).emit('theater_action', { action: 'play', time: roomState.current_time });
            saveRoomState(roomCode);
        } 
        else if (cmd === 'pause') {
            roomState.is_playing = false;
            roomState.current_time = data.time || 0;
            io.to(roomCode).emit('theater_action', { action: 'pause', time: roomState.current_time });
            saveRoomState(roomCode);
        } 
        else if (cmd === 'seek') {
            roomState.current_time = data.time || 0;
            io.to(roomCode).emit('theater_action', { action: 'seek', time: roomState.current_time });
            saveRoomState(roomCode);
        }
        else if (cmd === 'search_youtube') {
            const query = data.query || '';
            if (!query || !yt) return;
            
            try {
                const results = await yt.search(query);
                
                const videos = results.results.filter(v => v.type === 'Video').slice(0, 10).map(v => ({
                    id: v.id,
                    title: v.title.text,
                    thumbnail: v.best_thumbnail ? v.best_thumbnail.url : '',
                    duration: v.duration.text || '0:00',
                    channel: v.author.name || 'Unknown',
                    type: 'video'
                }));
                
                const playlists = results.results.filter(v => v.type === 'Playlist').slice(0, 5).map(p => ({
                    id: p.id,
                    title: p.title.text,
                    thumbnail: p.first_video && p.first_video.thumbnails ? p.first_video.thumbnails[0].url : '',
                    duration: p.video_count.text || 'Unknown',
                    channel: p.author.name || 'Unknown',
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
            if (!playlistId || !yt) return;
            
            try {
                const list = await yt.getPlaylist(playlistId);
                
                if (list && list.videos && list.videos.length > 0) {
                    const first20 = list.videos.slice(0, 20);
                    
                    for (const v of first20) {
                        roomState.queue.push({
                            id: v.id,
                            title: v.title.text,
                            thumbnail: v.best_thumbnail ? v.best_thumbnail.url : (v.thumbnails && v.thumbnails.length > 0 ? v.thumbnails[0].url : ''),
                            channel: v.author.name || 'Unknown'
                        });
                    }
                    
                    const firstVideo = roomState.queue.shift();
                    roomState.video_id = firstVideo.id;
                    roomState.is_playing = true;
                    roomState.current_time = 0;
                    
                    io.to(roomCode).emit('theater_action', { action: 'load', video_id: roomState.video_id });
                    io.to(roomCode).emit('theater_queue_update', roomState.queue);
                    saveRoomState(roomCode);
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

    socket.on('book_seat', (data) => {
        const roomCode = socket.data?.room;
        if (!roomCode || !theaterRooms[roomCode]) return;
        
        const roomState = theaterRooms[roomCode];
        const seatId = data.seatId;
        const profile = data.profile || {};
        
        // Check if seat is already occupied
        if (roomState.seats[seatId]) {
            socket.emit('book_seat_error', { message: 'Seat already occupied!' });
            return;
        }
        
        // Remove user from any old seat they were in
        for (const [sId, sData] of Object.entries(roomState.seats)) {
            if (sData.sid === socket.id) {
                delete roomState.seats[sId];
                io.to(roomCode).emit('seat_updated', { seatId: sId, occupant: null });
            }
        }
        
        // Book the new seat
        const occupant = {
            username: socket.data.username,
            avatar: profile.avatar || '👤',
            interests: profile.interests || '',
            sid: socket.id
        };
        roomState.seats[seatId] = occupant;
        
        // Broadcast the update
        io.to(roomCode).emit('seat_updated', { seatId: seatId, occupant: occupant });
    });

    socket.on('disconnect', () => {
        console.log(`[Theater] Disconnect: ${socket.id}`);
        const roomCode = socket.data?.room;
        if (roomCode && theaterRooms[roomCode]) {
            const roomState = theaterRooms[roomCode];
            // Clear their seat
            for (const [sId, sData] of Object.entries(roomState.seats)) {
                if (sData.sid === socket.id) {
                    delete roomState.seats[sId];
                    io.to(roomCode).emit('seat_updated', { seatId: sId, occupant: null });
                }
            }
        }
    });
});

const PORT = 5001;
server.listen(PORT, () => {
    console.log(`Theater Server (Node.js) listening on port ${PORT}`);
});
