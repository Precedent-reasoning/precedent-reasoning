// case-data.jsx — shared illustrative Australian case data for landing + app
// All case names and citations are fictional and for demonstration only.

const SCENARIOS = [
  {
    key: "deposit",
    category: "Consumer & Contracts",
    chip: "Buyer is backing out of a business sale",
    query: "I agreed to sell my small business and the buyer is now backing out at the last minute. Can I keep their deposit and what are my options?",
    issues: ["Repudiation of a contract of sale", "Forfeiture of deposit", "Whether a deposit is a penalty"],
    results: [
      { case: "Harborne v Whitlam Holdings Pty Ltd", court: "Supreme Court of NSW", cite: "[2021] NSWSC 488", binding: "nsw", rel: 0.95, fit: "onpoint",
        holding: "A vendor may forfeit a deposit of up to 10% as a genuine earnest where the purchaser wrongfully repudiates the contract.",
        compare: "Like your situation, the purchaser walked away after exchange — the Court allowed the vendor to retain the standard 10% deposit." },
      { case: "Ferraro v Delmonte", court: "NSW Court of Appeal", cite: "[2019] NSWCA 211", binding: "nsw", rel: 0.89, fit: "related",
        holding: "Whether conduct amounts to repudiation is assessed objectively, from the perspective of a reasonable innocent party.",
        compare: "Relevant to proving the buyer's 'backing out' was a repudiation entitling you to terminate and forfeit the deposit." },
      { case: "Brennan v Eastside Café Group Pty Ltd", court: "High Court of Australia", cite: "[2018] HCA 34", binding: "nat", rel: 0.82, fit: "caution",
        holding: "A forfeiture clause must reflect a genuine pre-estimate of loss; an excessive deposit may be relieved against as an unenforceable penalty.",
        compare: "A caution: if your deposit was well above the usual 10%, a court may order part of it returned." },
    ],
  },
  {
    key: "council",
    category: "Property & Planning",
    chip: "Council refused my granny flat with no reasons",
    query: "I applied for approval to build a granny flat and the council knocked it back with no explanation and never let me respond to their concerns. Do I have any rights here?",
    issues: ["Procedural fairness", "Duty to give reasons", "Merits review in the Land and Environment Court"],
    results: [
      { case: "Patel v Northern Rivers Council", court: "Land and Environment Court", cite: "[2022] NSWLEC 88", binding: "nsw", rel: 0.94, fit: "onpoint",
        holding: "A consent authority must afford procedural fairness and give reasons sufficient for an applicant to understand why consent was refused.",
        compare: "Directly on point — the council's refusal 'with no explanation' may breach the duty to give adequate reasons." },
      { case: "Kostas v Eastlake City Council", court: "Land and Environment Court", cite: "[2020] NSWLEC 1123", binding: "nsw", rel: 0.88, fit: "related",
        holding: "Failing to give an applicant an opportunity to address concerns before refusal can render the determination invalid.",
        compare: "Supports your concern that you were 'never let to respond' before the application was knocked back." },
      { case: "Whitfield v Council of the City of Harbour", court: "NSW Court of Appeal", cite: "[2017] NSWCA 304", binding: "nsw", rel: 0.79, fit: "related",
        holding: "Merits review in the Land and Environment Court proceeds de novo, so a flawed council process can be cured on appeal.",
        compare: "A practical path forward: you may be able to seek a fresh review rather than challenge the council's reasons alone." },
    ],
  },
  {
    key: "relocation",
    category: "Family Law",
    chip: "My ex wants to relocate interstate with our kids",
    query: "My ex wants to move to Queensland with our kids and I don't agree. What usually happens in these situations and what do the courts look at?",
    issues: ["Relocation of children", "Best interests of the child", "Parental responsibility"],
    results: [
      { case: "Marsden & Marsden", court: "Federal Circuit and Family Court", cite: "[2021] FedCFamC1A 102", binding: "fed", rel: 0.96, fit: "onpoint",
        holding: "Relocation decisions turn on the best interests of the child, not the freedom of movement of either parent.",
        compare: "The central question won't be your ex's wish to move, but what arrangement best serves your children." },
      { case: "Tran & Nguyen", court: "Full Court (Family)", cite: "[2019] FamCAFC 77", binding: "fed", rel: 0.90, fit: "related",
        holding: "A court must weigh the child's relationship with both parents and the practical effect of distance on time spent with the non-moving parent.",
        compare: "Relevant to arguing how a move to Queensland would reduce the time your children spend with you." },
      { case: "Easton & Easton", court: "High Court of Australia", cite: "[2016] HCA 14", binding: "nat", rel: 0.81, fit: "related",
        holding: "There is no presumption for or against relocation; each case depends entirely on its own facts.",
        compare: "Reassurance that the court starts from a neutral position — the outcome is not predetermined either way." },
    ],
  },
];

