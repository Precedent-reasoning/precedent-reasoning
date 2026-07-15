# Precedent Reasoning — Pricing Policy (Draft)

> **Status: draft.** This document describes the intended pricing model in plain
> language for internal review and for adapting into the landing page and Terms
> of Service. It is not itself a binding legal agreement. Before publishing
> equivalent language as official Terms, have it reviewed by counsel — in
> particular the interaction between this policy and the Apache-2.0 `LICENSE`
> should be checked so the two documents never appear to contradict each other.

## Summary

Precedent Reasoning is open source software. **The code is free.** What we
charge for is **running and customising it for you** — a managed cloud
deployment — so you don't have to manage infrastructure, GPUs, API keys, or
index maintenance yourself.

| | Free | Paid |
|---|---|---|
| Source code | Free (Apache-2.0) | — |
| Self-hosted deployment (your own devices/servers) | Free (Apache-2.0) | — |
| Managed cloud deployment, tailored to your needs | — | Get in touch — scoped and priced per engagement |

## 1. Open source use — free

The full source of Precedent Reasoning is released under the **Apache License,
Version 2.0** (see `LICENSE`). This grant is already in effect for anyone who
obtains the code, and this pricing policy does not — and legally cannot —
narrow it. Concretely, anyone may, at no cost:

- Run the full application (backend, ingestion pipeline, and frontend) on
  their own devices, servers, or cloud infrastructure.
- Use it for personal, academic, non-profit, or commercial purposes.
- Modify the source and use their modified version.
- Redistribute the original or modified source, subject to the Apache-2.0
  terms (attribution, stating changes, including the license and NOTICE file).

Self-hosting requires the operator to supply their own Anthropic API key and
to run their own case-law ingestion (`backend/ingest.py`) or otherwise obtain
the local index — those third-party and infrastructure costs are the
self-hoster's own, separate from anything Precedent Reasoning charges.

We do not, and will not, charge a license fee for the code itself or for
deploying it on infrastructure you control. Doing so would be inconsistent
with Apache-2.0, which cannot be revoked for copies already distributed under
it.

## 2. Managed cloud deployment — what's paid

Separately from the open source code, we offer to run and customise a
deployment of the product for organisations that don't want to manage
infrastructure, GPUs, API keys, or index maintenance themselves — the
**"Get in touch"** offering. This is not a self-serve tier with a fixed
price; it's scoped per engagement and typically includes:

- A fully managed cloud deployment, hosted and maintained by us.
- Custom integrations and workflows built around the customer's needs.
- Onboarding and ongoing support.

Paid engagements cover the cost of hosting, GPU inference for embedding/
reranking, Claude API usage, index upkeep, support, and the customisation
work itself — none of which are required to self-host the open source code
yourself.

## 3. What is *not* restricted

To avoid ambiguity, paid Cloud plans do **not** gate or restrict:

- Access to the source code or its ability to run self-hosted.
- The number of times someone may deploy the open source code on their own
  infrastructure.
- Forking, modifying, or redistributing the code under Apache-2.0.

## 4. Future changes

If pricing or the scope of the free/paid split changes, this document and the
landing page pricing section will be updated together, and any change will
apply prospectively — it will not attempt to alter the license terms already
granted for code already distributed.

---

*This draft was prepared to align the landing page copy with the stated
model: free for open source/self-hosted use, paid only for use of our hosted
Cloud service. Have this reviewed by counsel before treating it as final
Terms.*
