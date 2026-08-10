import os
import webbrowser
import eventlet
import socketio
import re
from flask import Flask, send_from_directory

sio = socketio.Server(cors_allowed_origins='*')
app = Flask(__name__, static_folder='.')
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

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@sio.event
def connect(sid, environ):
    pass 

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
    session_data = {
        'username': username, 
        'room': room, 
        'peerId': peerId, 
        'avatar': avatar,
        'interest': interest,
        'status': 'active',
        'color': data.get('color', '#0f172a')
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