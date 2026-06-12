# Omnichannel CRM & SLA Orchestration Engine 🚀

A secure, high-performance full-stack Customer Relationship Management (CRM) platform and Service Level Agreement (SLA) monitoring terminal. This application is engineered with a decoupled architecture featuring an asynchronous **FastAPI (Python)** processing gateway and a **React (JavaScript)** single-page user workspace.

This repository features a **Frictionless Recruiter Demo Mode**, allowing engineering managers and reviewers to instantaneously toggle and simulate complex user roles via cryptographically signed tokens without creating throwaway accounts.

---

## 🏛️ System Architecture Workflow

```text
 [ React Frontend ]  ---> ( JWT Bearer Token ) ---> [ FastAPI Gateway ]
        |                                                    |
  (Multipart Forms)                                   (Bcrypt Context)
        |                                                    |
        v                                                    v
  [ Asset Uploads ]                                   [ SQLite DB Layer ]
                                                             |
                                                      (Async Workers)
                                                             v
                                                     [ SLA Clock Engine ]
✨ Core Engineering Features
🔐 Cryptographically Signed Access Layers: Full implementation of user authentication utilizing secure JSON Web Tokens (JWT) along with bcrypt salt-hashed password database hashing contexts.

⚡ Frictionless Recruiter Honeypot UI: One-click demo login hooks that instantaneously mount pre-populated backend database contexts for back-office support agents and retail customers.

⏲️ Real-Time SLA Background Clock: A dedicated background thread worker loop monitors ingestion intervals to update contract compliance metrics, handle target milestones, and evaluate tight breach constraints live.

📎 Multipart Attachment File Pipeline: Robust handling of streaming binary data files within both the initial inquiry ingestion forms and ongoing interactive activity log logs.

📬 Deterministic Data Sanitization: Enforces lowercase string trimming across lookup indices to eliminate structural whitespace anomalies during filtering operations.

🛠️ Tech Stack Matrix
Backend Core API
FastAPI (Python 3.x): High-performance asynchronous API framework.

SQLite3: Embedded relational storage engine with dynamic state mapping.

PyJWT: Secure JSON Web Token serialization and signature validation middleware.

Passlib (Bcrypt Engine): Industry-standard password hashing context.

Frontend Client Dashboard
React: Context-driven reactive view layer.

Vite: High-velocity frontend development module bundler.

HTML5 / CSS3: Fully custom-styled application workspace with zero external UI bloat.

🚀 Local Installation & Deployment Guide
1. Set Up the Backend Gateway
Bash
# Navigate into the backend root directory
cd backend

# Create and activate an isolated Python virtual environment
python -m venv venv
source venv/Scripts/activate  # On Windows PowerShell use: .\venv\Scripts\Activate.ps1

# Install strict package dependencies
pip install fastapi uvicorn PyJWT passlib[bcrypt] bcrypt==4.0.1

# Boot the development API instance
uvicorn app.main:app --reload --port 8001
2. Set Up the Frontend Interface
Bash
# Open a secondary terminal split and navigate to frontend
cd frontend

# Install package dependencies
npm install

# Spin up the local development engine
npm run dev
🎯 Verified Demo Accounts for Reviewers
Reviewers can test the system instantly using the interactive quick buttons on the landing page, or type in the following pre-seeded records:

👨‍💻 Back-Office Support Desk Profile:

Email: agent@demo.com

Password: demo123

👥 Customer Portal Interface Profile:

Email: customer@demo.com (or test historical search filters with topeadeleye83@gmail.com)

Password: demo123


---

### 🎨 What to do next:
Once you paste this into your GitHub editor and click **Commit changes**, it will render as a top-tier documentation layer directly on the repository landing page. 

Hiring managers will instantly see that you understand cryptography, systems architecture, file stream upl
