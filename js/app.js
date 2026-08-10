// --- UNIVERSAL TOAST SYSTEM ---
function showToast(msg, type='info') {
    if (document.getElementById('set-mute-toast').checked) return;
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `global-toast ${type}`;
    el.innerHTML = `<div class="t-title">${type === 'error' ? 'Notice' : 'New Alert'}</div><div class="t-desc">${msg}</div>`;
    container.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

// --- AVATARS (15 Emojis) ---
const emojisList = [
    {e:'🦊', c:'#f97316'}, {e:'🐼', c:'#14b8a6'}, {e:'🐶', c:'#8b5cf6'}, {e:'🐱', c:'#eab308'}, {e:'🐸', c:'#84cc16'},
    {e:'🐰', c:'#ec4899'}, {e:'🐯', c:'#f59e0b'}, {e:'🦁', c:'#ea580c'}, {e:'🐻', c:'#78350f'}, {e:'🐨', c:'#64748b'},
    {e:'🐹', c:'#d97706'}, {e:'🦦', c:'#8b5cf6'}, {e:'🦝', c:'#475569'}, {e:'🦔', c:'#a8a29e'}, {e:'🦖', c:'#22c55e'}
];
let selectedAvatar = emojisList[0];
const avatarContainer = document.getElementById('avatar-selector');
emojisList.forEach((a, idx) => {
    const div = document.createElement('div');
    div.className = `avatar-option ${idx===0 ? 'selected' : ''}`;
    div.style.background = a.c;
    div.innerText = a.e;
    div.onclick = () => {
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        selectedAvatar = a;
    };
    avatarContainer.appendChild(div);
});

// FIXED SVG Generator (UTF8 is fully supported if correctly encoded)
function createEmojiSvg(emoji, bgColor) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bgColor}"/><text x="50" y="50" font-size="60" text-anchor="middle" dominant-baseline="central">${emoji}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// --- 9x8 COLOR PALETTE (72 Colors) ---
const hues = [0, 20, 40, 60, 120, 180, 210, 270, 315]; // 9 hue columns
const lightnesses = [15, 25, 35, 45, 55, 65, 75, 85]; // 8 rows
const colors = [];
lightnesses.forEach(l => { hues.forEach(h => { colors.push(`hsl(${h}, 70%, ${l}%)`); }); });

let chosenColor = '#8b5cf6'; // Default purple-ish
const colorPalette = document.getElementById('color-palette');
colors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = `color-swatch`;
    swatch.style.background = color;
    swatch.onclick = () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        chosenColor = color;
        document.getElementById('color-preview-bubble').style.background = chosenColor;
    };
    colorPalette.appendChild(swatch);
});

// --- PG-13 FILTERS & REGEX ---
const URL_REGEX = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.(com|net|org|io|co|in|us|uk|me|tv|info|edu|gov)\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const HTML_REGEX = /<[^>]*>?/gm;
const BAD_WORDS = ['shit', 'sex', 'nigga', 'fuck', 'bitch', 'ass', 'cunt', 'dick', 'porn', 'whore', 'slut', 'rape'];

function sanitizeInput(text) {
    let clean = text.replace(HTML_REGEX, "");
    clean = clean.replace(EMAIL_REGEX, "[email blocked]");
    clean = clean.replace(URL_REGEX, "[link blocked]");
    
    BAD_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        clean = clean.replace(regex, match => {
            if (match.length <= 2) return match;
            return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
        });
    });
    return clean.trim();
}

const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] };

let socket, peer;
let myProfile = { username: '', peerId: '', avatar: '', color: chosenColor };

let activeChatId = 'WORLD_CHAT'; 
let activeChatType = 'channel'; 
let activeNavTab = 'chats';

let roster = {}; 
let chatHistories = JSON.parse(localStorage.getItem('comfyChats_v6.2')) || { 'WORLD_CHAT': { type: 'channel', name: 'WORLD CHAT', sub: 'Global Public Room', unread: 0, hidden: false, msgs: [] } };
let notifications = JSON.parse(localStorage.getItem('comfyNotifs_v6.2')) || [];

