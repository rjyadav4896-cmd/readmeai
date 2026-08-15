import "./App.css";
import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

const LANGUAGES = [
  {
    code: "en",
    label: "English",
    flag: "🇬🇧",
    loadingText: "Analyzing...",
    ttsLang: "en-US",
  },
  {
    code: "hi",
    label: "हिंदी",
    flag: "🇮🇳",
    loadingText: "विश्लेषण हो रहा है...",
    ttsLang: "hi-IN",
  },
  {
    code: "mr",
    label: "मराठी",
    flag: "🇮🇳",
    loadingText: "विश्लेषण सुरू आहे...",
    ttsLang: "mr-IN",
  },
  {
    code: "bn",
    label: "বাংলা",
    flag: "🇧🇩",
    loadingText: "বিশ্লেষণ চলছে...",
    ttsLang: "bn-IN",
  },
  {
    code: "ta",
    label: "தமிழ்",
    flag: "🇮🇳",
    loadingText: "பகுப்பாய்வு நடக்கிறது...",
    ttsLang: "ta-IN",
  },
  {
    code: "te",
    label: "తెలుగు",
    flag: "🇮🇳",
    loadingText: "విశ్లేషణ జరుగుతోంది...",
    ttsLang: "te-IN",
  },
];

const RISK_KEYWORDS = {
  high: [
    "high",
    "elevated",
    "critical",
    "danger",
    "severe",
    "abnormal",
    "risk",
    "alert",
    "urgent",
    "खतरा",
    "गंभीर",
    "उच्च",
  ],
  medium: [
    "moderate",
    "borderline",
    "slightly",
    "watch",
    "monitor",
    "caution",
    "सावधान",
    "मध्यम",
  ],
  low: [
    "normal",
    "healthy",
    "good",
    "optimal",
    "well",
    "stable",
    "सामान्य",
    "स्वस्थ",
  ],
};

function getRiskLevel(text) {
  const lower = text.toLowerCase();
  if (RISK_KEYWORDS.high.some((k) => lower.includes(k))) return "high";
  if (RISK_KEYWORDS.medium.some((k) => lower.includes(k))) return "medium";
  return "low";
}

