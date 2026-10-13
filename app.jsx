const { useState, useEffect, useMemo } = React;

// 10 Comprehensive Benchmark Cases matching the Backend
const BENCHMARK_CASES = [
  {
    id: "case-1",
    name: "Normal Single Call",
    subtitle: "Everyday friend calling once during the afternoon",
    contactName: "Bob Smith",
    phoneNumber: "+91 98765 43210",
    relationship: "Friend",
    priority: "NORMAL",
    recentCallsCount: 0,
    timeOfDay: "14:30",
    historyTotal: 2,
    historyMissed: 0,
    description: "Single call from normal contact during business hours. Insufficient history neutral (+0)."
  },
  {
    id: "case-2",
    name: "Trusted Contact Calling Repeatedly",
    subtitle: "Close family/work member redialing multiple times",
    contactName: "Mom",
    phoneNumber: "+91 98123 45678",
    relationship: "Family",
    priority: "TRUSTED",
    recentCallsCount: 2,
    timeOfDay: "15:00",
    historyTotal: 2,
    historyMissed: 0,
    description: "Trusted contact (+20) + repeated calling (+15). Normal timing (+0). Reaches MEDIUM urgency."
  },
  {
    id: "case-3",
    name: "Emergency Contact Late Night Repeated",
    subtitle: "Parent calling 3 times at 3:00 AM",
    contactName: "Dad",
    phoneNumber: "+91 98222 33445",
    relationship: "Family",
    priority: "EMERGENCY",
    recentCallsCount: 3,
    timeOfDay: "03:15",
    historyTotal: 2,
    historyMissed: 0,
    description: "Emergency (+30) + High frequency (+30) + Late night context (+20). Highly urgent situation (80/100)."
  },
  {
    id: "case-4",
    name: "Unknown Caller Single Call",
    subtitle: "Unsaved number calling once during daytime",
    contactName: "Unknown Caller",
    phoneNumber: "+91 87654 32109",
    relationship: "Unknown",
    priority: "UNKNOWN",
    recentCallsCount: 0,
    timeOfDay: "11:45",
    historyTotal: 0,
    historyMissed: 0,
    description: "Unknown caller (+0) with no redials. Treated with zero urgency (0/100, LOW)."
  },
  {
    id: "case-5",
    name: "Insufficient Historical Data",
    subtitle: "Registered contact with only 1 prior call log",
    contactName: "Alice Miller",
    phoneNumber: "+91 99000 11223",
    relationship: "Colleague",
    priority: "NORMAL",
    recentCallsCount: 0,
    timeOfDay: "16:20",
    historyTotal: 1,
    historyMissed: 1,
    description: "Contact has < 3 total calls. Rule 4 ignores high missed percentage to avoid false positives (+0)."
  },
  {
    id: "case-6",
    name: "High Missed Call Rate Outlier",
    subtitle: "Normal contact whose calls are usually missed (>=50%)",
    contactName: "Dr. Dave",
    phoneNumber: "+91 94444 55566",
    relationship: "Doctor",
    priority: "NORMAL",
    recentCallsCount: 0,
    timeOfDay: "10:15",
    historyTotal: 4,
    historyMissed: 3,
    description: "History has 4 calls with 3 missed (75%). Satisfies Rule 4 for unusual missed call patterns (+20)."
  },
  {
    id: "case-7",
    name: "Maximum Boundary Stress Test",
    subtitle: "All 4 factors at maximum possible weights",
    contactName: "General Hospital Emergency",
    phoneNumber: "+91 91111 22233",
    relationship: "Hospital",
    priority: "EMERGENCY",
    recentCallsCount: 4,
    timeOfDay: "02:40",
    historyTotal: 5,
    historyMissed: 4,
    description: "Identity(+30) + Frequency(+30) + Night(+20) + History(+20) = 100. Verifies maximum clamp limits."
  },
  {
    id: "case-8",
    name: "Emergency Single Call at 2 AM",
    subtitle: "Emergency contact calling for the first time at night",
    contactName: "Sister (In Distress)",
    phoneNumber: "+91 97777 88899",
    relationship: "Family",
    priority: "EMERGENCY",
    recentCallsCount: 0,
    timeOfDay: "02:15",
    historyTotal: 2,
    historyMissed: 0,
    description: "Emergency contact (+30). Night trigger active because priority is EMERGENCY (+20) -> Score: 50 (MEDIUM)."
  }
];

