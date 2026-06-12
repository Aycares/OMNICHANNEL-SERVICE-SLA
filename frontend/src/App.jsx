import React, { useState, useEffect } from 'react';

function App() {
  const [tickets, setTickets] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [systemTime, setSystemTime] = useState(new Date());
  
  const [currentTab, setCurrentTab] = useState('Active'); 

  // AUTHENTICATION STATE DRIVERS
  const [authToken, setAuthToken] = useState(localStorage.getItem('crm_token') || null);
  const [loggedInUser, setLoggedInUser] = useState(JSON.parse(localStorage.getItem('crm_user')) || null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // 📬 RESTORED SEARCH SLICE: Pre-populated with the user's logged-in identity but fully editable
  const [clientFilterEmail, setClientFilterEmail] = useState('');

  const [intakeFile, setIntakeFile] = useState(null);
  const [logActionFile, setLogActionFile] = useState(null);

  const [activeLogTicketId, setActiveLogTicketId] = useState(null);
  const [newLogMessage, setNewLogMessage] = useState('');

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSystemTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update fallback filter whenever user shifts log-in identity blocks
  useEffect(() => {
    if (loggedInUser) {
      setClientFilterEmail(loggedInUser.email.toLowerCase().trim());
    }
  }, [loggedInUser]);

  const authenticatedFetch = async (url, options = {}) => {
    const headers = options.headers || {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return fetch(url, { ...options, headers });
  };

  const fetchTickets = async () => {
    if (!authToken) return;
    try {
      const response = await authenticatedFetch('http://127.0.0.1:8001/api/tickets');
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTickets();
    const syncInterval = setInterval(fetchTickets, 3000);
    return () => clearInterval(syncInterval);
  }, [authToken]);

  const handleLoginSubmit = async (e, demoEmail = null, demoPassword = null) => {
    if (e) e.preventDefault();
    setAuthError('');
    
    const emailToPost = demoEmail || loginEmail;
    const passwordToPost = demoPassword || loginPassword;

    try {
      const response = await fetch('http://127.0.0.1:8001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToPost, password: passwordToPost })
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('crm_token', data.access_token);
        localStorage.setItem('crm_user', JSON.stringify(data.userProfile));
        setAuthToken(data.access_token);
        setLoggedInUser(data.userProfile);
      } else {
        const err = await response.json();
        setAuthError(err.detail || "Authentication validation dropped.");
      }
    } catch (error) {
      setAuthError("Could not connect to back-office authentication gateway.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setAuthToken(null);
    setLoggedInUser(null);
    setClientFilterEmail('');
    setTickets([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !customerEmail.trim() || !complaintText.trim()) return;

    const formData = new FormData();
    formData.append('customer_name', customerName.trim());
    formData.append('customer_email', customerEmail.toLowerCase().trim());
    formData.append('complaint_text', complaintText.trim());
    formData.append('priority', priority);
    if (intakeFile) formData.append('file', intakeFile);

    try {
      const response = await authenticatedFetch('http://127.0.0.1:8001/api/tickets', {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        setCustomerName(''); setCustomerEmail(''); setComplaintText(''); setIntakeFile(null);
        const fileInput = document.getElementById('intake-file-element');
        if (fileInput) fileInput.value = '';
        fetchTickets();
      }
    } catch (error) { console.error(error); }
  };

  const handleAddLog = async (ticketId, senderOverride) => {
    const finalSender = senderOverride || (loggedInUser.role === 'Agent' ? 'Agent' : 'Customer');
    if (!newLogMessage.trim()) return;

    const formData = new FormData();
    formData.append('message', `${finalSender}: ${newLogMessage.trim()}`);
    if (logActionFile) formData.append('file', logActionFile);

    try {
      const response = await authenticatedFetch(`http://127.0.0.1:8001/api/tickets/${ticketId}/log`, {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        setNewLogMessage(''); setLogActionFile(null); setActiveLogTicketId(null);
        const fileInput = document.getElementById(`chat-file-${ticketId}`);
        if (fileInput) fileInput.value = '';
        fetchTickets();
      }
    } catch (error) { console.error(error); }
  };

  const handleEscalateTicket = async (ticketId) => {
    try {
      const response = await authenticatedFetch(`http://127.0.0.1:8001/api/tickets/${ticketId}/escalate`, { method: 'PUT' });
      if (response.ok) fetchTickets();
    } catch (error) { console.error(error); }
  };

  const handleTogglePause = async (ticketId) => {
    try {
      const response = await authenticatedFetch(`http://127.0.0.1:8001/api/tickets/${ticketId}/toggle-pause`, { method: 'PUT' });
      if (response.ok) fetchTickets();
    } catch (error) { console.error(error); }
  };

  const handleReopenTicket = async (ticketId) => {
    try {
      const response = await authenticatedFetch(`http://127.0.0.1:8001/api/tickets/${ticketId}/reopen`, { method: 'PUT' });
      if (response.ok) fetchTickets();
    } catch (error) { console.error(error); }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolutionNotes.trim()) return;
    try {
      const response = await authenticatedFetch(`http://127.0.0.1:8001/api/tickets/${selectedTicketId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_notes: resolutionNotes.trim() })
      });
      if (response.ok) {
        setShowModal(false); setResolutionNotes(''); setSelectedTicketId(null); fetchTickets();
      }
    } catch (error) { console.error(error); }
  };

  const getRemainingTime = (ticket) => {
    if (ticket.status === 'Resolved') return { text: 'Fulfilled', color: '#10B981' };
    if (ticket.is_paused) return { text: 'SLA ON HOLD', color: '#6B7280' };
    
    const diff = new Date(ticket.sla_deadline) - systemTime;
    if (diff <= 0) return { text: 'BREACHED CONTRACT', color: '#EF4444' };

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    let displayString = `${mins}m ${secs}s`;
    if (hours > 0) displayString = `${hours}h ` + displayString;

    let color = '#3B82F6';
    if (hours === 0 && mins < 15) color = '#F59E0B';

    return { text: displayString, color };
  };

  if (!authToken || !loggedInUser) {
    return (
      <div style={{ fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#111827', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', color: '#F9FAFB' }}>
        <div style={{ backgroundColor: '#1F2937', padding: '40px', borderRadius: '12px', width: '450px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid #374151' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ margin: 0, fontSize: '26px', color: '#3B82F6' }}>Secure CRM Support Engine</h1>
            <p style={{ margin: '6px 0 0 0', color: '#9CA3AF', fontSize: '14px' }}>Enterprise Framework with JWT Token Authentication Layers</p>
          </div>

          <div style={{ backgroundColor: '#111827', padding: '16px', borderRadius: '8px', marginBottom: '24px', borderLeft: '4px solid #F59E0B' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#F59E0B', display: 'block', marginBottom: '10px' }}>⚡ ONE-CLICK RECRUITER DEMO ENTRY:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button type="button" onClick={() => handleLoginSubmit(null, "agent@demo.com", "demo123")} style={{ width: '100%', padding: '10px', backgroundColor: '#374151', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                <span>👨‍💻 Access Support Desk Workspace</span> <span style={{ color: '#60A5FA' }}>[Agent Profile] →</span>
              </button>
              <button type="button" onClick={() => handleLoginSubmit(null, "customer@demo.com", "demo123")} style={{ width: '100%', padding: '10px', backgroundColor: '#374151', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                <span>👥 Access Customer Inquiry Portal</span> <span style={{ color: '#38BDF8' }}>[Client Profile] →</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#4B5563' }}><hr style={{ flex: 1, border: 'none', borderTop: '1px solid #374151' }} /><span style={{ padding: '0 10px', fontSize: '12px' }}>OR SECURE LOGIN</span><hr style={{ flex: 1, border: 'none', borderTop: '1px solid #374151' }} /></div>

          {authError && <div style={{ backgroundColor: '#EF4444', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontWeight: 'bold' }}>⚠️ {authError}</div>}

          <form onSubmit={(e) => handleLoginSubmit(e)}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '6px', fontWeight: 'bold' }}>Email Address</label>
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', backgroundColor: '#111827', border: '1px solid #4B5563', borderRadius: '6px', color: '#FFF' }} placeholder="agent@demo.com" required />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '6px', fontWeight: 'bold' }}>Account Password</label>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', backgroundColor: '#111827', border: '1px solid #4B5563', borderRadius: '6px', color: '#FFF' }} placeholder="••••••••" required />
            </div>
            <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>Authenticate System Access</button>
          </form>
        </div>
      </div>
    );
  }

  const totalTickets = tickets.length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;
  const breachedCount = tickets.filter(t => t.status !== 'Resolved' && !t.is_paused && (new Date(t.sla_deadline) - systemTime <= 0)).length;
  const pendingCount = totalTickets - resolvedCount - breachedCount;

  // 🛠️ ADVANCED DUAL ROUTING STRING MATRIX
  const visibleTickets = tickets.filter(t => {
    const matchTab = currentTab === 'Active' ? t.status !== 'Resolved' : t.status === 'Resolved';
    if (!matchTab) return false;
    
    // Support Desk role lets everything pass
    if (loggedInUser.role === 'Agent') return true;
    
    // Customer Portal mode queries the database records using the explicit, editable real-time filter value
    if (!clientFilterEmail) return false;
    return t.customer_email && t.customer_email.toLowerCase().trim() === clientFilterEmail.toLowerCase().trim();
  });

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F3F4F6', minHeight: '100vh', padding: '24px', color: '#1F2937' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#FFF', padding: '12px 24px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', alignItems: 'center' }}>
        <div>
          <span>🟢 Securely Connected as: <strong>{loggedInUser.name}</strong></span>
          <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '10px' }}>({loggedInUser.email} - <strong style={{ color: loggedInUser.role === 'Agent' ? '#2563EB' : '#0EA5E9' }}>{loggedInUser.role} Account Profile</strong>)</span>
        </div>
        <button type="button" onClick={handleLogout} style={{ padding: '6px 14px', backgroundColor: '#EF4444', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🔒 Disconnect Session</button>
      </div>

      <header style={{ backgroundColor: loggedInUser.role === 'Agent' ? '#1F2937' : '#0EA5E9', padding: '20px', borderRadius: '8px', marginBottom: '24px', color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>{loggedInUser.role === 'Agent' ? 'Omnichannel CRM Support Desk Console' : 'Secure Customer Care Inquiry Portal'}</h1>
          <p style={{ margin: '4px 0 0 0', color: loggedInUser.role === 'Agent' ? '#9CA3AF' : '#E0F2FE' }}>JWT Token Secured Transactional Operation Environment Workspace</p>
        </div>
        <div style={{ fontSize: '14px', backgroundColor: loggedInUser.role === 'Agent' ? '#374151' : '#0369A1', padding: '8px 16px', borderRadius: '6px' }}>Clock: <strong>{systemTime.toLocaleTimeString()}</strong></div>
      </header>

      {loggedInUser.role === 'Agent' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#FFF', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #2563EB', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 'bold' }}>TOTAL LIFE SYSTEM INGESTIONS</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>{totalTickets}</div>
          </div>
          <div style={{ backgroundColor: '#FFF', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #10B981', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '12px', color: '#10B981', fontWeight: 'bold' }}>FULFILLED CLOSURES (SLA SAFE)</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>{resolvedCount}</div>
          </div>
          <div style={{ backgroundColor: '#FFF', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #F59E0B', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '12px', color: '#F59E0B', fontWeight: 'bold' }}>IN-FLIGHT PENDING STEWARDSHIP</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>{pendingCount}</div>
          </div>
          <div style={{ backgroundColor: '#FFF', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #EF4444', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: 'bold' }}>CONTRACT COMPLIANCE BREACHES</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>{breachedCount}</div>
          </div>
        </div>
      )}

      {/* 📬 100% RESTORED INTERACTIVE SEARCH FILTER SLICE FOR CUSTOMERS */}
      {loggedInUser.role === 'Client' && (
        <div style={{ backgroundColor: '#FFF', padding: '16px', borderRadius: '8px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#4B5563' }}>📬 Current Search Target Account Email (Editable):</span>
          <input type="email" value={clientFilterEmail} onChange={(e) => setClientFilterEmail(e.target.value.toLowerCase().trim())} style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #D1D5DB', width: '300px', backgroundColor: '#FFF', color: '#1F2937' }} placeholder="customer@demo.com" />
          {clientFilterEmail && <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 'bold' }}>🟢 Filtering live records matching {clientFilterEmail}</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <button type="button" onClick={() => setCurrentTab('Active')} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: currentTab === 'Active' ? (loggedInUser.role === 'Agent' ? '#2563EB' : '#0EA5E9') : '#E5E7EB', color: currentTab === 'Active' ? '#FFF' : '#4B5563' }}>{loggedInUser.role === 'Agent' ? 'Active Operations Queue Panel' : 'My Active Open Issues'}</button>
        <button type="button" onClick={() => setCurrentTab('Archive')} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: currentTab === 'Archive' ? '#10B981' : '#E5E7EB', color: currentTab === 'Archive' ? '#FFF' : '#4B5563' }}>{loggedInUser.role === 'Agent' ? 'Historical Closed Archives View' : 'My Past Resolved Inquiries'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div style={{ backgroundColor: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: 'fit-content' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px', borderBottom: '2px solid #E5E7EB', paddingBottom: '8px' }}>{loggedInUser.role === 'Agent' ? 'Ingest Complaint Ticket' : 'Submit a New Support Request'}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px', marginTop: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#4B5563' }}>Corporate / Customer Name</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #9CA3AF', backgroundColor: '#FFF', color: '#1F2937' }} placeholder="Alpha Core Labs" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#4B5563' }}>Contact Email Address</label>
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #9CA3AF', backgroundColor: '#FFF', color: '#1F2937' }} placeholder="customer@demo.com" />
            </div>

            {loggedInUser.role === 'Agent' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#4B5563' }}>SLA Priority Tier Contract</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #9CA3AF', backgroundColor: '#FFF', color: '#1F2937' }}>
                  <option value="Low">Low Tier (48h Window)</option>
                  <option value="Medium">Medium Tier (24h Window)</option>
                  <option value="High">High Tier (4h Window)</option>
                  <option value="Critical">Critical Tier (1h Window)</option>
                </select>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#4B5563' }}>Describe the Issue in Detail</label>
              <textarea value={complaintText} onChange={(e) => setComplaintText(e.target.value)} rows="3" style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #9CA3AF', backgroundColor: '#FFF', color: '#1F2937' }} placeholder="Provide explicitly detailed inquiry variables..."></textarea>
            </div>
            <div style={{ marginBottom: '16px', backgroundColor: '#F3F4F6', padding: '10px', borderRadius: '4px', border: '1px dashed #D1D5DB' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px', color: '#4B5563' }}>📎 Attach reference files (Optional)</label>
              <input id="intake-file-element" type="file" onChange={(e) => setIntakeFile(e.target.files[0])} style={{ fontSize: '12px', color: '#1F2937' }} />
            </div>
            <button type="submit" style={{ width: '100%', backgroundColor: loggedInUser.role === 'Agent' ? '#2563EB' : '#0EA5E9', color: '#FFF', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>{loggedInUser.role === 'Agent' ? 'Dispatch Into Active Queue' : 'Submit Request to Engineering'}</button>
          </form>
        </div>

        <div style={{ backgroundColor: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px', borderBottom: '2px solid #E5E7EB', paddingBottom: '8px' }}>{loggedInUser.role === 'Agent' ? `${currentTab} Workspace Monitor` : (currentTab === 'Active' ? 'My Active Open Cases' : 'My Past Resolved Archive Inquiries')}</h2>
          {visibleTickets.length === 0 ? (
            <p style={{ color: '#6B7280', textAlign: 'center', padding: '40px' }}>No matching data records found inside this view panel category.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              {visibleTickets.map((ticket) => {
                const timerState = getRemainingTime(ticket);
                const needsAttention = ticket.internal_logs && ticket.internal_logs.length > 0 && ticket.internal_logs[ticket.internal_logs.length - 1].message.startsWith('Customer:');

                return (
                  <div key={ticket.id} style={{ padding: '16px', border: '1px solid #E5E7EB', borderRadius: '6px', backgroundColor: ticket.status === 'Resolved' ? '#F0FDF4' : ticket.is_paused ? '#F3F4F6' : (ticket.priority === 'Critical' && loggedInUser.role === 'Agent') ? '#FEF2F2' : '#FFF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>#{ticket.id} {ticket.customer_name}</span>
                          {loggedInUser.role === 'Agent' && <span style={{ fontSize: '11px', color: '#6B7280' }}>({ticket.customer_email})</span>}
                          {loggedInUser.role === 'Agent' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', backgroundColor: ticket.status === 'Resolved' ? '#10B981' : ticket.priority === 'Critical' ? '#EF4444' : '#9CA3AF', color: '#FFF' }}>{ticket.priority}</span>}
                          {ticket.is_paused && loggedInUser.role === 'Agent' && <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', backgroundColor: '#6B7280', color: '#FFF' }}>⏸️ SLA HOLD</span>}
                          {ticket.is_escalated && ticket.status !== 'Resolved' && loggedInUser.role === 'Agent' && <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', backgroundColor: '#7C3AED', color: '#FFF' }}>⚠️ ESCALATED</span>}
                          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', backgroundColor: ticket.status === 'Resolved' ? '#10B981' : '#F59E0B', color: '#FFF' }}>{ticket.status === 'Resolved' ? 'Closed & Resolved' : 'Processing Log...'}</span>
                          {needsAttention && ticket.status !== 'Resolved' && loggedInUser.role === 'Agent' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', backgroundColor: '#10B981', color: '#FFF' }}>🟢 REPLY</span>}
                        </div>
                        <p style={{ margin: '6px 0 0 0', color: '#4B5563', fontSize: '14px' }}><strong>Inquiry Details:</strong> {ticket.complaint_text}</p>
                      </div>
                      {loggedInUser.role === 'Agent' && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: timerState.color }}>{timerState.text}</div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>Target: {new Date(ticket.sla_deadline).toLocaleTimeString()}</div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '4px', padding: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 'bold', marginBottom: '6px' }}>Interactive Activity Logs & Communications</div>
                      {ticket.internal_logs && ticket.internal_logs.map((log, idx) => {
                        const isSystemEscalation = log.message.includes('⚠️ CRITICAL ESCALATION RUNTIME');
                        const isSystemReopen = log.message.includes('System: 🔓 TICKET RE-OPENED');
                        const isCustomer = log.message.startsWith('Customer:');
                        const cleanMsg = log.message.replace(/^(Agent:|Customer:|System:)\s*/, '');
                        
                        if (loggedInUser.role === 'Client' && (isSystemEscalation || isSystemReopen)) return null;

                        let badgeText = 'Internal Note'; let bgBoxColor = '#F3F4F6'; let boundaryBorder = '3px solid #9CA3AF';
                        if (isCustomer) {
                          badgeText = loggedInUser.role === 'Client' ? '💬 My Response' : '👥 Customer Response'; bgBoxColor = '#E0F2FE'; boundaryBorder = '3px solid #0EA5E9';
                        } else if (isSystemEscalation || isSystemReopen) {
                          badgeText = '🚨 Core System Notification'; bgBoxColor = '#F3E8FF'; boundaryBorder = '3px solid #7C3AED';
                        } else if (log.message.startsWith("Agent:")) {
                          badgeText = loggedInUser.role === 'Client' ? '👨‍💻 Message From Helpdesk' : '📧 Sent Directly to Client Email'; bgBoxColor = '#FEF3C7'; boundaryBorder = '3px solid #F59E0B';
                        }

                        return (
                          <div key={idx} style={{ fontSize: '13px', padding: '6px 8px', borderRadius: '4px', backgroundColor: bgBoxColor, marginBottom: '4px', borderLeft: boundaryBorder }}>
                            <span style={{ color: '#6B7280', fontSize: '11px', display: 'block' }}>[{log.timestamp}] <strong>{badgeText}</strong></span>
                            <div style={{ marginTop: '2px', color: '#1F2937' }}>{cleanMsg}</div>
                            {log.attachment_url && (
                              <div style={{ marginTop: '6px', fontSize: '12px' }}>
                                <a href={log.attachment_url} target="_blank" rel="noreferrer" style={{ color: '#2563EB', fontWeight: 'bold', textDecoration: 'underline' }}>📥 Download Attachment File: {log.attachment_name}</a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {ticket.status !== 'Resolved' && (
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', borderTop: '1px dashed #E5E7EB', paddingTop: '8px' }}>
                          <input type="text" placeholder={loggedInUser.role === 'Agent' ? "Type message content to send straight to customer..." : "Type custom update reply details to helpdesk..."} value={activeLogTicketId === ticket.id ? newLogMessage : ''} onChange={(e) => { setActiveLogTicketId(ticket.id); setNewLogMessage(e.target.value); }} style={{ flex: 1, padding: '6px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '4px', backgroundColor: '#FFF', color: '#1F2937' }} />
                          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#E5E7EB', padding: '2px 8px', borderRadius: '4px' }}>
                            <input type="file" id={`chat-file-${ticket.id}`} onChange={(e) => { setActiveLogTicketId(ticket.id); setLogActionFile(e.target.files[0]); }} style={{ fontSize: '11px', width: '160px' }} />
                          </div>
                          <button type="button" onClick={() => handleAddLog(ticket.id, loggedInUser.role === 'Agent' ? 'Agent' : 'Customer')} style={{ backgroundColor: loggedInUser.role === 'Agent' ? '#F59E0B' : '#0EA5E9', color: loggedInUser.role === 'Agent' ? '#1F2937' : '#FFF', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Submit Update</button>
                        </div>
                      )}
                    </div>

                    {ticket.status === 'Resolved' && (
                      <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#DCFCE7', borderRadius: '4px', border: '1px solid #BBF7D0', fontSize: '13px', color: '#166534' }}>
                        <strong>Final Resolution Close Note:</strong> {ticket.resolution_notes}
                      </div>
                    )}

                    {loggedInUser.role === 'Agent' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', borderTop: '1px solid #F3F4F6', paddingTop: '8px' }}>
                        {ticket.status !== 'Resolved' ? (
                          <>
                            {ticket.priority !== 'Critical' && <button type="button" onClick={() => handleEscalateTicket(ticket.id)} style={{ backgroundColor: '#7C3AED', color: '#FFF', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>⚠️ Escalate Case</button>}
                            <button type="button" onClick={() => handleTogglePause(ticket.id)} style={{ backgroundColor: ticket.is_paused ? '#3B82F6' : '#F59E0B', color: '#FFF', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>{ticket.is_paused ? '▶️ Resume SLA' : '⏸️ Put SLA Hold'}</button>
                            <button type="button" onClick={() => { setSelectedTicketId(ticket.id); setShowModal(true); }} style={{ backgroundColor: '#10B981', color: '#FFF', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>🔒 Mark Resolved</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => handleReopenTicket(ticket.id)} style={{ backgroundColor: '#2563EB', color: '#FFF', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>🔄 Re-open & Modify Logs</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#FFF', padding: '24px', borderRadius: '8px', width: '400px' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #E5E7EB', paddingBottom: '10px' }}>Close Ticket Protocol (#{selectedTicketId})</h3>
            <form onSubmit={handleResolveSubmit}>
              <div style={{ marginBottom: '16px', marginTop: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>Provide Explicit Final Remediation Actions</label>
                <textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows="3" required placeholder="e.g., Account verified manually." style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #9CA3AF', backgroundColor: '#FFF', color: '#1F2937' }}></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => { setShowModal(false); setResolutionNotes(''); }} style={{ padding: '8px 12px', backgroundColor: '#9CA3AF', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 12px', backgroundColor: '#10B981', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Commit Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;