let localMediaStream = null;
let activeVoiceCalls = {}; 
let dataConnections = {}; 
let pendingCall = null;
let awayTimeout = null;
let typingTimeout = null;

let replyingToMsg = null;
let editingMsgId = null;

window.addEventListener('DOMContentLoaded', () => {
    const s = localStorage.getItem('comfySession_v6.2');
    if (s) {
        const p = JSON.parse(s);
        document.getElementById('username-input').value = p.username;
        myProfile.color = p.color || chosenColor;
        chosenColor = myProfile.color;
        document.getElementById('color-preview-bubble').style.background = chosenColor;
        login();
    }
    renderNotifications();
});

// Presence Delay (5 seconds grace period)
window.addEventListener('focus', () => { 
    clearTimeout(awayTimeout);
    if(socket) socket.emit('set_status', {status: 'active'}); 
});
window.addEventListener('blur', () => { 
    awayTimeout = setTimeout(() => {
        if(socket) socket.emit('set_status', {status: 'away'}); 
    }, 5000);
});

function toggleTheme() {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'night' ? 'day' : 'night');
}

function showRules() {
    document.getElementById('rules-modal').classList.add('open');
}

function insertMention(name) {
    const input = document.getElementById('msg-input');
    input.value += `@${name} `;
    input.focus();
}

