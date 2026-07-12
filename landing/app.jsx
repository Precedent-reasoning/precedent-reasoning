// app.jsx — root: composes sections + theme tweaks
const { useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "navy"
}/*EDITMODE-END*/;

function ThemeSwatch({ id, active, onClick }) {
  const th = THEMES[id];
  return (
    <button
      onClick={onClick}
      title={th.label}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "10px 12px", borderRadius: 9, cursor: "pointer", textAlign: "left",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.08)",
        color: "inherit", font: "inherit",
      }}
    >
      <span style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
        <span style={{ width: 18, height: 18, background: th.swatch[0] }} />
        <span style={{ width: 18, height: 18, background: th.swatch[1] }} />
      </span>
      <span style={{ flex: 1, fontSize: 13.5 }}>{th.label}</span>
      {active && <span style={{ fontFamily: "var(--mono)", fontSize: 11, opacity: 0.7 }}>●</span>}
    </button>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffectA(() => { applyTheme(t.theme); }, [t.theme]);

  return (
    <React.Fragment>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Pipeline />
        <Features />
        <Trust />
        <Coverage />
        <Pricing />
        <CTA />
      </main>
      <Footer />

      <TweaksPanel>
        <TweakSection label="Color theme" />
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {Object.keys(THEMES).map((id) => (
            <ThemeSwatch key={id} id={id} active={t.theme === id} onClick={() => setTweak("theme", id)} />
          ))}
        </div>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
