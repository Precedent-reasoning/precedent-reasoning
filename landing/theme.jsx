// theme.jsx — curated color themes + shared hooks
const { useState, useEffect, useRef } = React;

// Each theme is a set of CSS custom properties applied to :root.
const THEMES = {
  navy: {
    label: "Navy & Ink",
    swatch: ["oklch(0.16 0.025 255)", "oklch(0.66 0.15 250)"],
    vars: {
      "--bg": "oklch(0.16 0.025 255)",
      "--bg-2": "oklch(0.195 0.027 255)",
      "--bg-3": "oklch(0.235 0.03 255)",
      "--border": "oklch(0.32 0.03 255 / 0.9)",
      "--border-2": "oklch(0.40 0.035 255 / 0.6)",
      "--text": "oklch(0.96 0.008 255)",
      "--muted": "oklch(0.70 0.025 255)",
      "--faint": "oklch(0.55 0.022 255)",
      "--accent": "oklch(0.66 0.15 250)",
      "--accent-2": "oklch(0.76 0.15 250)",
      "--accent-ink": "oklch(0.16 0.03 255)",
      "--glow": "oklch(0.66 0.15 250 / 0.35)",
      "--good": "oklch(0.74 0.13 160)",
    },
  },
  oxblood: {
    label: "Oxblood",
    swatch: ["oklch(0.17 0.02 22)", "oklch(0.63 0.16 25)"],
    vars: {
      "--bg": "oklch(0.165 0.018 22)",
      "--bg-2": "oklch(0.20 0.022 22)",
      "--bg-3": "oklch(0.24 0.026 22)",
      "--border": "oklch(0.32 0.028 22 / 0.9)",
      "--border-2": "oklch(0.40 0.03 22 / 0.6)",
      "--text": "oklch(0.96 0.01 30)",
      "--muted": "oklch(0.70 0.024 28)",
      "--faint": "oklch(0.55 0.02 26)",
      "--accent": "oklch(0.63 0.16 25)",
      "--accent-2": "oklch(0.71 0.16 28)",
      "--accent-ink": "oklch(0.17 0.02 22)",
      "--glow": "oklch(0.63 0.16 25 / 0.32)",
      "--good": "oklch(0.74 0.13 150)",
    },
  },
  forest: {
    label: "Forest Green",
    swatch: ["oklch(0.16 0.02 165)", "oklch(0.70 0.14 160)"],
    vars: {
      "--bg": "oklch(0.155 0.018 165)",
      "--bg-2": "oklch(0.19 0.02 165)",
      "--bg-3": "oklch(0.23 0.024 165)",
      "--border": "oklch(0.31 0.026 165 / 0.9)",
      "--border-2": "oklch(0.39 0.03 165 / 0.6)",
      "--text": "oklch(0.96 0.01 160)",
      "--muted": "oklch(0.70 0.022 162)",
      "--faint": "oklch(0.55 0.02 162)",
      "--accent": "oklch(0.70 0.14 160)",
      "--accent-2": "oklch(0.78 0.14 160)",
      "--accent-ink": "oklch(0.16 0.02 165)",
      "--glow": "oklch(0.70 0.14 160 / 0.30)",
      "--good": "oklch(0.80 0.13 150)",
    },
  },
  graphite: {
    label: "Graphite",
    swatch: ["oklch(0.18 0.004 260)", "oklch(0.74 0.07 240)"],
    vars: {
      "--bg": "oklch(0.175 0.004 260)",
      "--bg-2": "oklch(0.21 0.005 260)",
      "--bg-3": "oklch(0.25 0.006 260)",
      "--border": "oklch(0.32 0.006 260 / 0.9)",
      "--border-2": "oklch(0.41 0.008 260 / 0.6)",
      "--text": "oklch(0.97 0.002 260)",
      "--muted": "oklch(0.71 0.005 260)",
      "--faint": "oklch(0.56 0.004 260)",
      "--accent": "oklch(0.74 0.07 240)",
      "--accent-2": "oklch(0.82 0.07 240)",
      "--accent-ink": "oklch(0.18 0.01 260)",
      "--glow": "oklch(0.74 0.07 240 / 0.26)",
      "--good": "oklch(0.78 0.10 160)",
    },
  },
};

function applyTheme(key) {
  const t = THEMES[key] || THEMES.navy;
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

// Intersection-based reveal-on-scroll. Returns a ref to attach.
function useReveal(options) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { el.classList.add("in"); return; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px", ...(options || {}) }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// A small wrapper that fades its children up when scrolled into view.
function Reveal({ as = "div", className = "", style, children, ...rest }) {
  const ref = useReveal();
  const Tag = as;
  return (
    <Tag ref={ref} className={"reveal " + className} style={style} {...rest}>
      {children}
    </Tag>
  );
}

Object.assign(window, { THEMES, applyTheme, useReveal, Reveal });
