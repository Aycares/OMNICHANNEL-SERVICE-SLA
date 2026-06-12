from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import json
import os
import shutil
import jwt
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from passlib.context import CryptContext
from app.scheduler import start_scheduler_loop
from app.database import init_db, get_db_connection, pwd_context
from app.models import SLA_TARGET_HOURS

app = FastAPI(title="Production-Grade Enterprise CRM with JWT Access Authentication", version="5.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOAD_DIR), name="static")

# 🔐 SECURITY CONSTANTS: Secret keys used to cryptographically sign our JWT tokens
JWT_SECRET = "SUPER_SECRET_PORTFOLIO_KEY_83912389"
JWT_ALGORITHM = "HS256"

security_bearer = HTTPBearer()

# Input validation schemas
class LoginPayload(BaseModel):
    email: str
    password: str

class TicketResolveInput(BaseModel):
    resolution_notes: str

# 🔐 MIDDLEWARE ACCELERATOR FUNCTIONS: Decodes token headers to protect data streams securely
def get_current_authenticated_user(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload # Returns dictionary containing: user_id, email, name, role
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Secure session expired or token signature corrupted.")

def send_email_notification(to_email: str, ticket_id: int, customer_name: str, message_body: str, message_type: str = "Update"):
    # Mock fallback print out if SMTP properties are unassigned
    print(f"📧 TRANSACTIONAL EMAIL ALERTER DISPATCHED TO {to_email} | Type: {message_type}")

@app.on_event("startup")
def on_startup():
    init_db()
    start_scheduler_loop()

# 🔐 ENCRYPTED AUTHENTICATION ENDPOINT
@app.post("/api/auth/login")
def login_user(payload: LoginPayload):
    clean_email = payload.email.lower().strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT email, hashed_password, name, role FROM users WHERE email = ?', (clean_email,))
    user = cursor.fetchone()
    conn.close()
    
    if not user or not pwd_context.verify(payload.password, user['hashed_password']):
        raise HTTPException(status_code=401, detail="Invalid credential records match. Please evaluate username/password indicators.")
    
    # Generate Token payload dictionary object securely signed for 2 hours
    token_duration = datetime.now(timezone.utc) + timedelta(hours=2)
    token_claims = {
        "email": user['email'],
        "name": user['name'],
        "role": user['role'],
        "exp": token_duration
    }
    
    encoded_jwt = jwt.encode(token_claims, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {
        "access_token": encoded_jwt,
        "token_type": "bearer",
        "userProfile": {
            "email": user['email'],
            "name": user['name'],
            "role": user['role']
        }
    }

@app.get("/api/tickets")
def get_tickets(current_user: dict = Depends(get_current_authenticated_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, customer_name, customer_email, complaint_text, priority, status, created_at, sla_deadline, is_escalated, resolution_notes, is_paused, paused_at, internal_logs FROM tickets ORDER BY id DESC')
    rows = cursor.fetchall()
    conn.close()
    
    tickets = []
    for row in rows:
        tickets.append({
            "id": row[0], "customer_name": row[1], "customer_email": str(row[2]).lower().strip() if row[2] else "",
            "complaint_text": row[3], "priority": row[4], "status": row[5], "created_at": row[6],
            "sla_deadline": row[7], "is_escalated": bool(row[8]), "resolution_notes": row[9] if row[9] else "",
            "is_paused": bool(row[10]), "paused_at": row[11] if row[11] else "", "internal_logs": json.loads(row[12]) if row[12] else []
        })
    return tickets

@app.post("/api/tickets", status_code=201)
def ingest_ticket(
    customer_name: str = Form(...),
    customer_email: str = Form(...),
    complaint_text: str = Form(...),
    priority: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_authenticated_user)
):
    created_at_dt = datetime.now(timezone.utc)
    allowed_hours = SLA_TARGET_HOURS.get(priority, 24)
    sla_deadline_dt = created_at_dt + timedelta(hours=allowed_hours)
    clean_email = customer_email.lower().strip()
    
    initial_logs = []
    if file and hasattr(file, "filename") and file.filename:
        file_path = os.path.join(UPLOAD_DIR, f"{int(created_at_dt.timestamp())}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_url = f"http://127.0.0.1:8001/static/{os.path.basename(file_path)}"
        initial_logs.append({
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "message": f"System: 📁 Initial intake attachment added to case files: {file.filename}",
            "attachment_url": file_url,
            "attachment_name": file.filename
        })
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO tickets (customer_name, customer_email, complaint_text, priority, status, created_at, sla_deadline, is_escalated, internal_logs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (customer_name, clean_email, complaint_text, priority, 'Pending', created_at_dt.isoformat(), sla_deadline_dt.isoformat(), 0, json.dumps(initial_logs)))
    conn.commit()
    ticket_id = cursor.lastrowid
    conn.close()
    return {"id": ticket_id, "message": "Ticket successfully ingested into CRM."}

@app.post("/api/tickets/{ticket_id}/log")
def append_internal_log(
    ticket_id: int, 
    message: str = Form(...),
    file: Optional[UploadFile] = File(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: dict = Depends(get_current_authenticated_user)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT internal_logs, customer_email, customer_name FROM tickets WHERE id = ?', (ticket_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    logs = json.loads(row[0]) if row[0] else []
    cust_email = str(row[1]).lower().strip() if row[1] else ""
    cust_name = row[2]
    
    file_url = None
    filename_str = None
    if file and hasattr(file, "filename") and file.filename:
        timestamp_prefix = int(datetime.now().timestamp())
        file_path = os.path.join(UPLOAD_DIR, f"{timestamp_prefix}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_url = f"http://127.0.0.1:8001/static/{os.path.basename(file_path)}"
        filename_str = file.filename

    log_node = {"timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "message": message}
    if file_url:
        log_node["attachment_url"] = file_url
        log_node["attachment_name"] = filename_str
    
    logs.append(log_node)
    cursor.execute('UPDATE tickets SET internal_logs = ? WHERE id = ?', (json.dumps(logs), ticket_id))
    conn.commit()
    conn.close()
    
    if message.startswith("Agent:") and cust_email:
        clean_text = message.replace("Agent: ", "")
        if file_url: clean_text += f"\n\n[Attachment Link: {file_url}]"
        background_tasks.add_task(send_email_notification, cust_email, ticket_id, cust_name, clean_text, "Agent Update")
        
    return {"message": "Log entry updated successfully."}

@app.put("/api/tickets/{ticket_id}/escalate")
def escalate_ticket(ticket_id: int, current_user: dict = Depends(get_current_authenticated_user)):
    if current_user["role"] != "Agent":
        raise HTTPException(status_code=403, detail="Access denied. Internal Note modification is protected.")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT priority, created_at, internal_logs FROM tickets WHERE id = ? AND status != "Resolved"', (ticket_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Active ticket not found for escalation path")

    current_priority = row[0]
    created_at_dt = datetime.fromisoformat(row[1])
    logs = json.loads(row[2]) if row[2] else []

    priority_ladder = {"Low": "Medium", "Medium": "High", "High": "Critical", "Critical": "Critical"}
    new_priority = priority_ladder.get(current_priority, "Critical")
    allowed_hours = SLA_TARGET_HOURS.get(new_priority, 1)
    new_sla_deadline_dt = created_at_dt + timedelta(hours=allowed_hours)

    logs.append({
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "message": f"Agent: ⚠️ CRITICAL ESCALATION RUNTIME TRIGGERED. Contract prioritized from {current_priority} to {new_priority}."
    })

    cursor.execute('UPDATE tickets SET priority = ?, sla_deadline = ?, is_escalated = 1, internal_logs = ? WHERE id = ?', (new_priority, new_sla_deadline_dt.isoformat(), json.dumps(logs), ticket_id))
    conn.commit()
    conn.close()
    return {"message": "Escalated"}

@app.put("/api/tickets/{ticket_id}/toggle-pause")
def toggle_sla_pause(ticket_id: int, current_user: dict = Depends(get_current_authenticated_user)):
    if current_user["role"] != "Agent":
        raise HTTPException(status_code=403, detail="Access denied.")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT is_paused, sla_deadline FROM tickets WHERE id = ? AND status != "Resolved"', (ticket_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Ticket not found or closed")
    
    current_pause = bool(row[0])
    deadline_dt = datetime.fromisoformat(row[1])
    now = datetime.now(timezone.utc)
    
    if not current_pause:
        cursor.execute('UPDATE tickets SET is_paused = 1, paused_at = ? WHERE id = ?', (now.isoformat(), ticket_id))
    else:
        cursor.execute('SELECT paused_at FROM tickets WHERE id = ?', (ticket_id,))
        paused_at_str = cursor.fetchone()[0]
        paused_duration = now - datetime.fromisoformat(paused_at_str)
        new_deadline = deadline_dt + paused_duration
        cursor.execute('UPDATE tickets SET is_paused = 0, paused_at = "", sla_deadline = ? WHERE id = ?', (new_deadline.isoformat(), ticket_id))
        
    conn.commit()
    conn.close()
    return {"message": "Pause mutated"}

@app.put("/api/tickets/{ticket_id}/reopen")
def reopen_ticket(ticket_id: int, current_user: dict = Depends(get_current_authenticated_user)):
    if current_user["role"] != "Agent": raise HTTPException(status_code=403, detail="Access denied.")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT internal_logs, priority FROM tickets WHERE id = ? AND status = "Resolved"', (ticket_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Closed ticket not found")

    logs = json.loads(row[0]) if row[0] else []
    priority = row[1]
    now = datetime.now(timezone.utc)
    allowed_hours = SLA_TARGET_HOURS.get(priority, 24)
    new_deadline = now + timedelta(hours=allowed_hours)

    logs.append({
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "message": "System: 🔓 TICKET RE-OPENED. Ticket removed from historical archives and routed back to live queue."
    })

    cursor.execute('UPDATE tickets SET status = "Pending", sla_deadline = ?, internal_logs = ?, resolution_notes = "" WHERE id = ?', (new_deadline.isoformat(), json.dumps(logs), ticket_id))
    conn.commit()
    conn.close()
    return {"message": "Ticket re-opened"}

@app.put("/api/tickets/{ticket_id}/resolve")
def resolve_ticket(ticket_id: int, resolve_data: TicketResolveInput, current_user: dict = Depends(get_current_authenticated_user)):
    if current_user["role"] != "Agent": raise HTTPException(status_code=403, detail="Access denied.")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE tickets SET status = "Resolved", is_paused = 0, resolution_notes = ? WHERE id = ?', (resolve_data.resolution_notes, ticket_id))
    conn.commit()
    conn.close()
    return {"message": "Ticket closed successfully."}