// --- NOTIFICATIONS PANEL & TOASTS ---
function toggleNotifications() {
    const panel = document.getElementById('notifications-panel');
    panel.classList.toggle('open');
    if(panel.classList.contains('open')) {
        document.getElementById('notif-badge').classList.remove('show');
    }
}
function addNotification(chatId, sender, text, isReaction=false) {
    notifications.unshift({ chatId, sender, text, isReaction, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    if (notifications.length > 20) notifications.pop();
    localStorage.setItem('comfyNotifs_v6.2', JSON.stringify(notifications));
    
    const panel = document.getElementById('notifications-panel');
    if (!panel.classList.contains('open')) {
        document.getElementById('notif-badge').innerText = notifications.length > 9 ? '9+' : notifications.length;
        document.getElementById('notif-badge').classList.add('show');
    }
    
    const action = isReaction ? 'reacted to your message' : 'sent a message';
    showToast(`${sender} ${action}`, 'info');
    
    if (!document.getElementById('set-mute').checked) {
        document.getElementById('notification-sound').play().catch(e=>{});
    }
    renderNotifications();
}
function renderNotifications() {
    const list = document.getElementById('notif-list');
    if (notifications.length === 0) {
        list.innerHTML = `<div class="notif-empty">No new notifications</div>`;
        return;
    }
    list.innerHTML = '';
    notifications.forEach(n => {
        const el = document.createElement('div');
        el.className = 'notif-item';
        el.onclick = () => {
            const c = chatHistories[n.chatId];
            if(c) { switchNav('chats'); openConversation(n.chatId, c.name, c.sub, c.type); toggleNotifications(); }
        };
        el.innerHTML = `<div class="n-title">${n.sender} ${n.isReaction ? 'reacted' : 'sent a message'} <span style="font-size:0.7rem; font-weight:normal; float:right;">${n.time}</span></div><div class="n-msg">${n.text}</div>`;
        list.appendChild(el);
    });
}
function clearNotifications() {
    notifications = [];
    localStorage.setItem('comfyNotifs_v6.2', JSON.stringify(notifications));
    renderNotifications();
    document.getElementById('notif-badge').classList.remove('show');
}
function markAllRead() {
    document.getElementById('notif-badge').classList.remove('show');
}

// --- LOGIN ---
function login() {
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    
    const rawUser = document.getElementById('username-input').value;
    const rawInterest = document.getElementById('interests-input').value;
    const username = sanitizeInput(rawUser);
    if (!username) { 
        errEl.innerText = 'Valid username required.'; errEl.style.display = 'block'; 
        return; 
    }

    myProfile.username = username;
    myProfile.avatar = createEmojiSvg(selectedAvatar.emoji, selectedAvatar.color);
    
    let host = window.location.hostname;
    if (host.includes('github.io') || !host) host = '127.0.0.1'; 
    
    socket = io(`http://${host}:5000`);
    peer = new Peer({ config: ICE_SERVERS });

    peer.on('open', (id) => {
        myProfile.peerId = id;
        socket.emit('join_room', { room: 'WORLD_CHAT', username: myProfile.username, peerId: id, avatar: myProfile.avatar, interest: sanitizeInput(rawInterest), color: chosenColor });
    });
    
    socket.on('login_error', (data) => { 
        errEl.innerText = data.message; errEl.style.display = 'block';
        socket.disconnect(); 
    });

    socket.on('login_success', (data) => {
        myProfile.color = data.color || myProfile.color;
        localStorage.setItem('comfySession_v6.2', JSON.stringify(myProfile));
        
        document.getElementById('login-view').classList.remove('active');
        document.getElementById('workspace-view').style.display = 'block';
        
        document.getElementById('set-username').value = myProfile.username;
        
        if (chatHistories['WORLD_CHAT'].msgs.length === 0) {
            chatHistories['WORLD_CHAT'].msgs.push({
                id: 'sys-rules', sender: 'System Moderator',
                avatar: createEmojiSvg('🛡️', '#ef4444'),
                message: "Welcome to Comfy-Chat! Please follow the PG-13 rules: No explicit words, no spamming, and NO links allowed. Be respectful. Your IP is logged.",
                time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                timestamp: Date.now(),
                color: '#ef4444' // Forces Mod Red
            });
        }
        
        renderChatsList();
        openConversation('WORLD_CHAT', 'WORLD CHAT', 'Global Public Room', 'channel');
    });

    socket.on('settings_error', (data) => {
        const sErr = document.getElementById('settings-error');
        sErr.innerText = data.message; sErr.style.display = 'block';
    });
    socket.on('settings_success', (data) => {
        document.getElementById('settings-error').style.display = 'none';
        myProfile.username = data.username;
        myProfile.color = data.color;
        localStorage.setItem('comfySession_v6.2', JSON.stringify(myProfile));
        showToast('Settings saved successfully!');
    });

    socket.on('update-roster', (users) => {
        roster = {};
        users.forEach(u => roster[u.peerId] = u);
        renderUsersList();
        renderChatsList();
    });

    socket.on('broadcast-message', (data) => {
        handleIncomingMessage(data.channel, 'channel', data.channel, 'Group Chat', data);
    });
    
    socket.on('broadcast-reaction', (data) => {
        applyReaction(data.targetRoom, data.msgId, data.emoji, data.senderName);
    });
    socket.on('broadcast-delete', (data) => {
        handleMessageAction(data.targetRoom, data.msgId, 'delete');
    });
    socket.on('broadcast-edit', (data) => {
        handleMessageAction(data.targetRoom, data.msgId, 'edit', data.newText);
    });

    peer.on('call', (call) => {
        if (localMediaStream) {
            call.answer(localMediaStream);
            call.on('stream', (remoteStream) => playRemoteAudio(call.peer, remoteStream));
            activeVoiceCalls[call.peer] = call;
        } else {
            call.answer(); 
        }
    });

    peer.on('connection', (conn) => { setupDataConnection(conn); });
}

// --- USER LIST SEARCH ---
function filterUsers() {
    renderUsersList(document.getElementById('user-search').value.toLowerCase());
}

function renderUsersList(filter = '') {
    const list = document.getElementById('users-roster');
    list.innerHTML = '';
    
    const users = Object.values(roster);
    document.getElementById('online-count').textContent = users.length;
    
    if (!filter || myProfile.username.toLowerCase().includes(filter)) {
        const selfEl = document.createElement('div');
        selfEl.className = 'list-item disabled';
        selfEl.innerHTML = `
            <div class="avatar-sm" style="background-image: url('${myProfile.avatar}')">
                <div class="status-dot active"></div>
            </div>
            <div class="item-details">
                <div class="item-name">${myProfile.username} (You)</div>
                <div class="item-sub">Online</div>
            </div>
        `;
        list.appendChild(selfEl);
    }

    users.forEach(u => {
        if (chatHistories[u.peerId]) {
            chatHistories[u.peerId].name = u.username;
            chatHistories[u.peerId].sub = u.interest;
        }
        
        if (u.peerId === myProfile.peerId) return; 
        if (filter && !u.username.toLowerCase().includes(filter)) return;
        
        const el = document.createElement('div');
        el.className = 'list-item';
        el.onclick = () => openConversation(u.peerId, u.username, u.interest, 'direct');
        
        el.innerHTML = `
            <div class="avatar-sm" style="background-image: url('${u.avatar}')">
                <div class="status-dot ${u.status}"></div>
            </div>
            <div class="item-details">
                <div class="item-name">${u.username}</div>
                <div class="item-sub">${u.interest}</div>
            </div>
        `;
        list.appendChild(el);
    });
}

function setupDataConnection(conn) {
    dataConnections[conn.peer] = conn;
    conn.on('data', (payload) => {
        if (payload.type === 'typing') {
            if (activeChatId === conn.peer) {
                const ind = document.getElementById('typing-indicator');
                ind.classList.add('show');
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => ind.classList.remove('show'), 2000);
            }
            return;
        }
        if (payload.type === 'reaction') {
            applyReaction(conn.peer, payload.msgId, payload.emoji, roster[conn.peer] ? roster[conn.peer].username : 'Someone');
            return;
        }
        if (payload.type === 'delete_msg') {
            handleMessageAction(conn.peer, payload.msgId, 'delete');
            return;
        }
        if (payload.type === 'edit_msg') {
            handleMessageAction(conn.peer, payload.msgId, 'edit', payload.newText);
            return;
        }
        
        if (payload.type === 'call_request') {
            showIncomingCall(conn.peer, payload.username);
            return;
        }
        if (payload.type === 'call_accept') {
            showToast(`${payload.username} accepted your call!`, 'info');
            document.getElementById('mic-btn').classList.add('active');
            const call = peer.call(conn.peer, localMediaStream);
            activeVoiceCalls[conn.peer] = call;
            call.on('stream', (remoteStream) => playRemoteAudio(conn.peer, remoteStream));
            return;
        }
        if (payload.type === 'call_reject') {
            showToast(`${payload.username} rejected your call.`, 'error');
            stopMic();
            return;
        }

        const senderName = roster[conn.peer] ? roster[conn.peer].username : 'Unknown';
        const senderInterest = roster[conn.peer] ? roster[conn.peer].interest : 'Private Chat';
        handleIncomingMessage(conn.peer, 'direct', senderName, senderInterest, payload);
    });
    conn.on('close', () => { delete dataConnections[conn.peer]; });
}

function getP2PConnection(peerId) {
    if (dataConnections[peerId] && dataConnections[peerId].open) return dataConnections[peerId];
    const conn = peer.connect(peerId);
    setupDataConnection(conn);
    return conn;
}

function handleIncomingMessage(chatId, type, name, sub, msgPayload) {
    if (!chatHistories[chatId]) {
        chatHistories[chatId] = { type, name, sub, unread: 0, hidden: false, msgs: [] };
    }
    chatHistories[chatId].hidden = false; 
    msgPayload.id = msgPayload.id || Date.now().toString(); 
    chatHistories[chatId].msgs.push(msgPayload);
    
    const isViewingDesktop = window.innerWidth > 768;
    const isViewingMobile = window.innerWidth <= 768 && document.getElementById('chat-detail-pane').classList.contains('mobile-open');
    
    if (activeChatId === chatId && (isViewingDesktop || isViewingMobile)) {
        renderChatStream();
    } else {
        chatHistories[chatId].unread += 1;
        
        // Red Badge on Tabs if incoming message is not from active view
        if (activeNavTab !== 'chats') {
            document.getElementById('chats-badge').classList.add('show');
        }
        
        const isMentioned = msgPayload.message.includes(`@${myProfile.username}`);
        if (type === 'direct' || isMentioned) {
            addNotification(chatId, msgPayload.sender, msgPayload.message);
        }
    }
    
    saveHistory();
    renderChatsList();
}

function switchNav(tab) {
    activeNavTab = tab;
    if (tab === 'chats') {
        document.getElementById('chats-badge').classList.remove('show');
    }
    
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${tab}`).classList.add('active');
    document.querySelectorAll('.list-container').forEach(el => el.classList.remove('active'));
    document.getElementById(`pane-${tab}`).classList.add('active');
    
    if (window.innerWidth <= 768) {
        closeMobileChat();
    }
}

function openConversation(id, name, sub, type = 'channel') {
    activeChatId = id;
    activeChatType = type;
    
    if (!chatHistories[id]) {
        chatHistories[id] = { type, name, sub, unread: 0, hidden: false, msgs: [] };
    }
    chatHistories[id].name = name;
    chatHistories[id].sub = sub;
    chatHistories[id].unread = 0; 
    chatHistories[id].hidden = false;
    saveHistory();
    
    document.getElementById('active-chat-title').innerText = name;
    document.getElementById('active-chat-sub').innerText = sub;
    
    const micBtn = document.getElementById('mic-btn');
    if (type === 'channel') {
        micBtn.classList.add('disabled');
        if (localMediaStream) stopMic(); 
    } else {
        micBtn.classList.remove('disabled');
    }
    
    renderChatsList();
    renderChatStream();
    
    if (window.innerWidth <= 768) {
        document.getElementById('chat-detail-pane').classList.add('mobile-open');
    }
}

function closeMobileChat() {
    document.getElementById('chat-detail-pane').classList.remove('mobile-open');
    activeChatId = null;
    renderChatsList();
}

function hideChatFromList(e, id) {
    e.stopPropagation();
    if (id === 'WORLD_CHAT') return; 
    chatHistories[id].hidden = true;
    saveHistory();
    if (activeChatId === id) {
        activeChatId = 'WORLD_CHAT';
        if (window.innerWidth <= 768) closeMobileChat();
        else openConversation('WORLD_CHAT', 'WORLD CHAT', 'Global Public Room', 'channel');
    }
    renderChatsList();
}

function renderChatsList() {
    const pane = document.getElementById('pane-chats');
    pane.innerHTML = '';
    Object.keys(chatHistories).forEach(id => {
        const c = chatHistories[id];
        if (c.hidden) return; 
        
        const isActive = id === activeChatId ? 'active-chat' : '';
        const unreadBadge = c.unread > 0 ? `<div style="background:var(--danger); color:white; border-radius:50%; padding:0.1rem 0.4rem; font-size:0.7rem; font-weight:bold;">${c.unread}</div>` : '';
        const closeBtn = id !== 'WORLD_CHAT' ? `<div class="item-action" onclick="hideChatFromList(event, '${id}')">×</div>` : '';
        
        const isOnline = !!roster[id];
        const statusClass = c.type === 'channel' ? '' : (isOnline ? roster[id].status : 'offline');
        const avatarUrl = c.type === 'channel' ? createEmojiSvg('🌎', '#0284c7') : (isOnline ? roster[id].avatar : (c.msgs.length > 0 ? c.msgs[c.msgs.length-1].avatar : ''));
        
        let lastMsg = c.msgs.length > 0 ? c.msgs[c.msgs.length-1].message : 'No messages';
        if (c.msgs.length > 0 && c.msgs[c.msgs.length-1].deleted) lastMsg = 'This message was deleted';
        
        const el = document.createElement('div');
        el.className = `list-item ${isActive}`;
        el.onclick = () => openConversation(id, c.name, c.sub, c.type);
        el.innerHTML = `
            <div class="avatar-sm" style="background-image: url('${avatarUrl}');">
                ${c.type !== 'channel' ? `<div class="status-dot ${statusClass}"></div>` : ''}
            </div>
            <div class="item-details">
                <div class="item-name">${c.name}</div>
                <div class="item-sub">${lastMsg}</div>
            </div>
            ${unreadBadge}
            ${closeBtn}
        `;
        pane.appendChild(el);
    });
}

// --- RENDERING CHAT ---
function renderChatStream() {
    const stream = document.getElementById('chat-stream');
    stream.innerHTML = '';
    if (!activeChatId || !chatHistories[activeChatId]) return;
    
    chatHistories[activeChatId].msgs.forEach(msg => {
        const isSelf = msg.sender === myProfile.username;
        const bubbleColor = msg.id === 'sys-rules' ? 'var(--danger)' : (isSelf ? (msg.color || 'var(--accent)') : 'var(--msg-bg)'); 
        
        const replyHtml = msg.replyTo ? `<div class="quoted-msg"><strong>${msg.replyTo.sender}</strong><br>${msg.replyTo.text}</div>` : '';
        const reactionsHtml = msg.reactions ? msg.reactions.map(r => `<span>${r}</span>`).join('') : '';
        
        const isEditable = isSelf && msg.timestamp && (Date.now() - msg.timestamp < 5 * 60 * 1000) && !msg.deleted;
        
        // SVG Icons for Menu
        const editIcon = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
        const delIcon = `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
        const replyIcon = `<svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>`;

        const editMenu = isEditable ? `
            <div style="width:1px; background:var(--border); margin:4px 0;"></div>
            <div class="dropdown-btn" onclick="initEdit('${msg.id}', '${msg.message.replace(/'/g,"\\'")}')" title="Edit">${editIcon}</div>
            <div class="dropdown-btn danger" onclick="deleteMessage('${msg.id}')" title="Delete">${delIcon}</div>
        ` : '';

        const el = document.createElement('div');
        el.className = `msg-wrapper ${isSelf ? 'self' : ''}`;
        el.id = `msg-${msg.id}`;
        
        if (msg.deleted) {
            el.innerHTML = `
                <div class="msg-inner">
                    <div class="msg-bubble deleted">This message was deleted</div>
                </div>`;
        } else {
            el.innerHTML = `
                <div class="msg-header">
                    <span class="msg-sender" onclick="insertMention('${msg.sender.replace(/'/g,"\\'")}')">${msg.sender}</span>
                    <span class="time-stamp">${msg.edited ? '<span class="edited-tag">(edited)</span>' : ''}${msg.time}</span>
                </div>
                <div class="msg-inner">
                    ${!isSelf ? `<div class="avatar-xs" style="background-image: url('${msg.avatar}')"></div>` : ''}
                    <div class="msg-bubble ${msg.id === 'sys-rules' ? 'sys-mod' : ''}" style="background: ${bubbleColor};">
                        ${replyHtml}
                        <div class="msg-text">${msg.message}</div>
                        <div class="reactions-display" id="react-disp-${msg.id}" style="${msg.reactions && msg.reactions.length>0 ? 'display:flex;':''}">${reactionsHtml}</div>
                    </div>
                    
                    <div class="msg-menu-wrap">
                        <svg class="kebab-icon" onclick="toggleMenu('${msg.id}')" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                        <div class="msg-dropdown" id="menu-${msg.id}">
                            <div class="dropdown-btn" onclick="initReply('${msg.id}', '${msg.sender.replace(/'/g,"\\'")}', '${msg.message.replace(/'/g,"\\'")}')" title="Reply">${replyIcon}</div>
                            <div style="width:1px; background:var(--border); margin:4px 0;"></div>
                            <span class="react-emoji" onclick="sendReaction('${msg.id}', '👍')">👍</span>
                            <span class="react-emoji" onclick="sendReaction('${msg.id}', '❤️')">❤️</span>
                            <span class="react-emoji" onclick="sendReaction('${msg.id}', '😂')">😂</span>
                            <span class="react-emoji" onclick="sendReaction('${msg.id}', '😢')">😢</span>
                            ${editMenu}
                        </div>
                    </div>
                </div>
            `;
        }
        stream.appendChild(el);
    });
    stream.scrollTop = stream.scrollHeight;
}

