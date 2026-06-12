import sqlite3
import os
import json
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext

DB_FILE = "sla_engine.db"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            complaint_text TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            created_at TEXT NOT NULL,
            sla_deadline TEXT NOT NULL,
            is_escalated INTEGER DEFAULT 0,
            resolution_notes TEXT,
            is_paused INTEGER DEFAULT 0,
            paused_at TEXT,
            internal_logs TEXT DEFAULT '[]'
        )
    ''');
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''');
    
    # Seed Demo Agent
    cursor.execute('SELECT id FROM users WHERE email = "agent@demo.com"')
    if not cursor.fetchone():
        cursor.execute('INSERT INTO users (email, hashed_password, name, role) VALUES (?, ?, ?, ?)',
                       ("agent@demo.com", pwd_context.hash("demo123"), "Demo Agent Officer", "Agent"))
        
    # Seed Demo Customer
    cursor.execute('SELECT id FROM users WHERE email = "customer@demo.com"')
    if not cursor.fetchone():
        cursor.execute('INSERT INTO users (email, hashed_password, name, role) VALUES (?, ?, ?, ?)',
                       ("customer@demo.com", pwd_context.hash("demo123"), "Tope Adeleye (Client)", "Client"))
        
    # 🚀 AUTOMATIC RECRUITER DATA ACCELERATOR SEEDING
    # If the system database is fresh, automatically write sample files so archives look complete immediately
    cursor.execute('SELECT id FROM tickets WHERE customer_email = "customer@demo.com" OR customer_email = "topeadeleye83@gmail.com"')
    if not cursor.fetchone():
        now_str = datetime.now(timezone.utc).isoformat()
        
        # Historical ticket 1
        sample_logs_1 = json.dumps([
            {"timestamp": "2026-06-12 10:15:00", "message": "Customer: Database memory overflow error detected on cloud core clusters."},
            {"timestamp": "2026-06-12 10:45:00", "message": "Agent: Patch applied safely. Re-indexing routines complete."}
        ])
        cursor.execute('''
            INSERT INTO tickets (customer_name, customer_email, complaint_text, priority, status, created_at, sla_deadline, resolution_notes, internal_logs)
            VALUES (?, ?, ?, ?, 'Resolved', ?, ?, ?, ?)
        ''', ("Alpha Core Labs", "customer@demo.com", "Database memory overflow error detected on cloud core clusters.", "High", now_str, now_str, "Applied kernel updates and optimized indexing clusters safely.", sample_logs_1))

        # Historical ticket 2
        sample_logs_2 = json.dumps([
            {"timestamp": "2026-06-11 14:00:00", "message": "Customer: API integration pipeline dropping connections intermittently."},
            {"timestamp": "2026-06-11 14:30:00", "message": "Agent: Verified network routing rules. Reset webhook endpoints."}
        ])
        cursor.execute('''
            INSERT INTO tickets (customer_name, customer_email, complaint_text, priority, status, created_at, sla_deadline, resolution_notes, internal_logs)
            VALUES (?, ?, ?, ?, 'Resolved', ?, ?, ?, ?)
        ''', ("Tope Labs Backend", "topeadeleye83@gmail.com", "API integration pipeline dropping connections intermittently.", "Medium", now_str, now_str, "Reset corporate reverse-proxy routing gateways.", sample_logs_2))

    conn.commit()
    conn.close()
    print("📢 Seeding routines completely protected and pre-populated with recruiter data files.")