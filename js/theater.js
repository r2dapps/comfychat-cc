/* ==========================================================================
   ComfyChat Theater UI & Socket Logic (Phase 2)
   ========================================================================== */

let isFullscreen = false;
let currentSeatSelected = null;
let ytPlayer = null;
let socket = null;
let isAdmin = false;
let myName = 'User_' + Math.floor(Math.random() * 1000);
let roomCode = null;

// Initialize Theater Environment
document.addEventListener('DOMContentLoaded', () => {
    initSeatingGrid();
    initMockQueue();
    
    // Check for room ticket
    const urlParams = new URLSearchParams(window.location.search);
    roomCode = urlParams.get('room');
    
    if (roomCode) {
        document.getElementById('ticket-overlay').style.display = 'none';
        connectToServer();
    } else {
        document.getElementById('ticket-overlay').style.display = 'flex';
    }
});

function generateTicket() {
    // Generate a simple random room code
    const code = Math.random().toString(36).substring(2, 10);
    window.location.href = `?room=${code}`;
}

function copyTicketLink() {
    if (!roomCode) return;
    const url = window.location.origin + window.location.pathname + '?room=' + roomCode;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Ticket link copied! Send it to your friends.', 'success');
    });
}

function connectToServer() {
    socket = io('http://127.0.0.1:5001');
    
    socket.on('connect', () => {
        socket.emit('join_theater', { username: myName, room: roomCode });
    });

    socket.on('theater_admin_status', (data) => {
        isAdmin = data.is_admin;
        if (isAdmin) {
            document.getElementById('admin-controls').classList.remove('hidden');
            document.body.classList.remove('viewer-mode');
            showToast('You are the Theater Admin', 'success');
        } else {
            document.getElementById('admin-controls').classList.add('hidden');
            document.body.classList.add('viewer-mode');
        }
        
        // Initialize player AFTER knowing admin status to set controls appropriately
        if (!ytPlayer) {
            initYouTubePlayer();
        }
    });

    socket.on('theater_state_sync', (state) => {
        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(state.video_id, state.current_time);
            if (!state.is_playing) {
                setTimeout(() => ytPlayer.pauseVideo(), 500);
            }
        }
    });

    socket.on('theater_action', (data) => {
        if (!ytPlayer || typeof ytPlayer.playVideo !== 'function') return;
        
        if (data.action === 'load') {
            ytPlayer.loadVideoById(data.video_id, 0);
        } else if (data.action === 'play') {
            ytPlayer.seekTo(data.time, true);
            ytPlayer.playVideo();
        } else if (data.action === 'pause') {
            ytPlayer.seekTo(data.time, true);
            ytPlayer.pauseVideo();
        } else if (data.action === 'seek') {
            ytPlayer.seekTo(data.time, true);
        }
    });

    socket.on('theater_chat', (data) => {
        appendMessage(data.sender, data.text, false, data.isSystem);
    });

    socket.on('theater_search_results', (results) => {
        renderSearchResults(results);
    });

    socket.on('theater_queue_update', (queue) => {
        const qList = document.getElementById('queue-list');
        if (!queue || queue.length === 0) {
            qList.innerHTML = `<div style="padding:10px; color:var(--text-muted); text-align:center;">Queue is empty.</div>`;
            return;
        }
        qList.innerHTML = queue.map(v => `
            <div class="queue-item">
                <img class="queue-thumb" src="${v.thumbnail}" alt="thumb">
                <div class="queue-info">
                    <div class="queue-title">${v.title}</div>
                    <div class="queue-requester">${v.channel}</div>
                </div>
            </div>
        `).join('');
    });
}

// --- YouTube IFrame API ---
function onYouTubeIframeAPIReady() {
    // API is ready, but we wait for socket to call initYouTubePlayer
}

