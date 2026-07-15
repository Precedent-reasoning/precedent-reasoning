// search.jsx — interactive hero search demo (Australia-wide) + Hero section
const { useState, useEffect, useRef, useCallback } = React;

const APP_URL_HERO = window.APP_URL || "demo.html";
const APP_LABEL_HERO = window.APP_LABEL || "See a demo";

function SearchIcon({ s = 18 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BindingTag({ binding }) {
  const b = BINDING[binding] || BINDING.persuasive;
  return <span className={"tag " + (b.strong ? "win" : "loss")}><span aria-hidden="true">{b.strong ? "▲" : "◆"}</span> {b.label}</span>;
}

const FIT_LABELS = {
  onpoint: { label: "Directly on point", cls: "on" },
  related: { label: "Related principle", cls: "rel" },
  caution: { label: "Caution", cls: "warn" },
};

function FitTag({ fit }) {
  const f = FIT_LABELS[fit] || FIT_LABELS.related;
  return <span className={"fit " + f.cls}>{f.label}</span>;
}

function ResultRow({ r, i }) {
  return (
    <div className="res" style={{ animationDelay: i * 80 + "ms" }}>
      <div className="res-case">{r.case}</div>
      <div className="res-meta">
        <span className="cite">{r.cite}</span>
        <span>{r.court}</span>
      </div>
      <div className="res-fit"><FitTag fit={r.fit} /></div>
      <div className="res-hold">“{r.holding}”</div>
      <div className="res-compare">
        <span className="lbl">vs your facts</span>
        <span>{r.compare}</span>
      </div>
      <div style={{ gridColumn: "1 / -1", marginTop: 8 }}><BindingTag binding={r.binding} /></div>
    </div>
  );
}

function HeroSearch() {
  const first = SCENARIOS[0];
  const [query, setQuery] = useState(first.query);
  const [status, setStatus] = useState("done"); // loading | done
  const [results, setResults] = useState(first.results);
  const [noMatch, setNoMatch] = useState(false);
  const taRef = useRef(null);

  const run = useCallback((q) => {
    const text = (q != null ? q : query).trim();
    if (!text) return;
    setStatus("loading");
    setTimeout(() => {
      const sc = matchScenarioStrict(text);
      if (sc) {
        setResults(sc.results);
        setNoMatch(false);
      } else {
        setResults([]);
        setNoMatch(true);
      }
      setStatus("done");
    }, 950);
  }, [query]);

  const pick = (sc) => { setQuery(sc.query); run(sc.query); };

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } };

  return (
    <div className="demo" role="region" aria-label="Search demo">
      <div className="demo-bar">
        <div className="lights"><i></i><i></i><i></i></div>
        <div className="addr"><SearchIcon s={13} /> cases</div>
        <span className="demo-tag">illustrative demo</span>
      </div>
      <div className="demo-body">
        <div className="search-field">
          <textarea
            ref={taRef}
            className="qi"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Describe your legal situation in plain English…"
            rows={2}
            aria-label="Describe your situation"
          ></textarea>
          <button className="search-go" onClick={() => run()} disabled={status === "loading"} aria-label="Search cases">
            <SearchIcon s={18} />
          </button>
        </div>

        <div className="chips">
          <span className="chip-label">Try a sample situation</span>
          {SCENARIOS.map((sc) => (
            <button key={sc.key} className="chip" onClick={() => pick(sc)}>{sc.chip}</button>
          ))}
        </div>

        <div className="results">
          <div className="results-head">
            <span aria-live="polite">
              {status === "loading"
                ? "Searching case law…"
                : noMatch
                ? "No matching sample situation"
                : results.length + " decisions · ranked by how closely they apply"}
            </span>
          </div>
          {status === "loading" ? (
            <div className="res-list">
              {[0, 1, 2].map((i) => (
                <div className="sk" key={i}>
                  <div className="sk-line" style={{ width: "52%" }}></div>
                  <div className="sk-line" style={{ width: "30%", marginTop: 10, height: 9 }}></div>
                  <div className="sk-line" style={{ width: "88%", marginTop: 12 }}></div>
                </div>
              ))}
            </div>
          ) : noMatch ? (
            <div className="demo-notice">
              <p>
                <b>This demo is scripted</b> — it only knows the three sample situations above.
                In the full product, the agent searches a pre-indexed database of NSW and Commonwealth case law for whatever you describe.
              </p>
              <a className="btn btn-primary btn-sm" href={APP_URL_HERO}>{APP_LABEL_HERO}</a>
            </div>
          ) : (
            <div className="res-list">
              {results.map((r, i) => <ResultRow key={r.case} r={r} i={i} />)}
            </div>
          )}
        </div>

        <p className="demo-foot">All case names and results in this demo are illustrative. Precedent Reasoning surfaces published decisions and provides legal information, not legal advice.</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <header className="hero">
      <div className="container hero-grid">
        <div>
          <span className="eyebrow">AI legal research · Australia</span>
          <h1>Find the cases that <span className="em">matter to yours.</span></h1>
          <p className="hero-sub">
            Describe your legal situation in plain English. Precedent Reasoning searches NSW and Commonwealth case law
            to surface relevant decisions and explain how they compare.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary btn-lg" href={APP_URL_HERO}>{APP_LABEL_HERO}</a>
          </div>
          <div className="hero-trust">
            <span className="trust-stat"><b>NSW</b> &amp; Commonwealth courts</span>
            <span className="dot"></span>
            <span className="trust-stat">Drawn from real cases</span>
            <span className="dot"></span>
            <span className="trust-stat">Information, not advice</span>
          </div>
          <div className="hero-powered">
            <span className="powered-lbl">Powered by</span>
            <div className="powered-items">
              <span className="powered-item"><span className="powered-dot"></span>Open Australian Legal Corpus</span>
              <span className="powered-item"><span className="powered-dot"></span>NSW &amp; Commonwealth courts</span>
            </div>
          </div>
        </div>
        <div>
          <HeroSearch />
        </div>
      </div>
    </header>
  );
}

Object.assign(window, { Hero, HeroSearch, SearchIcon, BindingTag, FitTag });
