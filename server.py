import os
import webbrowser
import eventlet
import socketio
import re
from flask import Flask, send_from_directory
import hmac
import hashlib
import json
import base64
import uuid
from db_manager import db

SECRET_KEY = "SUPER_SECRET_COMFY_KEY_123"

def encode_jwt(payload):
    header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT"}).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature = base64.urlsafe_b64encode(hmac.new(SECRET_KEY.encode(), f"{header}.{payload_b64}".encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return f"{header}.{payload_b64}.{signature}"

def decode_jwt(token):
    try:
        header, payload_b64, signature = token.split(".")
        expected_sig = base64.urlsafe_b64encode(hmac.new(SECRET_KEY.encode(), f"{header}.{payload_b64}".encode(), hashlib.sha256).digest()).decode().rstrip("=")
        if signature != expected_sig: return None
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        return json.loads(base64.urlsafe_b64decode(payload_b64).decode())
    except:
        return None

sio = socketio.Server(cors_allowed_origins='*')
app = Flask(__name__, static_folder='.', static_url_path='')
app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)

room_members = {}

def is_username_taken(username):
    for room, members in room_members.items():
        for sid, data in members.items():
            if data['username'].lower() == username.lower():
                return True
    return False

def is_username_valid(username):
    # Allow letters, numbers, spaces, and specific safe symbols
    return bool(re.match(r'^[a-zA-Z0-9 _\-❤★]+$', username))

from flask import Flask, send_from_directory, request, jsonify

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/pedarayudu')
def admin_panel():
    return send_from_directory('.', 'pedarayudu.html')

# SUPER ADMIN API
SUPER_ADMIN_PW = "PEDARAYUDU-2026"

def is_superadmin():
    return request.headers.get('Authorization') == SUPER_ADMIN_PW

@app.route('/api/admin/bans', methods=['GET'])
def get_bans():
    if not is_superadmin(): return jsonify({"error": "Unauthorized"}), 401
    return jsonify(db.get_all_bans())

@app.route('/api/admin/logs', methods=['GET'])
def get_logs():
    if not is_superadmin(): return jsonify({"error": "Unauthorized"}), 401
    return jsonify(db.get_admin_logs())

@app.route('/api/admin/ban', methods=['POST'])
def ban_user():
    if not is_superadmin(): return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    success = db.add_ban(data['user_id'], data['ip_address'], data.get('reason', 'Violation'), 'SuperAdmin')
    
    # Kick from active socket sessions
    for room, members in room_members.items():
        for sid, sdata in list(members.items()):
            if sdata.get('user_id') == data['user_id'] or sdata.get('ip') == data['ip_address']:
                sio.emit('login_error', {'message': 'You have been banned by the SuperAdmin.'}, room=sid)
                sio.disconnect(sid)
                
    db.log_admin_action('SuperAdmin', 'BAN', data)
    return jsonify({"success": success})

@app.route('/api/admin/unban', methods=['POST'])
def unban_user():
    if not is_superadmin(): return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    db.remove_ban(data['user_id'])
    db.log_admin_action('SuperAdmin', 'UNBAN', data)
    return jsonify({"success": True})

@sio.event
def connect(sid, environ, auth=None):
    ip_address = environ.get('REMOTE_ADDR', '127.0.0.1')
    token = auth.get('token') if auth else None
    
    user_payload = decode_jwt(token) if token else None
    if not user_payload:
        user_payload = {"user_id": str(uuid.uuid4()), "role": "guest"}
        
    if db.is_banned(user_payload['user_id'], ip_address):
        raise socketio.exceptions.ConnectionRefusedError("Banned")
        
    sio.save_session(sid, {
        'user_id': user_payload['user_id'], 
        'role': user_payload['role'], 
        'ip': ip_address
    })

@sio.event
def join_room(sid, data):
    room = data['room']
    username = data['username'].strip()
    
    if not is_username_valid(username):
        sio.emit('login_error', {'message': 'Username contains invalid special characters.'}, room=sid)
        return
        
    if is_username_taken(username):
        sio.emit('login_error', {'message': 'Username is already occupied. Please choose another.'}, room=sid)
        return

    peerId = data['peerId']
    avatar = data.get('avatar', '')
    interest = data.get('interest', 'Just chatting')
    
    sio.enter_room(sid, room)
    
    base_session = sio.get_session(sid)
    
    if db.is_banned(base_session['user_id'], base_session['ip']):
        sio.emit('login_error', {'message': 'You are banned.'}, room=sid)
        return
        
    # Check Mod Code
    if data.get('modCode') == 'MOD-2026':
        db.add_moderator(base_session['user_id'], username)
        base_session['role'] = 'moderator'
        
    if db.is_moderator(base_session['user_id']):
        base_session['role'] = 'moderator'
        
    # Issue fresh token
    new_token = encode_jwt({"user_id": base_session['user_id'], "role": base_session['role']})
    sio.emit('auth_token', {'token': new_token, 'role': base_session['role']}, room=sid)

    session_data = {
        'username': username, 
        'room': room, 
        'peerId': peerId, 
        'avatar': avatar,
        'interest': interest,
        'status': 'active',
        'color': data.get('color', '#0f172a'),
        'user_id': base_session['user_id'],
        'role': base_session['role'],
        'ip': base_session['ip']
    }
    sio.save_session(sid, session_data)

    if room not in room_members:
        room_members[room] = {}
    room_members[room][sid] = session_data

    sio.emit('login_success', session_data, room=sid)
    sio.emit('user-joined-peer', {'peerId': peerId}, room=room, skip_sid=sid)
    broadcast_roster(room)