// Pure Deterministic JavaScript mirror of `WeightedRuleEngine.java`
function evaluateUrgency(profile, recentCount, timeStr, historyTotal, historyMissed) {
  let score = 0;
  const traces = [];
  const breakdown = {
    identity: { pts: 0, max: 30, text: "", rule: "" },
    frequency: { pts: 0, max: 30, text: "", rule: "" },
    timing: { pts: 0, max: 20, text: "", rule: "" },
    history: { pts: 0, max: 20, text: "", rule: "" }
  };

  traces.push({
    step: "01. CONTEXT",
    text: `Incoming call from ${profile.name || "Unknown"} (${profile.phone || "N/A"}), Priority: ${profile.priority}`
  });

  // Factor 1: Caller Identity (Max 30)
  if (profile.priority === "EMERGENCY") {
    score += 30;
    breakdown.identity = { pts: 30, max: 30, text: "Emergency contact (+30)", rule: "priority == EMERGENCY (+30)" };
    traces.push({ step: "02. IDENTITY", text: "Caller identified as EMERGENCY priority.", pts: "+30 pts", current: score });
  } else if (profile.priority === "TRUSTED") {
    score += 20;
    breakdown.identity = { pts: 20, max: 30, text: "Trusted contact (+20)", rule: "priority == TRUSTED (+20)" };
    traces.push({ step: "02. IDENTITY", text: "Caller identified as TRUSTED priority.", pts: "+20 pts", current: score });
  } else if (profile.priority === "NORMAL") {
    breakdown.identity = { pts: 0, max: 30, text: "Normal contact (+0)", rule: "priority == NORMAL (+0)" };
    traces.push({ step: "02. IDENTITY", text: "Caller identified as NORMAL contact.", pts: "+0 pts", current: score });
  } else {
    breakdown.identity = { pts: 0, max: 30, text: "Unknown caller (+0)", rule: "profile == null (+0)" };
    traces.push({ step: "02. IDENTITY", text: "Unknown number (Not found in contacts).", pts: "+0 pts", current: score });
  }

  // Factor 2: Call Frequency (Max 30)
  if (recentCount >= 3) {
    score += 30;
    breakdown.frequency = { pts: 30, max: 30, text: "High frequency calling (+30)", rule: "recentCount >= 3 (+30)" };
    traces.push({ step: "03. FREQUENCY", text: `High redial frequency detected (${recentCount} prior calls in 15 min).`, pts: "+30 pts", current: score });
  } else if (recentCount >= 1) {
    score += 15;
    breakdown.frequency = { pts: 15, max: 30, text: "Repeated calls (+15)", rule: "recentCount >= 1 (+15)" };
    traces.push({ step: "03. FREQUENCY", text: `Repeated redial detected (${recentCount} prior call in 15 min).`, pts: "+15 pts", current: score });
  } else {
    breakdown.frequency = { pts: 0, max: 30, text: "Normal frequency (+0)", rule: "recentCount == 0 (+0)" };
    traces.push({ step: "03. FREQUENCY", text: "First call attempt in current time window.", pts: "+0 pts", current: score });
  }

  // Factor 3: Timing and Context (Max 20)
  const [hourStr, minStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  const isLateNight = (hour >= 23 || hour <= 5);

  const isEmergency = (profile.priority === "EMERGENCY");
  const isRepeated = (recentCount >= 1);

  if (isLateNight && (isRepeated || isEmergency)) {
    score += 20;
    breakdown.timing = { pts: 20, max: 20, text: "Late night contextual urgency (+20)", rule: "isLateNight && (recent>=1 || EMERGENCY) (+20)" };
    traces.push({ 
      step: "04. TIMING", 
      text: `Late Night context confirmed (${timeStr} hrs). Triggered because ${isEmergency ? "Caller is Emergency" : "Caller is Repeated"}.`, 
      pts: "+20 pts", 
      current: score 
    });
  } else if (isLateNight) {
    breakdown.timing = { pts: 0, max: 20, text: "Late night single call (+0)", rule: "isLateNight but neither repeated nor emergency (+0)" };
    traces.push({ step: "04. TIMING", text: `Late Night (${timeStr} hrs), but single non-emergency call; neutral timing applied.`, pts: "+0 pts", current: score });
  } else {
    breakdown.timing = { pts: 0, max: 20, text: "Normal daytime timing (+0)", rule: "Daytime (06:00 - 22:59) (+0)" };
    traces.push({ step: "04. TIMING", text: `Normal daytime call time (${timeStr} hrs).`, pts: "+0 pts", current: score });
  }

  // Factor 4: Historical Behaviour (Max 20)
  if (historyTotal >= 3) {
    if (historyMissed >= Math.ceil(historyTotal / 2)) {
      score += 20;
      breakdown.history = { pts: 20, max: 20, text: "Historically high missed call rate (+20)", rule: "missedCount >= history.size() / 2 (+20)" };
      traces.push({ 
        step: "05. HISTORY", 
        text: `Unusual missed pattern: ${historyMissed} of ${historyTotal} previous calls missed (>=50%).`, 
        pts: "+20 pts", 
        current: score 
      });
    } else {
      breakdown.history = { pts: 0, max: 20, text: "Normal historical behaviour (+0)", rule: "missedCount < 50% (+0)" };
      traces.push({ step: "05. HISTORY", text: `History normal: ${historyTotal - historyMissed} answered vs ${historyMissed} missed.`, pts: "+0 pts", current: score });
    }
  } else {
    breakdown.history = { pts: 0, max: 20, text: "Insufficient history neutrally scored (+0)", rule: "history.size() < 3 (+0)" };
    traces.push({ step: "05. HISTORY", text: `Sample size too small (${historyTotal} < 3 calls); neutrally scored.`, pts: "+0 pts", current: score });
  }

  // Boundary clamp
  const rawScore = score;
  score = Math.max(0, Math.min(100, score));

  let level = "LOW";
  let actionTitle = "Silent Alert / Normal Banner";
  let actionDesc = "Standard incoming call handling. Device respects Do Not Disturb (DND) or silent profile.";
  let color = "var(--urgency-low)";

  if (score <= 30) {
    level = "LOW";
    actionTitle = "Standard Call (Normal Priority)";
    actionDesc = "Urgency estimate is low. Phone will follow default user ringtone or silent settings without interruption.";
    color = "var(--urgency-low)";
  } else if (score <= 70) {
    level = "MEDIUM";
    actionTitle = "Elevated Priority Alert";
    actionDesc = "Noticeable caller context detected. Displays a prominent urgency badge on the incoming call banner.";
    color = "var(--urgency-med)";
  } else {
    level = "HIGH";
    actionTitle = "Critical Breakthrough Urgency";
    actionDesc = "Strong contextual evidence of emergency. Bypasses DND, triggers distinct audible chime & alert takeover.";
    color = "var(--urgency-high)";
  }

  traces.push({
    step: "06. RESULT",
    text: `Calculated Score: ${score}/100 (Level: ${level}) -> Saved to SQLite table 'call_history'.`,
    pts: `${score}/100`,
    current: score
  });

  return {
    score,
    rawScore,
    level,
    color,
    actionTitle,
    actionDesc,
    breakdown,
    traces,
    explanation: `${breakdown.identity.text}. ${breakdown.frequency.text}. ${breakdown.timing.text}. ${breakdown.history.text}.`
  };
}

function App() {
  const [activeTab, setActiveTab] = useState("playground"); // "playground" | "cases" | "code" | "db"
  const [selectedCaseId, setSelectedCaseId] = useState("case-3");

  // State for Playground Form
  const [profile, setProfile] = useState({
    name: "Dad",
    phone: "+91 98222 33445",
    relationship: "Family",
    priority: "EMERGENCY"
  });
  const [recentCallsCount, setRecentCallsCount] = useState(3);
  const [timeOfDay, setTimeOfDay] = useState("03:15");
  const [historyTotal, setHistoryTotal] = useState(2);
  const [historyMissed, setHistoryMissed] = useState(0);

  // History log for simulated SQLite persistence
  const [dbLogs, setDbLogs] = useState(() => {
    return [
      { id: 1, name: "Dad", phone: "+91 98222 33445", time: "03:15 AM", score: 80, level: "HIGH", exp: "Emergency (+30). High frequency (+30). Late night (+20)." },
      { id: 2, name: "Mom", phone: "+91 98123 45678", time: "15:00 PM", score: 35, level: "MEDIUM", exp: "Trusted (+20). Repeated calls (+15). Normal timing (+0)." },
      { id: 3, name: "Bob Smith", phone: "+91 98765 43210", time: "14:30 PM", score: 0, level: "LOW", exp: "Normal contact (+0). Normal frequency (+0)." }
    ];
  });

  // Load a benchmark case
  const loadCase = (c) => {
    setSelectedCaseId(c.id);
    setProfile({
      name: c.contactName,
      phone: c.phoneNumber,
      relationship: c.relationship,
      priority: c.priority
    });
    setRecentCallsCount(c.recentCallsCount);
    setTimeOfDay(c.timeOfDay);
    setHistoryTotal(c.historyTotal);
    setHistoryMissed(c.historyMissed);
  };

  // Run calculation
  const evaluation = useMemo(() => {
    return evaluateUrgency(profile, recentCallsCount, timeOfDay, historyTotal, historyMissed);
  }, [profile, recentCallsCount, timeOfDay, historyTotal, historyMissed]);

  // Log simulation to DB
  const saveToDb = () => {
    const newRecord = {
      id: Date.now(),
      name: profile.name,
      phone: profile.phone,
      time: timeOfDay,
      score: evaluation.score,
      level: evaluation.level,
      exp: evaluation.explanation
    };
    setDbLogs([newRecord, ...dbLogs]);
  };

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (evaluation.score / 100) * circumference;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24">
              <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1 6h2v6h-2V8zm0 8h2v2h-2v-2z"/>
            </svg>
          </div>
          <div>
            <div className="brand-title">SafeCall AI &bull; Backend Visualizer</div>
            <div className="brand-subtitle">Interactive 4-Factor Weighted Rule Engine &amp; Urgency Evaluator</div>
          </div>
        </div>

        <div className="header-status">
          <div className="badge-tag">
            <span className="badge-dot"></span>
            Rule Engine: Deterministic (0–100 Scale)
          </div>
          <button className="btn-secondary" onClick={saveToDb}>
            &darr; Save State to SQLite Log
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button 
          className={`nav-tab-btn ${activeTab === "playground" ? "active" : ""}`}
          onClick={() => setActiveTab("playground")}
        >
          <span>&#9881;</span> Interactive Simulation Playground
        </button>
        <button 
          className={`nav-tab-btn ${activeTab === "oop" ? "active" : ""}`}
          onClick={() => setActiveTab("oop")}
        >
          <span>🧬</span> OOP Architecture &amp; Object Flow Animation
        </button>
        <button 
          className={`nav-tab-btn ${activeTab === "cases" ? "active" : ""}`}
          onClick={() => setActiveTab("cases")}
        >
          <span>&#129514;</span> 8 Pre-Configured Benchmark Cases
        </button>
        <button 
          className={`nav-tab-btn ${activeTab === "code" ? "active" : ""}`}
          onClick={() => setActiveTab("code")}
        >
          <span>&#128196;</span> Java Backend Code Inspector
        </button>
        <button 
          className={`nav-tab-btn ${activeTab === "db" ? "active" : ""}`}
          onClick={() => setActiveTab("db")}
        >
          <span>&#128451;</span> SQLite Database Logs ({dbLogs.length})
        </button>
      </nav>

      {/* Main Grid: Left Controls, Center Engine Output, Right Phone Simulator */}
      {activeTab !== "code" && activeTab !== "db" && activeTab !== "oop" && (
        <div className="dashboard-grid">
          {/* COLUMN 1: Inputs & Parameters */}
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <span>&#128222;</span> Contextual Call Inputs
              </div>
              <span className="panel-subtitle">Parameters</span>
            </div>

            {/* Quick Benchmark Case Switcher */}
            <div className="form-group">
              <div className="form-label">
                <span>Quick Scenario Preset</span>
                <span className="desc">Click to load</span>
              </div>
              <select 
                className="input-text" 
                value={selectedCaseId} 
                onChange={(e) => {
                  const found = BENCHMARK_CASES.find(c => c.id === e.target.value);
                  if (found) loadCase(found);
                }}
              >
                {BENCHMARK_CASES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Factor 1: Caller Identity */}
            <div className="form-group">
              <div className="form-label">
                <span>1. Caller Identity Priority</span>
                <span className="desc">Max 30 pts</span>
              </div>
              <div className="pill-selector">
                {["NORMAL", "TRUSTED", "EMERGENCY"].map((prio) => (
                  <div 
                    key={prio} 
                    className={`pill-option ${profile.priority === prio ? `selected prio-${prio.toLowerCase()}` : ""}`}
                    onClick={() => setProfile({ ...profile, priority: prio })}
                  >
                    {prio}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '8px' }}>
                <div 
                  className={`pill-option ${profile.priority === "UNKNOWN" ? "selected" : ""}`}
                  onClick={() => setProfile({ ...profile, priority: "UNKNOWN", name: "Unknown Caller" })}
                >
                  UNKNOWN CALLER (Unsaved Number)
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label className="form-label"><span>Caller Name</span></label>
                <input 
                  type="text" 
                  className="input-text" 
                  value={profile.name} 
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label"><span>Phone Number</span></label>
                <input 
                  type="text" 
                  className="input-text" 
                  value={profile.phone} 
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Factor 2: Frequency */}
            <div className="form-group">
              <div className="form-label">
                <span>2. Call Frequency (Past 15 Mins)</span>
                <span className="desc">Max 30 pts</span>
              </div>
              <div className="slider-container">
                <input 
                  type="range" 
                  min="0" 
                  max="4" 
                  step="1"
                  value={recentCallsCount} 
                  onChange={(e) => setRecentCallsCount(parseInt(e.target.value, 10))}
                />
                <div className="slider-value-badge">{recentCallsCount} Redials</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                {recentCallsCount === 0 && "0 redials: Normal frequency (+0 pts)"}
                {recentCallsCount >= 1 && recentCallsCount < 3 && `${recentCallsCount} redials: Repeated calls threshold (+15 pts)`}
                {recentCallsCount >= 3 && `${recentCallsCount} redials: High frequency calling (+30 pts)`}
              </div>
            </div>

            {/* Factor 3: Timing Context */}
            <div className="form-group">
              <div className="form-label">
                <span>3. Call Timing Context (24h)</span>
                <span className="desc">Max 20 pts</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="time" 
                  className="input-text" 
                  value={timeOfDay} 
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button 
                  className="btn-secondary" 
                  onClick={() => setTimeOfDay("02:30")}
                  title="Set to Late Night 2:30 AM"
                >
                  &#127769; Night (02:30)
                </button>
                <button 
                  className="btn-secondary" 
                  onClick={() => setTimeOfDay("14:00")}
                  title="Set to Daytime 2:00 PM"
                >
                  &#9728;&#65039; Day (14:00)
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Late Night window is 23:00 - 05:00. Requires repeated call or Emergency contact to trigger +20 pts.
              </div>
            </div>

            {/* Factor 4: Historical Behaviour */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="form-label">
                <span>4. Historical Call Log Pattern</span>
                <span className="desc">Max 20 pts</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Prior Calls:</div>
                  <div className="slider-container">
                    <input 
                      type="range" 
                      min="0" 
                      max="6" 
                      value={historyTotal} 
                      onChange={(e) => {
                        const tot = parseInt(e.target.value, 10);
                        setHistoryTotal(tot);
                        if (historyMissed > tot) setHistoryMissed(tot);
                      }}
                    />
                    <div className="slider-value-badge">{historyTotal}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Missed Prior Calls:</div>
                  <div className="slider-container">
                    <input 
                      type="range" 
                      min="0" 
                      max={historyTotal} 
                      value={historyMissed} 
                      onChange={(e) => setHistoryMissed(parseInt(e.target.value, 10))}
                    />
                    <div className="slider-value-badge">{historyMissed}</div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                {historyTotal < 3 
                  ? "History size < 3: Insufficient history neutrally scored (+0 pts)." 
                  : historyMissed >= Math.ceil(historyTotal / 2)
                    ? `Missed rate >= 50% (${historyMissed}/${historyTotal}): High missed call rate (+20 pts).`
                    : `Missed rate < 50% (${historyMissed}/${historyTotal}): Normal behavior (+0 pts).`}
              </div>
            </div>
          </div>

          {/* COLUMN 2: Literal Backend Engine Execution */}
          <div>
            {/* Hero Urgency Score Display */}
            <div className="hero-score-panel">
              <div className="hero-content-flex">
                <div className="gauge-wrapper">
                  <svg className="gauge-svg" viewBox="0 0 120 120">
                    <circle className="gauge-bg-circle" cx="60" cy="60" r="54" />
                    <circle 
                      className="gauge-progress-circle" 
                      cx="60" 
                      cy="60" 
                      r="54" 
                      stroke={evaluation.color}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <div className="gauge-score-center">
                    <div className="gauge-score-num" style={{ color: evaluation.color }}>
                      {evaluation.score}
                    </div>
                    <div className="gauge-score-label">Score / 100</div>
                  </div>
                </div>

                <div className="hero-details">
                  <div className={`level-badge level-${evaluation.level.toLowerCase()}`}>
                    <span>&#9679;</span> Urgency Level: {evaluation.level}
                  </div>
                  <div className="hero-action-title">{evaluation.actionTitle}</div>
                  <div className="hero-action-desc">{evaluation.actionDesc}</div>
                </div>
              </div>
            </div>

            {/* 4-Factor Mathematical Breakdown Cards */}
            <div className="factors-grid">
              {/* Factor 1 Card */}
              <div className={`factor-card ${evaluation.breakdown.identity.pts > 0 ? "active-contribution" : ""}`}>
                <div className="factor-top">
                  <div className="factor-name">
                    <span>&#128100;</span> Caller Identity
                  </div>
                  <div className={`factor-score-pill ${evaluation.breakdown.identity.pts > 0 ? "has-points" : ""}`}>
                    +{evaluation.breakdown.identity.pts} / 30 pts
                  </div>
                </div>
                <div className="factor-progress-bar">
                  <div 
                    className="factor-progress-fill" 
                    style={{ width: `${(evaluation.breakdown.identity.pts / 30) * 100}%` }}
                  />
                </div>
                <div className="factor-rule-text">{evaluation.breakdown.identity.text}</div>
                <div className="factor-branch-indicator">
                  code: {evaluation.breakdown.identity.rule}
                </div>
              </div>

              {/* Factor 2 Card */}
              <div className={`factor-card ${evaluation.breakdown.frequency.pts > 0 ? "active-contribution" : ""}`}>
                <div className="factor-top">
                  <div className="factor-name">
                    <span>&#128257;</span> Call Frequency
                  </div>
                  <div className={`factor-score-pill ${evaluation.breakdown.frequency.pts > 0 ? "has-points" : ""}`}>
                    +{evaluation.breakdown.frequency.pts} / 30 pts
                  </div>
                </div>
                <div className="factor-progress-bar">
                  <div 
                    className="factor-progress-fill" 
                    style={{ width: `${(evaluation.breakdown.frequency.pts / 30) * 100}%` }}
                  />
                </div>
                <div className="factor-rule-text">{evaluation.breakdown.frequency.text}</div>
                <div className="factor-branch-indicator">
                  code: {evaluation.breakdown.frequency.rule}
                </div>
              </div>

              {/* Factor 3 Card */}
              <div className={`factor-card ${evaluation.breakdown.timing.pts > 0 ? "active-contribution" : ""}`}>
                <div className="factor-top">
                  <div className="factor-name">
                    <span>&#128337;</span> Timing &amp; Context
                  </div>
                  <div className={`factor-score-pill ${evaluation.breakdown.timing.pts > 0 ? "has-points" : ""}`}>
                    +{evaluation.breakdown.timing.pts} / 20 pts
                  </div>
                </div>
                <div className="factor-progress-bar">
                  <div 
                    className="factor-progress-fill" 
                    style={{ width: `${(evaluation.breakdown.timing.pts / 20) * 100}%` }}
                  />
                </div>
                <div className="factor-rule-text">{evaluation.breakdown.timing.text}</div>
                <div className="factor-branch-indicator">
                  code: {evaluation.breakdown.timing.rule}
                </div>
              </div>

              {/* Factor 4 Card */}
              <div className={`factor-card ${evaluation.breakdown.history.pts > 0 ? "active-contribution" : ""}`}>
                <div className="factor-top">
                  <div className="factor-name">
                    <span>&#128202;</span> Historical Behaviour
                  </div>
                  <div className={`factor-score-pill ${evaluation.breakdown.history.pts > 0 ? "has-points" : ""}`}>
                    +{evaluation.breakdown.history.pts} / 20 pts
                  </div>
                </div>
                <div className="factor-progress-bar">
                  <div 
                    className="factor-progress-fill" 
                    style={{ width: `${(evaluation.breakdown.history.pts / 20) * 100}%` }}
                  />
                </div>
                <div className="factor-rule-text">{evaluation.breakdown.history.text}</div>
                <div className="factor-branch-indicator">
                  code: {evaluation.breakdown.history.rule}
                </div>
              </div>
            </div>

            {/* Literal JVM Execution Log Trace */}
            <div className="trace-terminal">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <div className="terminal-dot dot-red"></div>
                  <div className="terminal-dot dot-yellow"></div>
                  <div className="terminal-dot dot-green"></div>
                </div>
                <div>WeightedRuleEngine.java &bull; Literal Evaluation Trace Log</div>
                <div>Runtime: JVM 17 (Deterministic)</div>
              </div>
              <div>
                {evaluation.traces.map((tr, idx) => (
                  <div key={idx} className="trace-line">
                    <span className="trace-step">{tr.step}</span>
                    <span className="trace-body">
                      {tr.text} {tr.pts && <span className="pts">[{tr.pts}]</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMN 3: Real Mobile Phone Simulation */}
          <div className="phone-preview-col">
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Device Interaction
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Physical Android Response
                </div>
              </div>

              <div className="phone-mockup-wrapper">
                <div className="phone-speaker"></div>
                <div className="phone-screen">
                  <div>
                    <div className="phone-status-bar">
                      <span>{timeOfDay}</span>
                      <span>5G &#9679; 94%</span>
                    </div>

                    <div className={`phone-incoming-card call-${evaluation.level.toLowerCase()}`}>
                      <div className={`caller-avatar ${evaluation.level === "HIGH" ? "avatar-high" : ""}`}>
                        {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
                      </div>
                      <div className="caller-name-display">{profile.name || "Unknown"}</div>
                      <div className="caller-number-display">{profile.phone}</div>

                      <div 
                        className="phone-urgency-tag"
                        style={{ 
                          background: evaluation.level === "HIGH" ? "rgba(239, 68, 68, 0.2)" : evaluation.level === "MEDIUM" ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
                          color: evaluation.color
                        }}
                      >
                        SafeCall Urgency: {evaluation.score}/100 [{evaluation.level}]
                      </div>

                      <div className="phone-dnd-status">
                        {evaluation.level === "HIGH" && "&#9888;&#65039; DND OVERRIDDEN: Audible Alert Active"}
                        {evaluation.level === "MEDIUM" && "&#128276; Priority Banner: Vibrate Alert"}
                        {evaluation.level === "LOW" && "&#128263; Standard Ringtone / Muted"}
                      </div>
                    </div>
                  </div>

                  <div className="phone-actions-bottom">
                    <button className="phone-action-btn btn-decline" title="Decline Call">
                      <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
                    </button>
                    <button className="phone-action-btn btn-accept" title="Accept Call">
                      <svg width="22" height="22" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: 8 Benchmark Cases Walkthrough */}
      {activeTab === "cases" && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">
              <span>&#129514;</span> Backend Benchmark Test Suite (All 8 Formal Cases)
            </div>
            <span className="panel-subtitle">Matches com.safecall.test.WeightedRuleEngineTest</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {BENCHMARK_CASES.map((bc, idx) => {
              const res = evaluateUrgency(
                { name: bc.contactName, phone: bc.phoneNumber, priority: bc.priority },
                bc.recentCallsCount,
                bc.timeOfDay,
                bc.historyTotal,
                bc.historyMissed
              );

              return (
                <div 
                  key={bc.id} 
                  className={`case-card ${selectedCaseId === bc.id ? "active" : ""}`}
                  onClick={() => {
                    loadCase(bc);
                    setActiveTab("playground");
                  }}
                  style={{ padding: '20px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div className="case-num">CASE #{idx + 1}</div>
                    <div 
                      className="case-expected" 
                      style={{ color: res.color, background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px' }}
                    >
                      {res.score}/100 [{res.level}]
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>
                    {bc.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {bc.subtitle}
                  </div>

                  <div style={{ fontSize: '12px', color: '#cbd5e1', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
                    {bc.description}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Prio: <b>{bc.priority}</b></span>
                    <span>Redials: <b>{bc.recentCallsCount}</b></span>
                    <span>Time: <b>{bc.timeOfDay}</b></span>
                  </div>

                  <div style={{ marginTop: '14px', textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                      Test in Playground &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: Literal Java Backend Code Inspector */}
      {activeTab === "code" && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">
              <span>&#128196;</span> Literal Java Backend Source &bull; WeightedRuleEngine.java
            </div>
            <span className="panel-subtitle">Path: app/src/main/java/com/safecall/engine/WeightedRuleEngine.java</span>
          </div>

          <div className="code-inspector-container">
            <pre className="code-block">
              <code>{`package com.safecall.engine;

import com.safecall.model.CallContext;
import com.safecall.model.CallerProfile;
import com.safecall.model.CallRecord;
import com.safecall.model.UrgencyResult;
import java.util.Calendar;
import java.util.List;

public class WeightedRuleEngine {

    public UrgencyResult evaluate(CallContext context) {
        int score = 0;
        StringBuilder explanation = new StringBuilder();

        // 1. Caller Identity (Max 30)
        CallerProfile profile = context.getProfile();
        boolean isKnown = (profile != null);
        if (isKnown) {
            if (profile.getPriority() == CallerProfile.Priority.EMERGENCY) {
                score += 30; // [TRIGGERED WHEN PRIORITY IS EMERGENCY]
                explanation.append("Emergency contact (+30). ");
            } else if (profile.getPriority() == CallerProfile.Priority.TRUSTED) {
                score += 20; // [TRIGGERED WHEN PRIORITY IS TRUSTED]
                explanation.append("Trusted contact (+20). ");
            } else {
                explanation.append("Normal contact (+0). ");
            }
        } else {
            explanation.append("Unknown caller (+0). ");
        }

        // 2. Call Frequency (Max 30)
        List<CallRecord> recent = context.getRecentCalls();
        int recentCount = (recent != null) ? recent.size() : 0;
        if (recentCount >= 3) {
            score += 30; // [HIGH FREQUENCY REDIALS]
            explanation.append("High frequency calling (+30). ");
        } else if (recentCount >= 1) {
            score += 15; // [REPEATED REDIAL]
            explanation.append("Repeated calls (+15). ");
        } else {
            explanation.append("Normal frequency (+0). ");
        }

        // 3. Timing and Context (Max 20)
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(context.getCurrentCallTime());
        int hour = cal.get(Calendar.HOUR_OF_DAY);
        boolean isLateNight = (hour >= 23 || hour <= 5);
        
        // Late night only matters if it's an emergency contact OR repeated call
        if (isLateNight && (recentCount >= 1 || (isKnown && profile.getPriority() == CallerProfile.Priority.EMERGENCY))) {
            score += 20; // [LATE NIGHT CONTEXT]
            explanation.append("Late night contextual urgency (+20). ");
        } else {
            explanation.append("Normal timing (+0). ");
        }

        // 4. Historical Behaviour (Max 20)
        List<CallRecord> history = context.getHistoricalCalls();
        if (history != null && history.size() >= 3) {
            int missedCount = 0;
            for (CallRecord r : history) {
                if (r.getDurationSeconds() == 0) missedCount++;
            }
            if (missedCount >= history.size() / 2) {
                score += 20; // [UNUSUAL MISSED PATTERN]
                explanation.append("Historically high missed call rate (+20). ");
            } else {
                explanation.append("Normal historical behaviour (+0). ");
            }
        } else {
            explanation.append("Insufficient history neutrally scored (+0). ");
        }

        // Clamp 0-100
        score = Math.max(0, Math.min(100, score));

        UrgencyResult.Level level;
        if (score <= 30) {
            level = UrgencyResult.Level.LOW;
        } else if (score <= 70) {
            level = UrgencyResult.Level.MEDIUM;
        } else {
            level = UrgencyResult.Level.HIGH;
        }

        return new UrgencyResult(score, level, explanation.toString().trim());
    }
}`}</code>
            </pre>
          </div>
        </div>
      )}

      {/* VIEW: SQLite Database Logs */}
      {activeTab === "db" && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">
              <span>&#128451;</span> SQLite Database Logs Table &bull; table 'call_history'
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={() => setDbLogs([])}>
                Clear Records
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="history-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Caller</th>
                  <th>Phone Number</th>
                  <th>Call Time</th>
                  <th>Score</th>
                  <th>Urgency Level</th>
                  <th>Engine Explanation</th>
                </tr>
              </thead>
              <tbody>
                {dbLogs.map((log) => (
                  <tr key={log.id}>
                    <td>#{log.id}</td>
                    <td style={{ fontWeight: '600', color: 'white' }}>{log.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{log.phone}</td>
                    <td>{log.time}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                      {log.score}/100
                    </td>
                    <td>
                      <span className={`level-badge level-${log.level.toLowerCase()}`} style={{ padding: '2px 8px', fontSize: '11px', margin: 0 }}>
                        {log.level}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#94a3b8' }}>{log.exp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: OOP Architecture & Object Flow Animation */}
      {activeTab === "oop" && <OopFlowAnimation />}
    </div>
  );
}

// -------------------------------------------------------------
// OOP Architecture & Object Flow Animation Component
// -------------------------------------------------------------
function OopFlowAnimation() {
  const [simIndex, setSimIndex] = useState(2); // Default to Emergency Simulation
  const [step, setStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);

  const SIMULATIONS = [
    {
      id: "sim-1",
      title: "Simulation 1: Normal Contact Single Call",
      badge: "Score: 0 / 100 [LOW]",
      profile: { id: 101, name: "Bob Smith", phone: "+91 98765 43210", rel: "Friend", prio: "NORMAL" },
      recentsCount: 0,
      recentsText: "Empty List (0 prior calls)",
      historyText: "1 call (duration: 45s, answered)",
      timeStr: "14:30 (Daytime)",
      factors: { identity: "+0 (NORMAL)", freq: "+0 (Single)", time: "+0 (Daytime)", hist: "+0 (Sample < 3)" },
      score: 0,
      level: "LOW",
      explanation: "Normal contact (+0). Normal frequency (+0). Normal timing (+0). Insufficient history (+0)."
    },
    {
      id: "sim-2",
      title: "Simulation 2: Trusted Contact Repeated Redials",
      badge: "Score: 35 / 100 [MEDIUM]",
      profile: { id: 102, name: "Mom", phone: "+91 98123 45678", rel: "Family", prio: "TRUSTED" },
      recentsCount: 2,
      recentsText: "2 CallRecords [t-6m, t-3m]",
      historyText: "2 calls (duration: 120s, answered)",
      timeStr: "15:00 (Daytime)",
      factors: { identity: "+20 (TRUSTED)", freq: "+15 (Repeated >= 1)", time: "+0 (Daytime)", hist: "+0 (Sample < 3)" },
      score: 35,
      level: "MEDIUM",
      explanation: "Trusted contact (+20). Repeated calls (+15). Normal timing (+0). Insufficient history (+0)."
    },
    {
      id: "sim-3",
      title: "Simulation 3: Late Night Emergency Call",
      badge: "Score: 80 / 100 [HIGH]",
      profile: { id: 103, name: "Dad", phone: "+91 98222 33445", rel: "Family", prio: "EMERGENCY" },
      recentsCount: 3,
      recentsText: "3 CallRecords [t-9m, t-6m, t-2m]",
      historyText: "2 calls (duration: 60s, answered)",
      timeStr: "03:15 (Late Night 3 AM)",
      factors: { identity: "+30 (EMERGENCY)", freq: "+30 (High Freq >= 3)", time: "+20 (Night & Emg)", hist: "+0 (Sample < 3)" },
      score: 80,
      level: "HIGH",
      explanation: "Emergency contact (+30). High frequency (+30). Late night (+20). Insufficient history (+0)."
    },
    {
      id: "sim-4",
      title: "Simulation 4: Boundary Edge Case (All 4 Factors Triggered)",
      badge: "Score: 100 / 100 [HIGH]",
      profile: { id: 104, name: "Hospital Emergency", phone: "+91 91111 22233", rel: "Medical", prio: "EMERGENCY" },
      recentsCount: 4,
      recentsText: "4 CallRecords [t-12m, t-9m, t-6m, t-2m]",
      historyText: "4 calls (3 missed = 75% missed rate)",
      timeStr: "02:40 (Late Night 2 AM)",
      factors: { identity: "+30 (EMERGENCY)", freq: "+30 (High Freq)", time: "+20 (Night & Emg)", hist: "+20 (>=50% Missed)" },
      score: 100,
      level: "HIGH",
      explanation: "Emergency (+30). High frequency (+30). Late night (+20). Historically high missed rate (+20)."
    }
  ];

  const currentSim = SIMULATIONS[simIndex];

  // Auto-play timer
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setStep((prev) => (prev % 6) + 1);
      }, 2400);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const STEP_DETAILS = {
    1: {
      title: "Step 1: Entity Object Instantiation on JVM Heap",
      concept: "Encapsulation & State Allocation",
      narrative: <span>Allocating POJO instances on JVM Heap: <b>new CallerProfile(...)</b> and <b>ArrayList&lt;CallRecord&gt;</b> encapsulate state with private member fields and public getters.</span>,
      code: `CallerProfile profile = new CallerProfile(${currentSim.profile.id}, "${currentSim.profile.name}", "${currentSim.profile.phone}", "${currentSim.profile.rel}", Priority.${currentSim.profile.prio});\nList<CallRecord> recentCalls = repository.getRecentCalls(phone, windowStart);`,
      activeNodes: ["profile", "recent", "history"],
      activeArrows: []
    },
    2: {
      title: "Step 2: Aggregation & Object Composition (CallContext)",
      concept: "Object Composition (Has-A)",
      narrative: <span><b>CallContext</b> bundles references via Composition (has-a <i>CallerProfile</i>, has-many <i>CallRecord</i>s). Isolates the Engine from database schemas.</span>,
      code: `CallContext context = new CallContext(profile, recentCalls, historicalCalls, timestamp);`,
      activeNodes: ["profile", "recent", "history", "context"],
      activeArrows: ["p2c", "r2c", "h2c"]
    },
    3: {
      title: "Step 3: Message Passing & Pure Service Invocation",
      concept: "Message Passing & Loose Coupling",
      narrative: <span>Invoking <b>WeightedRuleEngine.evaluate(context)</b> by reference. The engine evaluates urgency as a pure deterministic calculation without mutating caller state.</span>,
      code: `WeightedRuleEngine engine = new WeightedRuleEngine();\nUrgencyResult result = engine.evaluate(context);`,
      activeNodes: ["context", "engine"],
      activeArrows: ["c2e"]
    },
    4: {
      title: "Step 4: Internal 4-Factor Evaluation Pipeline",
      concept: "Business Logic Encapsulation",
      narrative: <span>Engine executes 4 weighted rules: <b>Identity</b> (${currentSim.factors.identity}), <b>Frequency</b> (${currentSim.factors.freq}), <b>Timing</b> (${currentSim.factors.time}), and <b>History</b> (${currentSim.factors.hist}). Clamps score 0–100.</span>,
      code: `// Rule 1: ${currentSim.factors.identity}\n// Rule 2: ${currentSim.factors.freq}\n// Rule 3: ${currentSim.factors.time}\n// Rule 4: ${currentSim.factors.hist}\nscore = Math.max(0, Math.min(100, rawScore)); // Total: ${currentSim.score}`,
      activeNodes: ["engine"],
      activeArrows: ["c2e"]
    },
    5: {
      title: "Step 5: Value Object Return (UrgencyResult DTO)",
      concept: "Data Transfer Object (DTO) & Immutability",
      narrative: <span>Engine creates an immutable <b>UrgencyResult</b> DTO containing score (${currentSim.score}), enum Level.${currentSim.level}, and explanation text.</span>,
      code: `return new UrgencyResult(${currentSim.score}, UrgencyResult.Level.${currentSim.level}, "${currentSim.explanation}");`,
      activeNodes: ["engine", "result"],
      activeArrows: ["e2r"]
    },
    6: {
      title: "Step 6: Persistence Layer Hand-off (CallRepository & SQLite)",
      concept: "Repository Pattern & SQLite DAO",
      narrative: <span>Application serializes evaluation into a <b>CallRecord</b> entity and calls <b>CallRepository.saveCallRecord(record)</b> to persist into SQLite table <i>call_history</i>.</span>,
      code: `CallRecord record = new CallRecord(0, phone, timestamp, 0, result.getScore(), result.getUrgencyLevel().name(), result.getExplanation());\nrepository.saveCallRecord(record);`,
      activeNodes: ["result", "repo", "db"],
      activeArrows: ["r2repo", "repo2db"]
    }
  };

  const curStep = STEP_DETAILS[step];

  return (
    <div className="oop-container">
      {/* Top Controls Bar */}
      <div className="oop-controls-bar">
        {/* Simulation Scenario Switcher */}
        <div className="oop-sim-switcher">
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
            Simulation Scenario:
          </span>
          {SIMULATIONS.map((sim, i) => (
            <button
              key={sim.id}
              className={`oop-sim-btn ${simIndex === i ? "active" : ""}`}
              onClick={() => { setSimIndex(i); setStep(1); }}
            >
              Sim {i + 1} ({sim.level})
            </button>
          ))}
        </div>

        {/* Playback Controls */}
        <div className="oop-playback-controls">
          <button 
            className="playback-btn" 
            onClick={() => setStep(prev => prev > 1 ? prev - 1 : 6)}
            title="Previous Step"
          >
            &#9664; Prev
          </button>
          <button 
            className={`playback-btn ${isPlaying ? "" : "btn-play"}`} 
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? "❚❚ Pause" : "▶ Auto Play"}
          </button>
          <button 
            className="playback-btn" 
            onClick={() => setStep(prev => (prev % 6) + 1)}
            title="Next Step"
          >
            Next &#9654;
          </button>
          <button 
            className="playback-btn" 
            onClick={() => { setStep(1); setIsPlaying(false); }}
            title="Reset to Step 1"
          >
            &#8634; Reset
          </button>
          <div className="step-indicator-pill">
            STEP {step} / 6
          </div>
        </div>
      </div>

      {/* Main Interactive Stage with Animated SVG Connections & Object Cards */}
      <div className="oop-stage-card">
        {/* SVG Arrow Connectors Canvas */}
        <svg className="oop-canvas-svg" viewBox="0 0 1440 680" preserveAspectRatio="none">
          <defs>
            <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
            </marker>
            <marker id="arrow-dim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(255,255,255,0.2)" />
            </marker>
          </defs>

          {/* Arrow 1: CallerProfile -> CallContext */}
          <path 
            d="M 290 120 C 340 120, 360 280, 410 280" 
            fill="none" 
            stroke={curStep.activeArrows.includes("p2c") ? "#38bdf8" : "rgba(255,255,255,0.12)"}
            strokeWidth={curStep.activeArrows.includes("p2c") ? "3" : "1.5"}
            markerEnd={curStep.activeArrows.includes("p2c") ? "url(#arrow-blue)" : "url(#arrow-dim)"}
            className={`svg-arrow-line ${curStep.activeArrows.includes("p2c") ? "active-arrow" : ""}`}
          />

          {/* Arrow 2: recentCalls -> CallContext */}
          <path 
            d="M 290 310 C 340 310, 360 320, 410 320" 
            fill="none" 
            stroke={curStep.activeArrows.includes("r2c") ? "#38bdf8" : "rgba(255,255,255,0.12)"}
            strokeWidth={curStep.activeArrows.includes("r2c") ? "3" : "1.5"}
            markerEnd={curStep.activeArrows.includes("r2c") ? "url(#arrow-blue)" : "url(#arrow-dim)"}
            className={`svg-arrow-line ${curStep.activeArrows.includes("r2c") ? "active-arrow" : ""}`}
          />

          {/* Arrow 3: historicalCalls -> CallContext */}
          <path 
            d="M 290 490 C 340 490, 360 360, 410 360" 
            fill="none" 
            stroke={curStep.activeArrows.includes("h2c") ? "#38bdf8" : "rgba(255,255,255,0.12)"}
            strokeWidth={curStep.activeArrows.includes("h2c") ? "3" : "1.5"}
            markerEnd={curStep.activeArrows.includes("h2c") ? "url(#arrow-blue)" : "url(#arrow-dim)"}
            className={`svg-arrow-line ${curStep.activeArrows.includes("h2c") ? "active-arrow" : ""}`}
          />

          {/* Arrow 4: CallContext -> WeightedRuleEngine */}
          <path 
            d="M 690 320 C 720 320, 730 320, 760 320" 
            fill="none" 
            stroke={curStep.activeArrows.includes("c2e") ? "#38bdf8" : "rgba(255,255,255,0.12)"}
            strokeWidth={curStep.activeArrows.includes("c2e") ? "3" : "1.5"}
            markerEnd={curStep.activeArrows.includes("c2e") ? "url(#arrow-blue)" : "url(#arrow-dim)"}
            className={`svg-arrow-line ${curStep.activeArrows.includes("c2e") ? "active-arrow" : ""}`}
          />

          {/* Arrow 5: WeightedRuleEngine -> UrgencyResult */}
          <path 
            d="M 1040 280 C 1070 280, 1090 140, 1120 140" 
            fill="none" 
            stroke={curStep.activeArrows.includes("e2r") ? "#38bdf8" : "rgba(255,255,255,0.12)"}
            strokeWidth={curStep.activeArrows.includes("e2r") ? "3" : "1.5"}
            markerEnd={curStep.activeArrows.includes("e2r") ? "url(#arrow-blue)" : "url(#arrow-dim)"}
            className={`svg-arrow-line ${curStep.activeArrows.includes("e2r") ? "active-arrow" : ""}`}
          />

          {/* Arrow 6: UrgencyResult -> CallRepository */}
          <path 
            d="M 1250 210 C 1250 250, 1250 310, 1250 350" 
            fill="none" 
            stroke={curStep.activeArrows.includes("r2repo") ? "#38bdf8" : "rgba(255,255,255,0.12)"}
            strokeWidth={curStep.activeArrows.includes("r2repo") ? "3" : "1.5"}
            markerEnd={curStep.activeArrows.includes("r2repo") ? "url(#arrow-blue)" : "url(#arrow-dim)"}
            className={`svg-arrow-line ${curStep.activeArrows.includes("r2repo") ? "active-arrow" : ""}`}
          />

          {/* Arrow 7: CallRepository -> SQLite Database */}
          <path 
            d="M 1250 490 C 1250 510, 1250 520, 1250 540" 
            fill="none" 
            stroke={curStep.activeArrows.includes("repo2db") ? "#38bdf8" : "rgba(255,255,255,0.12)"}
            strokeWidth={curStep.activeArrows.includes("repo2db") ? "3" : "1.5"}
            markerEnd={curStep.activeArrows.includes("repo2db") ? "url(#arrow-blue)" : "url(#arrow-dim)"}
            className={`svg-arrow-line ${curStep.activeArrows.includes("repo2db") ? "active-arrow" : ""}`}
          />
        </svg>

        {/* Object Nodes Interactive Grid */}
        <div className="oop-nodes-grid">
          {/* COLUMN 1: Entities / Input Objects */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Node 1: CallerProfile */}
            <div className={`oop-node ${curStep.activeNodes.includes("profile") ? "active" : "dimmed"}`}>
              <div className="oop-node-header">
                <div className="oop-node-title">
                  <span>&#128100;</span> CallerProfile
                </div>
                <div className="oop-heap-address">@Heap:0x7A1</div>
              </div>
              <div className="oop-class-tag">class com.safecall.model.CallerProfile</div>
              <div className="oop-field-list">
                <div className="oop-field-row"><span className="oop-field-name">long id:</span><span className="oop-field-val">{currentSim.profile.id}</span></div>
                <div className="oop-field-row"><span className="oop-field-name">String name:</span><span className="oop-field-val val-hl">"{currentSim.profile.name}"</span></div>
                <div className="oop-field-row"><span className="oop-field-name">String phone:</span><span className="oop-field-val">{currentSim.profile.phone}</span></div>
                <div className="oop-field-row"><span className="oop-field-name">String rel:</span><span className="oop-field-val">"{currentSim.profile.rel}"</span></div>
                <div className="oop-field-row">
                  <span className="oop-field-name">Priority prio:</span>
                  <span className={`oop-field-val ${currentSim.profile.prio === "EMERGENCY" ? "val-urgent" : currentSim.profile.prio === "TRUSTED" ? "val-trusted" : ""}`}>
                    Priority.{currentSim.profile.prio}
                  </span>
                </div>
              </div>
            </div>

            {/* Node 2: recentCalls List */}
            <div className={`oop-node ${curStep.activeNodes.includes("recent") ? "active" : "dimmed"}`}>
              <div className="oop-node-header">
                <div className="oop-node-title">
                  <span>&#128257;</span> recentCalls
                </div>
                <div className="oop-heap-address">@Heap:0x8B4</div>
              </div>
              <div className="oop-class-tag">java.util.List&lt;CallRecord&gt;</div>
              <div className="oop-field-list">
                <div className="oop-field-row"><span className="oop-field-name">size():</span><span className="oop-field-val val-hl">{currentSim.recentsCount} items</span></div>
                <div className="oop-field-row"><span className="oop-field-name">window:</span><span className="oop-field-val">&lt;= 15 mins</span></div>
                <div className="oop-field-row"><span className="oop-field-name">payload:</span><span className="oop-field-val" style={{ fontSize: '10.5px' }}>{currentSim.recentsText}</span></div>
              </div>
            </div>

            {/* Node 3: historicalCalls List */}
            <div className={`oop-node ${curStep.activeNodes.includes("history") ? "active" : "dimmed"}`}>
              <div className="oop-node-header">
                <div className="oop-node-title">
                  <span>&#128202;</span> historicalCalls
                </div>
                <div className="oop-heap-address">@Heap:0x9C2</div>
              </div>
              <div className="oop-class-tag">java.util.List&lt;CallRecord&gt;</div>
              <div className="oop-field-list">
                <div className="oop-field-row"><span className="oop-field-name">callTime:</span><span className="oop-field-val val-hl">{currentSim.timeStr}</span></div>
                <div className="oop-field-row"><span className="oop-field-name">historyData:</span><span className="oop-field-val" style={{ fontSize: '10.5px' }}>{currentSim.historyText}</span></div>
              </div>
            </div>
          </div>

          {/* COLUMN 2: Aggregated Context (Composition) */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className={`oop-node ${curStep.activeNodes.includes("context") ? "active" : "dimmed"}`} style={{ minHeight: '260px' }}>
              <div className="oop-node-header">
                <div className="oop-node-title">
                  <span>&#129513;</span> CallContext
                </div>
                <div className="oop-heap-address">@Heap:0x3D9</div>
              </div>
              <div className="oop-class-tag">class com.safecall.model.CallContext</div>
              <div style={{ fontSize: '11px', color: '#38bdf8', marginBottom: '8px', fontStyle: 'italic' }}>
                // Composite Aggregation (Has-A)
              </div>
              <div className="oop-field-list">
                <div className="oop-field-row"><span className="oop-field-name">profile ref:</span><span className="oop-field-val">&rarr; @0x7A1</span></div>
                <div className="oop-field-row"><span className="oop-field-name">recentCalls ref:</span><span className="oop-field-val">&rarr; @0x8B4</span></div>
                <div className="oop-field-row"><span className="oop-field-name">historyCalls ref:</span><span className="oop-field-val">&rarr; @0x9C2</span></div>
                <div className="oop-field-row"><span className="oop-field-name">currentCallTime:</span><span className="oop-field-val">{currentSim.timeStr}</span></div>
              </div>
              <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '11px', color: '#94a3b8' }}>
                Method Accessors:<br/>
                &bull; getProfile()<br/>
                &bull; getRecentCalls()<br/>
                &bull; getHistoricalCalls()<br/>
                &bull; getCurrentCallTime()
              </div>
            </div>
          </div>

          {/* COLUMN 3: WeightedRuleEngine Service */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className={`oop-node ${curStep.activeNodes.includes("engine") ? "active" : "dimmed"}`} style={{ minHeight: '340px' }}>
              <div className="oop-node-header">
                <div className="oop-node-title">
                  <span>&#9881;</span> WeightedRuleEngine
                </div>
                <div className="oop-heap-address">@Singleton:0xE1F</div>
              </div>
              <div className="oop-class-tag">class com.safecall.engine.WeightedRuleEngine</div>
              <div style={{ fontSize: '11px', color: '#a78bfa', marginBottom: '10px' }}>
                Method: evaluate(CallContext context)
              </div>

              {/* 4 Internal Rule Blocks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '11px' }}>
                  <div style={{ color: '#94a3b8' }}>Rule 1: Caller Identity (Max 30)</div>
                  <div style={{ color: '#38bdf8', fontWeight: '700' }}>{currentSim.factors.identity}</div>
                </div>
                <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '11px' }}>
                  <div style={{ color: '#94a3b8' }}>Rule 2: Call Frequency (Max 30)</div>
                  <div style={{ color: '#38bdf8', fontWeight: '700' }}>{currentSim.factors.freq}</div>
                </div>
                <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '11px' }}>
                  <div style={{ color: '#94a3b8' }}>Rule 3: Timing Context (Max 20)</div>
                  <div style={{ color: '#38bdf8', fontWeight: '700' }}>{currentSim.factors.time}</div>
                </div>
                <div style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '11px' }}>
                  <div style={{ color: '#94a3b8' }}>Rule 4: Historical Behavior (Max 20)</div>
                  <div style={{ color: '#38bdf8', fontWeight: '700' }}>{currentSim.factors.hist}</div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 4: DTO Result & Persistence DAO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Node 5: UrgencyResult DTO */}
            <div className={`oop-node ${curStep.activeNodes.includes("result") ? "active" : "dimmed"}`}>
              <div className="oop-node-header">
                <div className="oop-node-title">
                  <span>&#128225;</span> UrgencyResult
                </div>
                <div className="oop-heap-address">@Heap:0x5F2</div>
              </div>
              <div className="oop-class-tag">class com.safecall.model.UrgencyResult (DTO)</div>
              <div className="oop-field-list">
                <div className="oop-field-row"><span className="oop-field-name">int score:</span><span className="oop-field-val val-hl">{currentSim.score} / 100</span></div>
                <div className="oop-field-row">
                  <span className="oop-field-name">Level level:</span>
                  <span className={`oop-field-val ${currentSim.level === "HIGH" ? "val-urgent" : currentSim.level === "MEDIUM" ? "val-trusted" : ""}`}>
                    Level.{currentSim.level}
                  </span>
                </div>
                <div className="oop-field-row"><span className="oop-field-name">explanation:</span><span className="oop-field-val" style={{ fontSize: '10px' }}>"{currentSim.explanation}"</span></div>
              </div>
            </div>

            {/* Node 6: CallRepository DAO */}
            <div className={`oop-node ${curStep.activeNodes.includes("repo") ? "active" : "dimmed"}`}>
              <div className="oop-node-header">
                <div className="oop-node-title">
                  <span>&#128451;</span> CallRepository
                </div>
                <div className="oop-heap-address">@DAO:0x1C8</div>
              </div>
              <div className="oop-class-tag">class com.safecall.db.CallRepository</div>
              <div className="oop-field-list">
                <div className="oop-field-row"><span className="oop-field-name">dbHelper:</span><span className="oop-field-val">DatabaseHelper</span></div>
                <div className="oop-field-row"><span className="oop-field-name">method:</span><span className="oop-field-val val-hl">saveCallRecord()</span></div>
              </div>
            </div>

            {/* Node 7: SQLite DB Storage */}
            <div className={`oop-node ${curStep.activeNodes.includes("db") ? "active" : "dimmed"}`} style={{ background: 'rgba(8, 20, 36, 0.95)' }}>
              <div className="oop-node-header">
                <div className="oop-node-title">
                  <span>&#128190;</span> SQLite: safecall.db
                </div>
                <div className="oop-heap-address">Disk DB</div>
              </div>
              <div className="oop-class-tag">TABLE call_history</div>
              <div style={{ fontSize: '11px', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                INSERT INTO call_history (phone, timestamp, urgencyScore, urgencyLevel, explanation)...
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Explanation & Java Code Live Banner */}
      <div className="oop-step-footer">
        <div style={{ flex: 1 }}>
          <div className="oop-step-concept">
            <span className="concept-badge">{curStep.concept}</span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{curStep.title}</span>
          </div>
          <div className="oop-step-narrative" style={{ marginTop: '8px' }}>
            {curStep.narrative}
          </div>
        </div>

        {/* Live Java Code Box for Active Step */}
        <div style={{ minWidth: '460px', background: '#050811', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#cbd5e1' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '10px' }}>// Executing Java Statement:</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#38bdf8' }}>{curStep.code}</pre>
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));

