// app-screen.jsx — Precedent Reasoning app UI (dark navy mock with faked streaming)
const { useState: uS, useRef: uR, useEffect: uE, useCallback: uC } = React;

const SOURCE_URL = "#";

const FULL_STEPS = (results) => [
  "Analysing your situation…",
  "Identifying the key legal issues…",
  "Searching the case law for NSW and Commonwealth decisions…",
  "Reading " + results[0].case + " " + results[0].cite + "…",
  "Reading " + results[1].case + " " + results[1].cite + "…",
  "Comparing the cases to your situation…",
];

const TITLE_MAP = { deposit: "Keeping a buyer's deposit", council: "Council refused granny flat", relocation: "Relocating with the kids" };
function titleFor(text, match) {
  if (match && match.key && TITLE_MAP[match.key]) return TITLE_MAP[match.key];
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? t.slice(0, 42) + "…" : t;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function convoFromScenario(sc) {
  return { id: uid(), title: TITLE_MAP[sc.key], situation: sc.query, issues: sc.issues,
    results: sc.results, steps: FULL_STEPS(sc.results), state: "done" };
}

function BindingTag({ binding }) {
  const b = BINDING[binding] || BINDING.persuasive;
  return <span className={"tag " + (b.strong ? "win" : "loss")}>{b.strong ? "▲" : "◆"} {b.label}</span>;
}

// ---------------- Demo banner ----------------
function DemoBanner() {
  return (
    <div className="demo-banner">
      <span><b>You're viewing a demo.</b> Conversations and results are simulated for illustrative purposes only. To request a demo with real search results, please contact us.</span>
    </div>
  );
}

// ---------------- Sidebar ----------------
function Sidebar({ convos, activeId, onSelect, onNew, onDelete, open, onClose }) {
  const [q, setQ] = uS("");
  const list = convos.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <aside className={"side" + (open ? " open" : "")}>
      <div className="side-head">
        <div className="meta">
          <a href="index.html" aria-label="Back to Precedent Reasoning">
            <img src="logo-wordmark.png" alt="Precedent Reasoning" className="side-wordmark" />
          </a>
        </div>
        <span className="demo-pill">Demo</span>
      </div>
      <div className="side-block">
        <button className="new-btn" onClick={() => { onNew(); onClose(); }}>
          <span className="plus">+</span> New conversation
        </button>
      </div>
      <div className="side-block">
        <input className="side-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" />
      </div>
      <div className="hist">
        <div className="hist-label">Recent</div>
        {list.length === 0 ? (
          <p className="hist-empty">{q ? "No matching conversations." : "No conversations yet."}</p>
        ) : list.map((c) => (
          <div key={c.id} className={"hist-item" + (c.id === activeId ? " active" : "")}>
            <button className="h-open" title={c.title} onClick={() => { onSelect(c.id); onClose(); }}>{c.title}</button>
            <button className="h-del" title="Delete" onClick={() => onDelete(c.id)}>×</button>
          </div>
        ))}
      </div>
      <div className="side-foot">
        Legal information, not advice. Always verify each citation against the original judgment.
      </div>
    </aside>
  );
}

