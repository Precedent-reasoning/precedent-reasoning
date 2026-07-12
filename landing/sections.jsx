// sections.jsx — Nav, How it works, Features, Trust, Pricing, CTA, Footer (Australia-wide)
const { useState: useStateS, useEffect: useEffectS } = React;

const APP_URL = window.APP_URL || "Legal Case Finder App.html";
const GITHUB_URL = "https://github.com/Precedent-reasoning/precedent-reasoning";

function CloudGlyph({ s = 18 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.5 18h9a3.8 3.8 0 0 0 .4-7.58A5.6 5.6 0 0 0 6.2 9.7 3.4 3.4 0 0 0 7.5 18z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function GitHubGlyph({ s = 20 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.22.66.8.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Precedent Reasoning home">
      <span className="brand-badge">
        <img src="/logo-wordmark.png" alt="Precedent Reasoning" className="brand-wordmark" />
      </span>
    </a>
  );
}

const NAV_LINKS = [
  ["#how", "How it works"],
  ["#engine", "Under the hood"],
  ["#features", "Capabilities"],
  ["#trust", "Why trust it"],
  ["#pricing", "Pricing"],
];

function Nav() {
  const [stuck, setStuck] = useStateS(false);
  const [open, setOpen] = useStateS(false);
  useEffectS(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffectS(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <nav className={"nav" + (stuck || open ? " stuck" : "")} id="top">
      <div className="container nav-inner">
        <Brand />
        <div className="nav-links">
          {NAV_LINKS.map(([href, label]) => (
            <a className="nav-link" key={href} href={href}>{label}</a>
          ))}
        </div>
        <div className="nav-cta">
          <a
            className="nav-icon-link"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
          >
            <GitHubGlyph />
          </a>
          <a className="btn btn-ghost btn-sm" href={APP_URL}>Sign in</a>
          <a className="btn btn-primary btn-sm" href={APP_URL}>Start free</a>
          <button
            className="nav-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      {open && (
        <div className="nav-menu">
          {NAV_LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>
          ))}
          <div className="nav-menu-cta">
            <a className="btn btn-ghost" href={APP_URL}>Sign in</a>
            <a className="btn btn-primary" href={APP_URL}>Start free</a>
          </div>
        </div>
      )}
    </nav>
  );
}

const STEPS = [
  { n: "01", t: "Describe the situation", d: "Type what happened in everyday words. No Boolean operators, no legalese, no syntax to learn." },
  { n: "02", t: "The agent searches the case law", d: "It reformulates your description into legal issues, searches a pre-indexed database of NSW and Commonwealth case law, and reads the full text of the promising ones." },
  { n: "03", t: "See what was decided", d: "Get each holding, its binding status, and how the facts compare to yours — with a link straight to the full judgment." },
];