function initYouTubePlayer() {
    ytPlayer = new YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: 'aqz-KE-bpKQ', 
        playerVars: {
            'autoplay': 1,
            'controls': isAdmin ? 1 : 0, // Disable controls for viewers
            'disablekb': isAdmin ? 0 : 1, // Disable keyboard for viewers
            'rel': 0,
            'showinfo': 0,
            'modestbranding': 1,
            'fs': 0 
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    if (!isAdmin) {
        event.target.mute(); // allow autoplay policies
    }
}

function onPlayerStateChange(event) {
    if (!isAdmin) return;
    
    // Broadcast state changes if admin
    const currentTime = ytPlayer.getCurrentTime();
    if (event.data === YT.PlayerState.PLAYING) {
        socket.emit('theater_command', { command: 'play', time: currentTime });
    } else if (event.data === YT.PlayerState.PAUSED) {
        socket.emit('theater_command', { command: 'pause', time: currentTime });
    }
}

// Admin Video Request & Search
function searchYouTube() {
    const input = document.getElementById('video-url-input');
    const val = input.value.trim();
    if(!val) return;
    
    if (isAdmin) {
        const videoId = extractYouTubeID(val);
        if (videoId) {
            socket.emit('theater_command', { command: 'load_video', video_id: videoId });
            input.value = '';
        } else {
            showToast('Searching YouTube...', 'info');
            document.getElementById('search-results').innerHTML = '<div style="color:var(--text-muted); text-align:center;">Searching... <i class="fa-solid fa-spinner fa-spin"></i></div>';
            socket.emit('theater_command', { command: 'search_youtube', query: val });
        }
    } else {
        showToast('Only the admin can search for videos', 'error');
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    if (!results || results.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); text-align:center;">No results found.</div>';
        return;
    }
    
    container.innerHTML = results.map(res => `
        <div class="queue-item" style="cursor:pointer;" onclick="addVideoToQueue('${res.id}', '${res.type}')">
            <img class="queue-thumb" src="${res.thumbnail}" alt="thumb">
            <div class="queue-info">
                <div class="queue-title">${res.title}</div>
                <div class="queue-requester">${res.channel} • ${res.duration} ${res.type === 'playlist' ? '(Playlist)' : ''}</div>
            </div>
        </div>
    `).join('');
}

function addVideoToQueue(id, type) {
    if (!isAdmin) return;
    if (type === 'playlist') {
        socket.emit('theater_command', { command: 'load_playlist', playlist_id: id });
        showToast('Loading playlist...', 'info');
    } else {
        socket.emit('theater_command', { command: 'load_video', video_id: id });
        showToast('Video loaded from search!', 'success');
    }
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('video-url-input').value = '';
}

function extractYouTubeID(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : false;
}

// --- Layout & Native Fullscreen ---
function toggleNativeFullscreen() {
    const layer = document.getElementById('video-layer');
    if (!document.fullscreenElement) {
        if (layer.requestFullscreen) {
            layer.requestFullscreen().then(() => {
                // Try forcing landscape on mobile devices
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(e => console.log('Orientation lock not supported', e));
                }
            }).catch(err => {
                showToast(`Error attempting to enable fullscreen: ${err.message}`, 'danger');
            });
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`pane-${tabId}`).classList.add('active');

    if(tabId === 'chat') {
        document.getElementById('chat-badge').style.display = 'none';
        document.getElementById('chat-badge').innerText = '0';
        const stream = document.getElementById('chat-stream');
        stream.scrollTop = stream.scrollHeight;
    }
}

// --- Seating System (20 Seats) ---
function initSeatingGrid() {
    const grid = document.getElementById('seating-grid');
    grid.innerHTML = '';
    
    for (let i = 1; i <= 20; i++) {
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.id = `seat-${i}`;
        
        seat.innerHTML = `<div class="seat-number">${i}</div>`;
        seat.onclick = () => promptBookSeat(i);
        grid.appendChild(seat);
    }
}

function promptBookSeat(seatId) {
    currentSeatSelected = seatId;
    document.getElementById('seat-booking-modal').style.display = 'flex';
}

function confirmSeatBooking() {
    if (!currentSeatSelected) return;
    
    const seat = document.getElementById(`seat-${currentSeatSelected}`);
    seat.classList.add('occupied');
    seat.innerHTML = `
        <div class="seat-avatar">🐶</div>
        <div class="seat-name">${myName}</div>
    `;
    seat.onclick = null; 
    
    closeModal('seat-booking-modal');
    showToast('Seat booked! WebRTC Voice activated.', 'success');
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// --- Chat & Floating Emojis ---
function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    socket.emit('theater_chat_msg', { sender: myName, text: text });
    appendMessage('You', text, true, false);
    input.value = '';
}

function appendMessage(sender, text, isSelf, isSystem) {
    if (isSelf && sender !== 'You') return;
    
    const stream = document.getElementById('chat-stream');
    const msg = document.createElement('div');
    msg.className = `chat-msg ${isSelf ? 'self' : ''} ${isSystem ? 'system' : ''}`;
    
    let html = '';
    if (!isSelf && !isSystem) html += `<div class="msg-sender">${sender}</div>`;
    html += `<div class="msg-bubble">${text}</div>`;
    
    msg.innerHTML = html;
    stream.appendChild(msg);
    stream.scrollTop = stream.scrollHeight;

    if(!document.getElementById('pane-chat').classList.contains('active') && !isSelf) {
        const badge = document.getElementById('chat-badge');
        badge.style.display = 'inline-block';
        badge.innerText = parseInt(badge.innerText) + 1;
    }
}

function sendReaction(emoji) {
    triggerFloatingEmoji(emoji);
    socket.emit('theater_chat_msg', { sender: myName, text: emoji });
}

function triggerFloatingEmoji(emoji) {
    const container = document.getElementById('floating-emojis-container');
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.innerText = emoji;

    const randomX = Math.floor(Math.random() * 80) + 10;
    const randomRotate = (Math.random() - 0.5) * 60;
    const driftX = (Math.random() - 0.5) * 150;

    el.style.left = `${randomX}%`;
    el.style.bottom = '10%';
    el.style.transform = `scale(0.3) rotate(0deg)`;
    el.style.opacity = '1';
    el.style.transition = 'transform 1.5s cubic-bezier(0.15, 0.85, 0.35, 1.2), opacity 1.5s ease-out, bottom 1.5s ease-out';

    container.appendChild(el);
    
    requestAnimationFrame(() => {
        el.style.bottom = '70%';
        el.style.transform = `translateX(${driftX}px) scale(1.5) rotate(${randomRotate}deg)`;
        el.style.opacity = '0';
    });

    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, 1500);
}

function initMockQueue() {
    const qList = document.getElementById('queue-list');
    qList.innerHTML = `<div style="padding:10px; color:var(--text-muted); text-align:center;">Queue is empty.</div>`;
}

// Admin Controls
function forceSkip() { showToast('Admin: Skipped current video (not implemented)'); }
function forceSync() { 
    if(isAdmin) {
        socket.emit('theater_command', { command: 'seek', time: ytPlayer.getCurrentTime() });
        showToast('Forced sync to current time', 'success');
    }
}

// Toast System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