// ---------------- Agent status ----------------
function AgentStatus({ steps, issues }) {
  return (
    <div className="agent">
      <div className="agent-h">
        <span>Agent working…</span>
      </div>
      <div className="rp-demo-note">
        <b>Demo.</b> This search and the steps below are simulated for this walkthrough, not real output from Precedent Reasoning's case-law search.
      </div>
      <div className="steps-col">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const showIssues = i === 1 && issues && issues.length > 0;
          return (
            <div className={"step-row" + (last ? " last" : "")} key={i}>
              <div className="step-dotcol">
                <div className="step-dot" />
                {!last && <div className="step-line" />}
              </div>
              <div style={{ flex: 1 }}>
                <div className="step-tx">{s}</div>
                {showIssues && (
                  <div className="step-issues">
                    {issues.map((iss) => <span className="issue-chip" key={iss}>{iss}</span>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Results ----------------
function CaseBlock({ r, i }) {
  return (
    <div className="case" style={{ animationDelay: i * 120 + "ms" }}>
      <div className="case-top">
        <div style={{ minWidth: 0 }}>
          <div className="case-name">{r.case}</div>
          <div className="case-cite">
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" title="Illustrative — would link to the full judgment">{r.cite}</a>
            <span className="court">{r.court}</span>
          </div>
        </div>
        <BindingTag binding={r.binding} />
      </div>
      <div className="case-sub">What the court held</div>
      <div className="case-text">{r.holding}</div>
      <div className="case-sub">How it compares to your situation</div>
      <div className="case-text compare">{r.compare}</div>
    </div>
  );
}

function ResultsPanel({ results }) {
  return (
    <div className="rp">
      <div className="rp-head"><span>Results</span><span className="live demo">● illustrative demo data</span></div>
      <div className="rp-body">
        <div className="rp-demo-note">
          <b>Demo results.</b> These cases and citations are illustrative placeholders for this walkthrough, not real output from Precedent Reasoning's case-law search.
        </div>
        <p className="rp-intro">
          Here are the most relevant decisions for your situation, ranked by how closely they apply. This is
          legal information — what courts have decided — not legal advice.
        </p>
        {results.map((r, i) => <CaseBlock key={r.case} r={r} i={i} />)}
        <div className="rp-close">
          Always verify each citation against the original judgment, and check whether a case has since been
          overruled. For advice specific to your circumstances, consult a qualified solicitor.
        </div>
      </div>
    </div>
  );
}

// ---------------- Empty state ----------------
function EmptyState({ onPick, disabled }) {
  const groups = SCENARIOS.map((sc) => ({ cat: sc.category, q: sc.query }));
  return (
    <React.Fragment>
      <div className="intro-head">
        <h2>Precedent Reasoning</h2>
        <p>Find relevant Australian cases for your legal situation. Powered by AI.</p>
      </div>
      <div className="about">
        <h3>About this tool</h3>
        <p><strong>What it does:</strong> Describe your legal situation in plain English. The agent searches real NSW and Commonwealth court decisions that apply to your circumstances.</p>
        <p><strong>What you'll get:</strong> for each case — what the court held, its binding status, a link to the judgment, and how the facts compare to yours.</p>
        <p><strong>Important:</strong> this tool provides legal <em>information</em> only, not legal <em>advice</em>. Always verify case details and consult a qualified solicitor before making decisions.</p>
      </div>
      <div className="ex-label">Example legal scenarios</div>
      {groups.map((g) => (
        <div className="ex-group" key={g.cat}>
          <div className="ex-cat">{g.cat}</div>
          <button className="ex-q" disabled={disabled} onClick={() => onPick(g.q)}>{g.q}</button>
        </div>
      ))}
    </React.Fragment>
  );
}

// ---------------- App ----------------
function App({ theme, setTweak }) {
  const seed = uR(SCENARIOS.map(convoFromScenario)).current;
  const [convos, setConvos] = uS(seed);
  const [activeId, setActiveId] = uS(null);
  const [input, setInput] = uS("");
  const [open, setOpen] = uS(false);
  const timers = uR([]);
  const chatRef = uR(null);
  const bottomRef = uR(null);
  const taRef = uR(null);
  const stuckRef = uR(false);

  const active = convos.find((c) => c.id === activeId) || null;
  const searching = active && active.state === "searching";

  const update = uC((id, fn) => setConvos((prev) => prev.map((c) => (c.id === id ? fn(c) : c))), []);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  uE(() => {
    if (!stuckRef.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [convos, activeId]);

  uE(() => {
    const el = taRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  function handleNew() { clearTimers(); setActiveId(null); setInput(""); stuckRef.current = false; }
  function handleSelect(id) { clearTimers(); setActiveId(id); stuckRef.current = false; }
  function handleDelete(id) {
    setConvos((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId) setActiveId(null);
  }

  function run(text) {
    const t = text.trim();
    if (!t || searching) return;
    clearTimers();
    setInput("");
    stuckRef.current = false;

    const match = matchScenario(t);
    const results = match.results;
    const issues = match.issues;
    const steps = FULL_STEPS(results);
    const id = uid();

    const convo = { id, title: titleFor(t, match), situation: t, issues: [], results: [], steps: [steps[0]], state: "searching" };
    setConvos((prev) => [convo, ...prev]);
    setActiveId(id);

    // reveal issues with step 2
    timers.current.push(setTimeout(() => update(id, (c) => ({ ...c, issues, steps: steps.slice(0, 2) })), 750));
    timers.current.push(setTimeout(() => update(id, (c) => ({ ...c, steps: steps.slice(0, 3) })), 1500));
    timers.current.push(setTimeout(() => update(id, (c) => ({ ...c, steps: steps.slice(0, 4) })), 2350));
    timers.current.push(setTimeout(() => update(id, (c) => ({ ...c, steps: steps.slice(0, 5) })), 3150));
    timers.current.push(setTimeout(() => update(id, (c) => ({ ...c, steps: steps })), 3950));
    timers.current.push(setTimeout(() => update(id, (c) => ({ ...c, results, state: "done" })), 4750));
  }

  function onKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(input); } }
  function onScroll() {
    const el = chatRef.current; if (!el) return;
    stuckRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 40;
  }

  return (
    <div className="page-wrap">
      <DemoBanner />
      <div className="app">
        <div className={"scrim" + (open ? " show" : "")} onClick={() => setOpen(false)} />
        <Sidebar convos={convos} activeId={activeId} onSelect={handleSelect} onNew={handleNew} onDelete={handleDelete} open={open} onClose={() => setOpen(false)} />
        <div className="main">
          <div className="topbar">
            <button className="burger" aria-label="Menu" onClick={() => setOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
            </button>
            <span className="t-name">Precedent Reasoning <span className="demo-pill">Demo</span></span>
          </div>

          <div className="chat" ref={chatRef} onScroll={onScroll}>
            <div className="chat-inner">
              {!active && <EmptyState onPick={(q) => run(q)} disabled={!!searching} />}
              {active && (
                <div className="turn">
                  <div className="user-row"><div className="user-bub">{active.situation}</div></div>
                  {active.state === "searching" && <AgentStatus steps={active.steps} issues={active.issues} />}
                  {active.results.length > 0 && <ResultsPanel results={active.results} />}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="composer">
            <div className="composer-inner">
              <div className="field">
                <textarea ref={taRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
                  disabled={!!searching} maxLength={2000}
                  placeholder="Describe your legal situation…  (Enter to send, Shift+Enter for new line)" />
                <button className="send" disabled={!!searching || !input.trim()} onClick={() => run(input)}>
                  {searching ? "Searching…" : "Search"}
                </button>
              </div>
              <div className="cc">
                <a className="tosite" href="index.html">← Back to Precedent Reasoning</a>
                <span>{input.length}/2000</span>
              </div>
              <div className="disc">
                <b>Legal information, not legal advice.</b> AI can make mistakes — always verify case citations against the original judgment, and consult a qualified solicitor for advice specific to your situation.
              </div>
            </div>
          </div>
        </div>

        <TweaksPanel>
          <TweakSection label="Color theme" />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {Object.keys(THEMES).map((key) => (
              <ThemeSwatch key={key} id={key} active={theme === key} onClick={() => setTweak("theme", key)} />
            ))}
          </div>
        </TweaksPanel>
      </div>
    </div>
  );
}

function ThemeSwatch({ id, active, onClick }) {
  const th = THEMES[id];
  return (
    <button onClick={onClick} title={th.label}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 9, cursor: "pointer", textAlign: "left",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.08)", color: "inherit", font: "inherit" }}>
      <span style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
        <span style={{ width: 18, height: 18, background: th.swatch[0] }} />
        <span style={{ width: 18, height: 18, background: th.swatch[1] }} />
      </span>
      <span style={{ flex: 1, fontSize: 13.5 }}>{th.label}</span>
      {active && <span style={{ fontFamily: "var(--mono)", fontSize: 11, opacity: 0.7 }}>●</span>}
    </button>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "navy"
}/*EDITMODE-END*/;

function Root() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  uE(() => { applyTheme(t.theme); }, [t.theme]);
  return <App theme={t.theme} setTweak={setTweak} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
