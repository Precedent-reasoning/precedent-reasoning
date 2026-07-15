# Data Sources & Licensing

This project's code is Apache-2.0 (see [`LICENSE`](LICENSE)). The **case-law
data** it indexes is licensed separately, by a different party, under
different terms. This document exists to give proper attribution and to
summarise the obligations that travel with that data — including for anyone
who self-hosts this project and builds their own index from the same source.

**This is not legal advice.** If you're planning a commercial or
public-facing deployment, have the specifics reviewed by counsel — see the
flagged item below in particular.

## The corpus

> Butler, Umar (2025). *Open Australian Legal Corpus* (v7.1.0). Isaacus.
> <https://huggingface.co/datasets/isaacus/open-australian-legal-corpus>
> DOI: [10.57967/hf/2784](https://doi.org/10.57967/hf/2784)

Licensed under [Creative Commons Attribution 4.0 International (CC BY
4.0)](https://creativecommons.org/licenses/by/4.0/).

[`backend/ingest.py`](backend/ingest.py) filters the corpus to `type ==
"decision"` documents where `jurisdiction` is `new_south_wales` or
`commonwealth`, then chunks and embeds the text for retrieval. That
filtering, chunking, and embedding is a modification of the original corpus
for the purposes of the CC BY 4.0 license.

## The underlying judgments

The corpus's own per-source license file (`LICENCE.md` in the [dataset
repository](https://huggingface.co/datasets/isaacus/open-australian-legal-corpus))
records that its creator obtained explicit permission from each source to
compile this data. The terms below are summarised from each court's own
copyright policy — anyone reproducing judgment text (verbatim or in large
excerpts) should read the primary source rather than rely solely on this
summary, since these policies can change.

| Source | Reproduction terms | Reference |
|---|---|---|
| NSW Caselaw | Reproduction/publication of decisions is authorised provided it is accurate and in proper context, does not indicate (directly or indirectly) that it is an official version, remains consistent with the current official version, complies with any non-publication/suppression order, and does not reproduce editorial material (e.g. headnotes) without further authority. | [caselaw.nsw.gov.au/policy.html](https://www.caselaw.nsw.gov.au/policy.html) |
| Federal Court of Australia | Judgments and decisions (or excerpts) may be reproduced or published — **including commercially** — in unaltered form, provided it is acknowledged as a judgment/decision of the Court, and any added commentary is clearly attributed to its own publisher, not the Court. | [fedcourt.gov.au/copyright](https://www.fedcourt.gov.au/copyright) |
| High Court of Australia | Material may be downloaded, displayed, printed, and reproduced in unaltered form, retaining the copyright notice, for **personal, non-commercial use, or use within an organisation**. This is more restrictive than the Federal Court's terms and has no explicit commercial carve-out for judgments. | [hcourt.gov.au/terms-use](https://www.hcourt.gov.au/terms-use) |

### ⚠️ Flagged for legal review: High Court content and commercial use

Unlike the Federal Court, the High Court's stated terms don't include an
explicit "commercial use is fine for judgments specifically" carve-out —
the broader "personal/non-commercial or use within an organisation" framing
applies instead. High Court decisions are explicitly in scope for this
project's agent (see the system prompt in [`backend/agent.py`](backend/agent.py)),
which never shows users the raw judgment text — only an AI-generated
summary (what the court held, how it compares) plus the citation and a link
back to the source. That's a materially different posture from verbatim
republication, but it hasn't been tested against this specific term. **Before
offering any paid/commercial deployment** (see [`PRICING_POLICY.md`](PRICING_POLICY.md)),
this should be reviewed by counsel.

## What the product actually does with this data

- The agent never returns raw judgment text to the end user. `fetch_case`
  retrieves passages for Claude to read internally; what's shown to users is
  Claude's own summary — "What the court held" and "How it compares to your
  situation" — plus the citation and a link to the original judgment.
- Every case surfaced links back to its source (`caselaw.nsw.gov.au`,
  `judgments.fedcourt.gov.au`, etc.) — see `CLAUDE.md` → *Important
  Constraints*.

## Third-party models

- **Embedding**: [`nomic-ai/nomic-embed-text-v1.5`](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5) — Apache-2.0.
- **Reranker**: [`zeroentropy/zerank-1-small-reranker`](https://huggingface.co/zeroentropy/zerank-1-small-reranker) — Apache-2.0.

Both are fully permissive; no attribution is legally required, though it's
credited here as good practice.

## If you self-host

Running `backend/ingest.py` pulls the same corpus under the same CC BY 4.0
terms. If you deploy the resulting product publicly, the attribution
obligation above applies to your deployment too — it does not come
pre-satisfied by this repository's own license. This repo's `LICENSE`
(Apache-2.0) covers the *code*; it says nothing about the *data*, which is
licensed separately by its own creator under the terms described here.