function toggleMenu(id) {
    document.querySelectorAll('.msg-dropdown').forEach(el => {
        if (el.id !== `menu-${id}`) el.classList.remove('open');
    });
    document.getElementById(`menu-${id}`).classList.toggle('open');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.msg-menu-wrap')) {
        document.querySelectorAll('.msg-dropdown').forEach(el => el.classList.remove('open'));
    }
    if (!e.target.closest('.bell-wrapper') && !e.target.closest('.notifications-panel')) {
        document.getElementById('notifications-panel').classList.remove('open');
    }
});

function initReply(id, sender, text) {
    cancelEdit();
    replyingToMsg = { id, sender, text };
    document.getElementById('reply-target-name').innerText = sender;
    document.getElementById('reply-preview').classList.add('active');
    document.getElementById('msg-input').focus();
    toggleMenu(id);
}
function cancelReply() {
    replyingToMsg = null;
    document.getElementById('reply-preview').classList.remove('active');
}

function initEdit(id, text) {
    cancelReply();
    editingMsgId = id;
    document.getElementById('msg-input').value = text;
    document.getElementById('edit-preview').classList.add('active');
    document.getElementById('msg-input').focus();
    toggleMenu(id);
}
function cancelEdit() {
    editingMsgId = null;
    document.getElementById('msg-input').value = '';
    document.getElementById('edit-preview').classList.remove('active');
}