const DEFAULT_RESULTS = [
  { case: "Lindholm v Garrison Holdings Pty Ltd", court: "Supreme Court of NSW", cite: "[2021] NSWSC 411", binding: "nsw", rel: 0.85, fit: "related",
    holding: "Summary judgment is inappropriate where material facts about the parties' conduct remain genuinely in dispute.",
    compare: "Where the facts are contested, a court is unlikely to decide the matter without a full hearing." },
  { case: "Akhtar v Coastal Mutual Insurance Ltd", court: "Federal Court of Australia", cite: "[2020] FCA 645", binding: "fed", rel: 0.80, fit: "related",
    holding: "Ambiguous terms in a standard-form contract are construed against the party that drafted them.",
    compare: "If a contract term is unclear, the interpretation favouring you (the non-drafting party) is preferred." },
  { case: "Whitmore v Cedar Ridge Owners Corporation", court: "NSW Civil and Administrative Tribunal", cite: "[2019] NSWCATCD 233", binding: "nsw", rel: 0.74, fit: "caution",
    holding: "A claimant must exhaust an agreement's internal dispute procedure before commencing proceedings.",
    compare: "You may need to follow any internal complaint process first before escalating the dispute." },
];

const BINDING = {
  nsw: { label: "Binding · NSW", strong: true },
  vic: { label: "Binding · VIC", strong: true },
  qld: { label: "Binding · QLD", strong: true },
  fed: { label: "Binding · Federal", strong: true },
  nat: { label: "Binding · National", strong: true },
  persuasive: { label: "Persuasive", strong: false },
};

const SCENARIO_KWS = [
  { key: "deposit", kws: ["deposit", "business", "sell", "sold", "buyer", "backing", "contract", "earnest"] },
  { key: "council", kws: ["council", "granny", "flat", "approval", "build", "planning", "da ", "consent", "refus"] },
  { key: "relocation", kws: ["ex", "kids", "child", "children", "move", "relocat", "queensland", "custody", "parent"] },
];

function scoreScenarios(q) {
  const s = (q || "").toLowerCase();
  let best = null, score = 0;
  for (const m of SCENARIO_KWS) {
    const n = m.kws.reduce((a, k) => a + (s.includes(k) ? 1 : 0), 0);
    if (n > score) { score = n; best = m.key; }
  }
  return { best, score };
}

// App fallback: always returns something usable.
function matchScenario(q) {
  const { best } = scoreScenarios(q);
  const sc = SCENARIOS.find((x) => x.key === best);
  return sc ? sc : { issues: ["General legal principles"], results: DEFAULT_RESULTS };
}

// Landing demo: honest matching — returns null unless the query clearly
// matches one of the scripted sample situations.
function matchScenarioStrict(q) {
  const { best, score } = scoreScenarios(q);
  if (!best || score < 2) return null;
  return SCENARIOS.find((x) => x.key === best) || null;
}

Object.assign(window, { SCENARIOS, DEFAULT_RESULTS, BINDING, matchScenario, matchScenarioStrict });
