import sqlite3
import os
import json
from datetime import datetime

class DatabaseRepository:
    """Base interface for database operations so we can easily swap to Firebase/Postgres later."""
    def setup(self): pass
    def add_ban(self, user_id, ip_address, reason, banned_by): pass
    def is_banned(self, user_id, ip_address): pass
    def remove_ban(self, user_id): pass
    def add_moderator(self, user_id, username): pass
    def is_moderator(self, user_id): pass
    def log_admin_action(self, admin_id, action_type, details): pass
    def get_all_bans(self): pass
    def get_admin_logs(self): pass


class SQLiteRepository(DatabaseRepository):
    """Local SQLite implementation for the MVP."""
    def __init__(self, db_path="comfychat.db"):
        self.db_path = db_path
        self.setup()

    def _get_conn(self):
        return sqlite3.connect(self.db_path)

    def setup(self):
        with self._get_conn() as conn:
            c = conn.cursor()
            # Banned Users Table
            c.execute('''
                CREATE TABLE IF NOT EXISTS banned_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT UNIQUE,
                    ip_address TEXT,
                    reason TEXT,
                    banned_by TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # Moderators Table
            c.execute('''
                CREATE TABLE IF NOT EXISTS moderators (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT UNIQUE,
                    username TEXT,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # Admin/Mod Logs Table
            c.execute('''
                CREATE TABLE IF NOT EXISTS admin_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_id TEXT,
                    action_type TEXT,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()

    def add_ban(self, user_id, ip_address, reason, banned_by):
        with self._get_conn() as conn:
            c = conn.cursor()
            try:
                c.execute('''
                    INSERT INTO banned_users (user_id, ip_address, reason, banned_by)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, ip_address, reason, banned_by))
                conn.commit()
                return True
            except sqlite3.IntegrityError:
                return False # Already banned

    def is_banned(self, user_id, ip_address):
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute('SELECT * FROM banned_users WHERE user_id = ? OR ip_address = ?', (user_id, ip_address))
            return c.fetchone() is not None

    def remove_ban(self, user_id):
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute('DELETE FROM banned_users WHERE user_id = ?', (user_id,))
            conn.commit()

    def add_moderator(self, user_id, username):
        with self._get_conn() as conn:
            c = conn.cursor()
            try:
                c.execute('INSERT INTO moderators (user_id, username) VALUES (?, ?)', (user_id, username))
                conn.commit()
                return True
            except sqlite3.IntegrityError:
                return False

    def is_moderator(self, user_id):
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute('SELECT * FROM moderators WHERE user_id = ?', (user_id,))
            return c.fetchone() is not None

    def log_admin_action(self, admin_id, action_type, details):
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute('INSERT INTO admin_logs (admin_id, action_type, details) VALUES (?, ?, ?)', 
                      (admin_id, action_type, json.dumps(details)))
            conn.commit()

    def get_all_bans(self):
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute('SELECT user_id, ip_address, reason, banned_by, timestamp FROM banned_users ORDER BY timestamp DESC')
            return [{"user_id": row[0], "ip_address": row[1], "reason": row[2], "banned_by": row[3], "timestamp": row[4]} for row in c.fetchall()]

    def get_admin_logs(self):
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute('SELECT admin_id, action_type, details, timestamp FROM admin_logs ORDER BY timestamp DESC LIMIT 100')
            return [{"admin_id": row[0], "action_type": row[1], "details": json.loads(row[2]), "timestamp": row[3]} for row in c.fetchall()]

# Expose a global db instance (can be swapped via env variables later)
db = SQLiteRepository()