function deleteMessage(msgId) {
    toggleMenu(msgId);
    handleMessageAction(activeChatId, msgId, 'delete');
    if (activeChatType === 'direct') {
        const conn = getP2PConnection(activeChatId);
        if (conn.open) conn.send({ type: 'delete_msg', msgId });
    } else {
        socket.emit('delete_group_msg', { targetRoom: activeChatId, msgId });
    }
}

function handleMessageAction(chatId, msgId, action, newText = '') {
    if (chatHistories[chatId]) {
        const msg = chatHistories[chatId].msgs.find(m => m.id === msgId);
        if (msg) {
            if (action === 'delete') {
                msg.deleted = true;
                msg.message = '';
            } else if (action === 'edit') {
                msg.message = newText;
                msg.edited = true;
            }
            saveHistory();
            if (chatId === activeChatId) renderChatStream();
            renderChatsList();
        }
    }
}

function sendReaction(msgId, emoji) {
    toggleMenu(msgId);
    applyReaction(activeChatId, msgId, emoji, myProfile.username);
    
    if (activeChatType === 'channel') {
        socket.emit('send_reaction', { targetRoom: activeChatId, msgId, emoji, senderName: myProfile.username });
    } else {
        const conn = getP2PConnection(activeChatId);
        if (conn.open) conn.send({ type: 'reaction', msgId, emoji });
    }
}