function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>From a plain-English description to on-point precedent.</h2>
          <p>Three steps. No training, no query language, no hours lost to keyword guessing.</p>
        </Reveal>
        <div className="steps">
          {STEPS.map((s, i) => (
            <Reveal className="step card" key={s.n} style={{ transitionDelay: i * 90 + "ms" }}>
              <div className="step-n">{s.n}</div>
              <div className="step-line" />
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const PIPELINE_STEPS = [
  { n: "01", t: "Understand the query", d: "A language model turns your plain-English description into the legal issues and search terms that actually matter." },
  { n: "02", t: "Search two ways, then merge", d: "An embedding model matches your query by meaning against a pre-indexed case law database, while a separate keyword index catches exact terms and citations — the two result sets are combined." },
  { n: "03", t: "Re-rank for relevance", d: "A dedicated reranking model re-examines the combined candidates against your query and reorders them by how relevant they actually are, not just how similar." },
  { n: "04", t: "Read, reason, and cite", d: "The language model reads the full text of the strongest candidates, checks each case's binding status, and explains how the facts compare to yours — always with a link back to the source judgment." },
];

function Pipeline() {
  return (
    <section className="section" id="engine">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">Under the hood</span>
          <h2>Searches real cases, then provides the most relevant ones.</h2>
          <p>Retrieval and reasoning are split across a few purpose-built steps, each doing one part of the job well.</p>
        </Reveal>
        <div className="steps">
          {PIPELINE_STEPS.map((s, i) => (
            <Reveal className="step card" key={s.n} style={{ transitionDelay: i * 90 + "ms" }}>
              <div className="step-n">{s.n}</div>
              <div className="step-line" />
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { m: "✓", t: "No invented citations", d: "Every citation is retrieved from the published record, never generated. Each links straight to the judgment, so you can read and verify it before you rely on it." },
  { m: "⌕", t: "Hybrid case-law search", d: "Combines meaning-based and keyword search over a regularly refreshed index of real NSW and Commonwealth court decisions." },
  { m: "⊘", t: "Still good law?", d: "Flags later treatment — whether a decision has been overturned, distinguished, or doubted on appeal — so you don't lean on authority that's since been undone." },
  { m: "§", t: "Holding & binding status", d: "Each case shows what the court held and whether it binds in its own jurisdiction, binds nationally, or is only persuasive in yours — so you know the weight it carries." },
  { m: "≈", t: "Distinguish or rely", d: "Every result shows where the facts line up with yours and where they diverge — the points you'd use to rely on an authority or distinguish it." },
  { m: "¶", t: "Plain-language issues", d: "Reformulates your description into the legal issues that actually matter, then searches on those — not just your words." },
];

function Features() {
  return (
    <section className="section" id="features">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">Capabilities</span>
          <h2>Built for the way legal research actually works.</h2>
          <p>Every result traces back to a published Australian judgment — the answer and the authority, together.</p>
        </Reveal>
        <div className="features">
          {FEATURES.map((f, i) => (
            <Reveal className="feat" key={f.t} style={{ transitionDelay: (i % 3) * 80 + "ms" }}>
              <div className="feat-mark" aria-hidden="true">{f.m}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const TRUST_ITEMS = [
  { t: "Information, not advice", d: "It surfaces what courts decided and the principles that apply. It won't tell you what to do or predict your outcome." },
  { t: "Every claim is cited", d: "Each case links to its full judgment, so you can read the source and check it yourself." },
  { t: "Your history stays yours", d: "Your research history is encrypted, never sold, and never used to train models." },
];

function Trust() {
  return (
    <section className="section sec" id="trust">
      <div className="container sec-wrap">
        <Reveal>
          <span className="eyebrow">Trust &amp; transparency</span>
          <h2 style={{ fontSize: "clamp(28px,3.6vw,42px)", lineHeight: 1.1, letterSpacing: "-0.02em", fontWeight: 600, marginTop: 16 }}>
            Confidence comes from the source.
          </h2>
          <p style={{ color: "var(--muted)", marginTop: 16, fontSize: 18 }}>
            Precedent Reasoning gives you legal information drawn from Australia's public court record — never advice, and never
            a black box. Every case it surfaces links back to the judgment it came from.
          </p>
          <div className="sec-badges">
            <span className="badge">Linked to source</span>
            <span className="badge">No legal advice</span>
            <span className="badge">Never trains on your data</span>
          </div>
        </Reveal>
        <Reveal className="sec-list" style={{ transitionDelay: "90ms" }}>
          {TRUST_ITEMS.map((s) => (
            <div className="sec-item" key={s.t}>
              <h4>{s.t}</h4>
              <p>{s.d}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

const COV_STATS = [
  { l: "Jurisdictions", v: "NSW & Commonwealth", n: "New South Wales courts and tribunals, plus the federal courts" },
  { l: "Courts & tribunals", v: "High Court → local", n: "Superior, intermediate, and key tribunals" },
  { l: "Source database", v: "Public court record", n: "Read from the published judgment text" },
  { l: "Updated", v: "Regularly refreshed", n: "The index is rebuilt on a regular schedule to pick up new judgments" },
];
const COV_COURTS = [
  "High Court of Australia", "Federal Court", "Full Federal Court", "Fair Work Commission", "AAT",
  "NSW Court of Appeal", "NSW Court of Criminal Appeal", "NSW Supreme Court",
  "NSW District Court", "NSW Local Court", "NSW Land & Environment Court", "NCAT",
];

function Coverage() {
  return (
    <section className="section" id="coverage" style={{ paddingTop: 0 }}>
      <div className="container">
        <Reveal className="section-head" style={{ maxWidth: 720 }}>
          <span className="eyebrow">Coverage &amp; currency</span>
          <h2>What it searches — and how current it is.</h2>
          <p>Every result is drawn from the published record of these courts and tribunals, held in a local index that's rebuilt on a regular schedule to pick up new judgments.</p>
        </Reveal>
        <Reveal className="coverage">
          <div className="cov-stats">
            {COV_STATS.map((s) => (
              <div className="cov-stat" key={s.l}>
                <span className="cov-label">{s.l}</span>
                <div className="cov-value">{s.v}</div>
                <p className="cov-note">{s.n}</p>
              </div>
            ))}
          </div>
          <div className="cov-courts">
            <span className="cov-courts-lbl">Courts &amp; tribunals indexed</span>
            <div className="cov-chips">
              {COV_COURTS.map((c) => <span className="cov-chip" key={c}>{c}</span>)}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const TIERS = [
  { name: "Free", price: "Free", unit: "forever", badge: "Apache-2.0 licensed", desc: "Run the full stack yourself — your infrastructure, your data, your resources.",
    feats: ["Full source code (Apache-2.0)", "Self-host on your own devices or servers", "No hosting or infrastructure from us", "No support or maintenance included"],
    cta: "View source on GitHub", href: GITHUB_URL, external: true, primary: false, flag: "Self-hosted", flagAlt: true },
  { name: "Get in Touch", price: "Get In Touch", unit: "", badge: "Cloud & custom deployments", desc: "Our hosted cloud service, tailored and customised to your organisation's needs.",
    feats: ["Fully managed cloud service", "Custom integrations & workflows", "Onboarding & support", "Tailored to your requirements"],
    cta: "Contact us", primary: true, flag: "Recommended" },
];
function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <Reveal className="section-head" style={{ maxWidth: 720 }}>
          <span className="eyebrow">Pricing</span>
          <h2>Open source, or fully managed — your call.</h2>
          <p>The full source is released under Apache-2.0 — self-host it for free, forever, on your own infrastructure with your own API key. Prefer a fully managed service, tailored to your organisation? Get in touch and we'll set up cloud hosting and integrations built around your needs.</p>
        </Reveal>
        <div className="price-grid">
          {TIERS.map((t, i) => (
            <Reveal className={"tier" + (t.primary ? " feat-tier" : "")} key={t.name} style={{ transitionDelay: i * 80 + "ms" }}>
              {t.flag && <span className={"tier-flag" + (t.flagAlt ? " tier-flag-alt" : "")}>{t.flag}</span>}
              <div className="tier-head">
                <span className="tier-name">{t.name}</span>
              </div>
              <div className="tier-price">{t.price}{t.unit && <small>{t.unit}</small>}</div>
              {t.badge && <div className="tier-note">{t.badge}</div>}
              <div className="tier-desc">{t.desc}</div>
              <ul className="tier-feats">
                {t.feats.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <a
                className={"btn " + (t.primary ? "btn-primary" : "btn-ghost")}
                href={t.href || APP_URL}
                {...(t.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >{t.cta}</a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <Reveal className="cta-band">
          <h2>Stop guessing how it'll go.</h2>
          <p>See how courts across Australia have ruled on situations like yours — in the time it takes to describe one.</p>
          <div className="cta-actions">
            <a className="btn btn-primary btn-lg" href={APP_URL}>Search your situation</a>
            <a className="btn btn-ghost btn-lg" href="#pricing">Compare plans</a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FOOT = [
  { h: "Product", links: [["How it works", "#how"], ["Under the hood", "#engine"], ["Capabilities", "#features"], ["Coverage", "#coverage"], ["Pricing", "#pricing"], ["Source code", GITHUB_URL], ["Sign in", APP_URL]] },
  { h: "Company", links: [["About", "#"], ["Careers", "#"], ["Contact", "#"]] },
  { h: "Legal", links: [["Terms", "#"], ["Privacy", "#"], ["Disclaimer", "#"], ["License (Apache-2.0)", GITHUB_URL + "/blob/main/LICENSE"]] },
];

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="foot-grid">
          <div className="foot-col">
            <Brand />
            <p className="foot-about">Plain-language search across published NSW and Commonwealth court decisions, with citations you can actually use.</p>
          </div>
          {FOOT.map((c) => (
            <div className="foot-col" key={c.h}>
              <h5>{c.h}</h5>
              {c.links.map(([label, href]) => <a href={href} key={label}>{label}</a>)}
            </div>
          ))}
        </div>
        <p className="foot-disc">
          Precedent Reasoning provides legal information — what courts have decided and the principles that apply —
          for general educational purposes only. It is not a law firm, does not provide legal advice, and use of the
          service does not create a solicitor–client relationship. AI can make mistakes; always verify citations
          against the original judgment. Case names and results shown on this page are illustrative.
        </p>
        <div className="foot-bottom">
          <p>© 2026 Precedent Reasoning.</p>
          <p>For people, researchers, and advocates across Australia.</p>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Nav, HowItWorks, Pipeline, Features, Trust, Coverage, Pricing, CTA, Footer, Brand });