function RiskMeter({ level }) {
  const config = {
    high: { label: "High Risk", color: "#ef4444", width: "85%", icon: "🔴" },
    medium: {
      label: "Moderate Risk",
      color: "#f59e0b",
      width: "50%",
      icon: "🟡",
    },
    low: { label: "Low Risk", color: "#22c55e", width: "20%", icon: "🟢" },
  };
  const c = config[level] || config.low;
  return (
    <div className="risk-meter">
      <div className="risk-meter-header">
        <span className="risk-icon">{c.icon}</span>
        <span className="risk-label" style={{ color: c.color }}>
          {c.label}
        </span>
      </div>
      <div className="risk-bar-track">
        <div
          className="risk-bar-fill"
          style={{ width: c.width, background: c.color }}
        />
      </div>
    </div>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [manualText, setManualText] = useState("");
  const [inputMode, setInputMode] = useState("pdf"); // "pdf" | "text"
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [conditions, setConditions] = useState("");

  const [result, setResult] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeLang, setActiveLang] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [riskLevel, setRiskLevel] = useState("low");
  const [activeTab, setActiveTab] = useState("report"); // "report" | "history"
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("readmed_history") || "[]");
    } catch {
      return [];
    }
  });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (f && f.type !== "application/pdf") {
      alert("Only PDF files are supported.");
      return;
    }
    setFile(f);
    setResult("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      setResult("");
    } else {
      alert("Only PDF files are supported.");
    }
  };

  const handleProcess = async (lang) => {
    if (inputMode === "pdf" && !file) {
      alert("Please upload a medical PDF first.");
      return;
    }
    if (inputMode === "text" && !manualText.trim()) {
      alert("Please enter your medical report text.");
      return;
    }

    setLoading(true);
    setActiveLang(lang);
    setResult("");

    const formData = new FormData();
    if (inputMode === "pdf") {
      formData.append("file", file);
    } else {
      formData.append("manual_text", manualText);
    }
    formData.append("language", lang);
    if (patientName) formData.append("patient_name", patientName);
    if (patientAge) formData.append("patient_age", patientAge);
    if (patientGender) formData.append("patient_gender", patientGender);
    if (conditions) formData.append("conditions", conditions);

    try {
      const response = await fetch("http://127.0.0.1:5001/process", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setResult(data.explanation);
        setSessionId(data.session_id);
        localStorage.setItem("readmed_session", data.session_id);

        const level = getRiskLevel(data.explanation);
        setRiskLevel(level);

        // Save to history
        const entry = {
          id: data.session_id,
          date: new Date().toLocaleDateString(),
          lang,
          name: patientName || "Unknown",
          riskLevel: level,
          preview: data.explanation.slice(0, 120) + "...",
        };
        const updated = [entry, ...history].slice(0, 10);
        setHistory(updated);
        localStorage.setItem("readmed_history", JSON.stringify(updated));
        setActiveTab("report");
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Backend not reachable. Ensure Flask is running on port 5001.");
    } finally {
      setLoading(false);
    }
  };

  const speakResults = () => {
    if (!("speechSynthesis" in window)) {
      alert("Your browser does not support voice output.");
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const cleanText = result.replace(/[#*`]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const langObj = LANGUAGES.find((l) => l.code === activeLang);
    const ttsLang = langObj?.ttsLang || "en-US";

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find((v) =>
      v.lang.startsWith(ttsLang.split("-")[0]),
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    utterance.lang = ttsLang;
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const downloadPDF = () => {
    const sid = sessionId || localStorage.getItem("readmed_session");
    if (!sid) {
      // Fallback to latest
      window.open("http://127.0.0.1:5001/download-report", "_blank");
      return;
    }
    window.open(
      `http://127.0.0.1:5001/download-report?session_id=${sid}`,
      "_blank",
    );
  };

  const langObj = LANGUAGES.find((l) => l.code === activeLang);

  return (
    <div className="App">
      {/* Hero Header */}
      <header className="app-header">
        <div className="header-glow" />
        <div className="header-content">
          <div className="logo-wrap">
            <span className="logo-icon">🩺</span>
            <div>
              <h1 className="app-title">ReadMed AI</h1>
              <p className="app-subtitle">
                Agentic Medical Interpretation — for Everyone
              </p>
            </div>
          </div>
          <div className="privacy-badge">🔒 Your data is never stored</div>
        </div>
      </header>

      <main className="main-content">
        {/* Patient Info Card */}
        <section className="card patient-card">
          <h2 className="card-title">
            👤 Patient Information{" "}
            <span className="optional-tag">optional</span>
          </h2>
          <div className="patient-grid">
            <input
              className="input-field"
              placeholder="Full Name"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
            <input
              className="input-field"
              placeholder="Age"
              type="number"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
            />
            <select
              className="input-field select-field"
              value={patientGender}
              onChange={(e) => setPatientGender(e.target.value)}
            >
              <option value="">Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <input
              className="input-field"
              placeholder="Known conditions (e.g. diabetes, hypertension)"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
            />
          </div>
        </section>

        {/* Input Mode Toggle */}
        <section className="card upload-card">
          <div className="mode-toggle">
            <button
              className={`mode-btn ${inputMode === "pdf" ? "active" : ""}`}
              onClick={() => setInputMode("pdf")}
            >
              📄 Upload PDF
            </button>
            <button
              className={`mode-btn ${inputMode === "text" ? "active" : ""}`}
              onClick={() => setInputMode("text")}
            >
              ✍️ Type / Paste Values
            </button>
          </div>

          {inputMode === "pdf" ? (
            <div
              className={`drop-zone ${dragOver ? "drag-active" : ""} ${file ? "has-file" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={onFileChange}
                style={{ display: "none" }}
              />
              {file ? (
                <div className="file-info">
                  <span className="file-icon">📋</span>
                  <div>
                    <p className="file-name">{file.name}</p>
                    <p className="file-size">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    className="remove-file"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setResult("");
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="drop-prompt">
                  <span className="drop-icon">📂</span>
                  <p>Drag & drop your PDF here</p>
                  <p className="drop-sub">or click to browse</p>
                </div>
              )}
            </div>
          ) : (
            <textarea
              className="text-input"
              placeholder="Paste your medical report text here... e.g.&#10;Blood Glucose: 140 mg/dL&#10;Blood Pressure: 145/90 mmHg&#10;Cholesterol: 210 mg/dL"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={7}
            />
          )}
        </section>

        {/* Language Buttons */}
        <section className="card lang-card">
          <h2 className="card-title">🌐 Generate Report In</h2>
          <div className="lang-grid">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                className={`lang-btn ${activeLang === lang.code && loading ? "loading" : ""}`}
                onClick={() => handleProcess(lang.code)}
                disabled={loading}
              >
                {loading && activeLang === lang.code ? (
                  <>
                    <span className="spinner" /> {lang.loadingText}
                  </>
                ) : (
                  <>
                    {lang.flag} {lang.label}
                  </>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Results Section */}
        {result && (
          <section className="card results-card">
            {/* Tab Bar */}
            <div className="tab-bar">
              <button
                className={`tab-btn ${activeTab === "report" ? "active" : ""}`}
                onClick={() => setActiveTab("report")}
              >
                📊 Report
              </button>
              <button
                className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
                onClick={() => setActiveTab("history")}
              >
                🕒 History ({history.length})
              </button>
            </div>

            {activeTab === "report" && (
              <>
                {/* Risk Meter */}
                <RiskMeter level={riskLevel} />

                {/* Controls */}
                <div className="controls-row">
                  <button
                    onClick={speakResults}
                    className={`ctrl-btn voice-btn ${isSpeaking ? "speaking" : ""}`}
                  >
                    {isSpeaking
                      ? "⏹ Stop"
                      : `🔊 Listen in ${langObj?.label || "English"}`}
                  </button>
                  <button
                    onClick={downloadPDF}
                    className="ctrl-btn download-btn"
                  >
                    📥 Download PDF
                  </button>
                </div>

                {/* Report Body */}
                <div className="report-body">
                  <div className="report-lang-tag">
                    {langObj?.flag} {langObj?.label} Report
                    {patientName && (
                      <span className="patient-tag"> — {patientName}</span>
                    )}
                  </div>
                  <div className="markdown-body">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>
                </div>
              </>
            )}

            {activeTab === "history" && (
              <div className="history-list">
                {history.length === 0 ? (
                  <p className="empty-history">No previous reports yet.</p>
                ) : (
                  history.map((h) => (
                    <div
                      key={h.id}
                      className={`history-item risk-border-${h.riskLevel}`}
                    >
                      <div className="history-meta">
                        <span className="history-name">👤 {h.name}</span>
                        <span className="history-date">📅 {h.date}</span>
                        <span
                          className={`history-risk risk-badge-${h.riskLevel}`}
                        >
                          {h.riskLevel === "high"
                            ? "🔴 High"
                            : h.riskLevel === "medium"
                              ? "🟡 Moderate"
                              : "🟢 Low"}
                        </span>
                      </div>
                      <p className="history-preview">{h.preview}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}

        {/* History tab visible even without current result */}
        {!result && history.length > 0 && (
          <section className="card results-card">
            <div className="tab-bar">
              <button className="tab-btn active">
                🕒 Previous Reports ({history.length})
              </button>
            </div>
            <div className="history-list">
              {history.map((h) => (
                <div
                  key={h.id}
                  className={`history-item risk-border-${h.riskLevel}`}
                >
                  <div className="history-meta">
                    <span className="history-name">👤 {h.name}</span>
                    <span className="history-date">📅 {h.date}</span>
                    <span className={`history-risk risk-badge-${h.riskLevel}`}>
                      {h.riskLevel === "high"
                        ? "🔴 High"
                        : h.riskLevel === "medium"
                          ? "🟡 Moderate"
                          : "🟢 Low"}
                    </span>
                  </div>
                  <p className="history-preview">{h.preview}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>
          ReadMed AI · Not a substitute for professional medical advice · Always
          consult your doctor
        </p>
      </footer>
    </div>
  );
}

export default App;