function applyReaction(chatId, msgId, emoji, senderName) {
    if (chatHistories[chatId]) {
        const msg = chatHistories[chatId].msgs.find(m => m.id === msgId);
        if (msg) {
            if(!msg.reactions) msg.reactions = [];
            msg.reactions.push(emoji);
            saveHistory();
            if (msg.sender === myProfile.username && senderName !== myProfile.username) {
                addNotification(chatId, senderName, emoji, true);
            }
        }
    }
    if (chatId === activeChatId) renderChatStream();
}

// --- SENDING MESSAGES & TYPING ---
function handleTyping() {
    if (activeChatType === 'direct') {
        const conn = getP2PConnection(activeChatId);
        if (conn.open) conn.send({ type: 'typing' });
    }
}

function sendMessage() {
    const input = document.getElementById('msg-input');
    const cleanText = sanitizeInput(input.value);
    if (!cleanText || !activeChatId) return;

    if (editingMsgId) {
        handleMessageAction(activeChatId, editingMsgId, 'edit', cleanText);
        if (activeChatType === 'direct') {
            const conn = getP2PConnection(activeChatId);
            if (conn.open) conn.send({ type: 'edit_msg', msgId: editingMsgId, newText: cleanText });
        } else {
            socket.emit('edit_group_msg', { targetRoom: activeChatId, msgId: editingMsgId, newText: cleanText });
        }
        cancelEdit();
        return;
    }

    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const msgId = Date.now().toString();
    
    const payload = {
        id: msgId, sender: myProfile.username, avatar: myProfile.avatar,
        message: cleanText, time: timeStr, timestamp: Date.now(), color: myProfile.color,
        replyTo: replyingToMsg
    };

    if (activeChatType === 'channel') {
        payload.targetRoom = activeChatId;
        socket.emit('send_group_message', payload);
        handleIncomingMessage(activeChatId, 'channel', chatHistories[activeChatId].name, '', {...payload, isSelf: true});
    } else {
        const conn = getP2PConnection(activeChatId);
        const p2pPayload = { ...payload, isSelf: false };
        if (conn.open) conn.send(p2pPayload);
        else conn.on('open', () => conn.send(p2pPayload));
        
        handleIncomingMessage(activeChatId, 'direct', roster[activeChatId].username, roster[activeChatId].interest, {...payload, isSelf: true});
    }
    
    input.value = '';
    cancelReply();
}

