from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

SLA_TARGET_HOURS = {
    "Critical": 1,
    "High": 4,
    "Medium": 24,
    "Low": 48
}

class TicketCreate(BaseModel):
    customer_name: str
    customer_email: EmailStr # Enforces a valid email syntax structure automatically
    complaint_text: str
    priority: str

class TicketResponse(BaseModel):
    id: int
    customer_name: str
    customer_email: str
    complaint_text: str
    priority: str
    status: str
    created_at: str
    sla_deadline: str
    is_escalated: bool
    resolution_notes: Optional[str] = ""