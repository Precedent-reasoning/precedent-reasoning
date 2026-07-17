# Data Sources & Licensing

This project's code is AGPL-3.0 (see [`LICENSE`](LICENSE)). The **case-law
data** it indexes is licensed separately, by a different party, under
different terms. This document exists to give proper attribution and to
summarise the obligations that travel with that data — including for anyone
who self-hosts this project and builds their own index from the same source.

**This is not legal advice.** The summaries below reflect a direct reading of
each source's current published terms, but policies can change and this
isn't a substitute for counsel if you're planning a commercial or
public-facing deployment.

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

The table below is quoted/summarised directly from each court's own current
policy page (fetched and verified against the live page text as of July
2026), not from the corpus's own compiled summary — an earlier draft of this
document relied on the corpus's `LICENCE.md` for the High Court row, which
turned out to describe more restrictive terms than the court's actual
current page states; that's been corrected below. Anyone reproducing
judgment text (verbatim or in large excerpts) should still check the primary
source before relying on this table, since these policies can change.

| Source | Reproduction terms | Reference |
|---|---|---|
| NSW Caselaw | Reproduction/publication of decisions is authorised provided it is accurate and in proper context, does not indicate (directly or indirectly) that it is an official version, remains consistent with the current official version, complies with any non-publication/suppression order, and does not reproduce editorial material (e.g. headnotes) without further authority. No commercial/non-commercial distinction is drawn. | [caselaw.nsw.gov.au/policy.html](https://www.caselaw.nsw.gov.au/policy.html) |
| Federal Court of Australia | Judgments and decisions (or excerpts) may be reproduced or published — **including commercially** — in unaltered form, provided it is acknowledged as a judgment/decision of the Court, any added commentary is clearly attributed to its own publisher (not the Court), and the source the judgment was copied from (e.g. AustLII) is acknowledged. | [fedcourt.gov.au/copyright](https://www.fedcourt.gov.au/copyright) |
| High Court of Australia | Material on the site "may [be used and reproduced] for commercial and non-commercial purposes without further permission", provided you: ensure accuracy; use it respectfully and not in a misleading context; attribute the source as the High Court of Australia; and indicate the reproduction is a copy of the version at the original URL. Reproductions must not be represented as official or as endorsed by the Court. | [hcourt.gov.au/terms-use](https://www.hcourt.gov.au/terms-use) |

All three permit commercial reproduction of judgment text under broadly
similar conditions: accuracy, clear attribution to the originating court,
and no implication of official/endorsed status. None of them impose a
CC-BY-style requirement to also credit the corpus itself — that obligation
comes from the corpus's own CC BY 4.0 license (above), separately from these
per-court terms.

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
(AGPL-3.0) covers the *code*; it says nothing about the *data*, which is
licensed separately by its own creator under the terms described here.