// --- SETTINGS ---
function saveSettings() {
    const errEl = document.getElementById('settings-error');
    errEl.style.display = 'none';
    const newName = sanitizeInput(document.getElementById('set-username').value);
    if (newName) {
        socket.emit('change_settings', { username: newName, color: chosenColor });
    }
}

// --- MIC / PERMISSION FLOW ---
async function initiateCall() {
    const micBtn = document.getElementById('mic-btn');
    if (micBtn.classList.contains('disabled')) return; 

    if (localMediaStream) {
        stopMic();
    } else {
        try {
            localMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const conn = getP2PConnection(activeChatId);
            const reqPayload = { type: 'call_request', username: myProfile.username };
            if (conn.open) conn.send(reqPayload);
            else conn.on('open', () => conn.send(reqPayload));
            
            showToast(`Calling ${chatHistories[activeChatId].name}... Waiting for answer.`, 'info');
        } catch (e) { showToast('Mic blocked by browser.', 'error'); }
    }
}

function stopMic() {
    if (localMediaStream) {
        localMediaStream.getTracks().forEach(t => t.stop());
        localMediaStream = null;
        document.getElementById('mic-btn').classList.remove('active');
        if (activeVoiceCalls[activeChatId]) {
            activeVoiceCalls[activeChatId].close();
            delete activeVoiceCalls[activeChatId];
        }
    }
}

