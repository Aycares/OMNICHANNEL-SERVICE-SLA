import asyncio
from datetime import datetime
import threading
import time
from app.database import get_db_connection

def check_and_escalate_slas():
    """Continuous sweeping engine tracking imminent contract breach horizons."""
    print("🕒 SLA Background Scheduler: Sweeping active priority queues...")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        current_time_str = datetime.utcnow().isoformat()
        
        # 1. Identify active open tickets that have passed their target SLA deadline
        cursor.execute("""
            SELECT id, customer_name FROM tickets 
            WHERE status = 'Open' AND is_escalated = 0 AND sla_deadline < ?
        """, (current_time_str,))
        breached_tickets = cursor.fetchall()
        
        for ticket in breached_tickets:
            print(f"🚨 SLA BREACH WARNING: Escalating Ticket #{ticket['id']} for [{ticket['customer_name']}]!")
            
            # 2. Automatically escalate priority state to Critical
            cursor.execute("""
                UPDATE tickets 
                SET is_escalated = 1, priority = 'Critical'
                WHERE id = ?
            """, (ticket['id'],))
            
        conn.commit()
    except Exception as e:
        print(f"❌ Background scheduler routine encountered an anomaly: {str(e)}")
    finally:
        conn.close()

def start_scheduler_loop():
    """Runs the SLA guard loop in an independent, non-blocking hardware thread."""
    def run_forever():
        while True:
            check_and_escalate_slas()
            # Sweep every 10 seconds to maintain tight operational metrics
            time.sleep(10)
            
    thread = threading.Thread(target=run_forever, daemon=True)
    thread.start()