@sio.event
def change_settings(sid, data):
    session = sio.get_session(sid)
    if not session: return

    room = session['room']
    new_username = data.get('username', '').strip()
    new_color = data.get('color')

    if new_username and new_username.lower() != session['username'].lower():
        if not is_username_valid(new_username):
            sio.emit('settings_error', {'message': 'Username contains invalid special characters.'}, room=sid)
            return
        if is_username_taken(new_username):
            sio.emit('settings_error', {'message': 'Username is already occupied.'}, room=sid)
            return
        session['username'] = new_username
        room_members[room][sid]['username'] = new_username

    if data.get('modCode') == 'MOD-2026':
        db.add_moderator(session['user_id'], session['username'])
        session['role'] = 'moderator'
        new_token = encode_jwt({"user_id": session['user_id'], "role": "moderator"})
        sio.emit('auth_token', {'token': new_token, 'role': 'moderator'}, room=sid)

    if new_color:
        session['color'] = new_color
        room_members[room][sid]['color'] = new_color
        
    sio.save_session(sid, session)
    sio.emit('settings_success', {'username': session['username'], 'color': session['color']}, room=sid)
    broadcast_roster(room)

@sio.event
def set_status(sid, data):
    session = sio.get_session(sid)
    if not session: return
    
    status = data.get('status', 'active') 
    room = session['room']
    
    if room in room_members and sid in room_members[room]:
        room_members[room][sid]['status'] = status
        session['status'] = status
        sio.save_session(sid, session)
        broadcast_roster(room)

@sio.event
def send_group_message(sid, data):
    session = sio.get_session(sid)
    if not session: return
    
    room = data.get('targetRoom', session.get('room')) 
    
    payload = {
        'id': data.get('id', ''),
        'sender': session['username'],
        'senderPeer': session['peerId'],
        'avatar': session['avatar'],
        'message': data['message'],
        'time': data.get('time', ''),
        'timestamp': data.get('timestamp', ''),
        'color': session.get('color', '#0f172a'),
        'channel': room,
        'replyTo': data.get('replyTo', None)
    }

    sio.emit('broadcast-message', payload, room=room, skip_sid=sid)

@sio.event
def send_reaction(sid, data):
    session = sio.get_session(sid)
    if not session: return
    room = data.get('targetRoom', session.get('room'))
    sio.emit('broadcast-reaction', data, room=room, skip_sid=sid)

@sio.event
def delete_group_msg(sid, data):
    session = sio.get_session(sid)
    if not session: return
    room = data.get('targetRoom', session.get('room'))
    sio.emit('broadcast-delete', data, room=room, skip_sid=sid)

@sio.event
def edit_group_msg(sid, data):
    session = sio.get_session(sid)
    if not session: return
    room = data.get('targetRoom', session.get('room'))
    sio.emit('broadcast-edit', data, room=room, skip_sid=sid)

@sio.event
def get_peers_signal(sid):
    session = sio.get_session(sid)
    if session:
        sio.emit('user-joined-peer', {'peerId': session['peerId']}, room=session['room'], skip_sid=sid)

@sio.event
def disconnect(sid):
    try:
        session = sio.get_session(sid)
        if not session: return
        room = session['room']
        
        sio.emit('user-disconnected-peer', {'peerId': session['peerId']}, room=room, skip_sid=sid)
        sio.leave_room(sid, room)
        
        if room in room_members and sid in room_members[room]:
            del room_members[room][sid]
            if not room_members[room]:
                del room_members[room]
                
        broadcast_roster(room)
    except Exception:
        pass

def broadcast_roster(room):
    if room in room_members:
        users = [data for data in room_members[room].values()]
        sio.emit('update-roster', users, room=room)
    else:
        sio.emit('update-roster', [], room=room)

if __name__ == '__main__':
    port = 5000
    url = f"http://127.0.0.1:{port}"
    print(f"Server running securely on LAN at 0.0.0.0:{port}")
    webbrowser.open(url)
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', port)), app, log_output=False)