function showIncomingCall(callerId, callerName) {
    pendingCall = { id: callerId, name: callerName };
    document.getElementById('incoming-call-name').innerText = `Incoming Voice Call from ${callerName}`;
    document.getElementById('incoming-call-toast').classList.add('open');
    if (!document.getElementById('set-mute').checked) {
        document.getElementById('notification-sound').play().catch(e=>{});
    }
}

async function acceptCall() {
    document.getElementById('incoming-call-toast').classList.remove('open');
    if (!pendingCall) return;
    
    try {
        localMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        const conn = getP2PConnection(pendingCall.id);
        conn.send({ type: 'call_accept', username: myProfile.username });
        
        const c = chatHistories[pendingCall.id];
        if(c) { switchNav('chats'); openConversation(pendingCall.id, c.name, c.sub, 'direct'); }
        
        document.getElementById('mic-btn').classList.add('active');
    } catch (e) { showToast('Failed to get Mic access.', 'error'); }
}

function rejectCall() {
    document.getElementById('incoming-call-toast').classList.remove('open');
    if (!pendingCall) return;
    
    const conn = getP2PConnection(pendingCall.id);
    conn.send({ type: 'call_reject', username: myProfile.username });
    pendingCall = null;
}

function playRemoteAudio(peerId, stream) {
    let audioEl = document.getElementById(`audio-${peerId}`);
    if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = `audio-${peerId}`;
        audioEl.autoplay = true;
        document.getElementById('audio-container').appendChild(audioEl);
    }
    audioEl.srcObject = stream;
}

function toggleEmoji() { document.getElementById('emoji-picker-wrapper').classList.toggle('open'); }
document.querySelector('emoji-picker').addEventListener('emoji-click', event => {
    const input = document.getElementById('msg-input');
    input.value += event.detail.unicode;
    handleTyping();
    toggleEmoji();
    input.focus();
});

function saveHistory() { localStorage.setItem('comfyChats_v6.2', JSON.stringify(chatHistories)); }
