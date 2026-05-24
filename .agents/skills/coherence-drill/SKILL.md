---
name: coherence-drill
description: Two-phase skill for stress-testing your own system design propositions. Phase 1 guides the user to articulate their system proposition using structured prompts (entities, boundaries, data flow, state changes). Phase 2 grills them one question at a time, specifically hunting for incoherence — contradictions, phantom bridges, missing transitions, read/write mismatches, and assumptions with no enforcement. Use when user wants to stress-test their own idea before writing code, says "grill me on my design", wants to find holes in a proposition, or wants to validate that a system concept hangs together architecturally and structurally.
---

# Coherence Drill

Two phases: you articulate your proposition, I find where it breaks.

## Phase 1 — State your proposition

Answer these in order. Be specific; vague answers produce vague questions.

1. **What problem does this solve?** One sentence, no jargon.
2. **What is the core data shape?** Name the main entities and their key fields.
3. **What are the system boundaries?** What is inside this system vs. delegated elsewhere?
4. **What is the primary data flow?** Trigger → transform → persist → output. One path only.
5. **What changes over time?** Which entities mutate, and what events cause it?
6. **How does the consumer read state?** Synchronously from DB? Projection? Event stream?

If you cannot answer one, say so — that gap is the first thing we drill.

## Phase 2 — Coherence grilling

One question at a time. Each question targets a specific type of incoherence:

| Incoherence type           | What I'm looking for                                                     |
| -------------------------- | ------------------------------------------------------------------------ |
| **Boundary leak**          | Responsibility implicitly assumed inside the system that belongs outside |
| **Phantom bridge**         | Two parts that need to communicate but have no defined mechanism         |
| **State contradiction**    | Two rules or flows that put the same entity in incompatible states       |
| **Undefined transition**   | An event or edge case with no described handler                          |
| **Read/write mismatch**    | Write model produces data the read model cannot reconstruct              |
| **Consistency assumption** | A "this always happens" claim with no enforcement mechanism              |
| **Coupling leak**          | Two modules share a concept that should be independent                   |

After each answer, I either close that branch or drill deeper before moving on.

### Foundational knowledge prompts

For every question, before waiting for the answer, include a **"What you need to know"** block:

- **Concept**: Name the core CS/SE concept at stake (e.g. eventual consistency, idempotency, normalisation, CAP theorem, CQRS, two-phase commit).
- **One-liner**: A single sentence defining the concept in plain terms.
- **Why it matters here**: One sentence connecting the concept to _this specific question_.
- **Go deeper**: One canonical reference — a chapter from a well-known book, an RFC, a Wikipedia article, or a named paper (e.g. _Designing Data-Intensive Applications_ ch. 5, RFC 7231 §4.2.2, Lamport 1978). If the source is a well-known stable web resource (RFC, Wikipedia, Martin Fowler's bliki, major spec sites), include a direct URL alongside the named reference.

If a question touches multiple concepts, list each one. If the concept is too domain-specific to have a canonical reference, name the closest analogue.

## Rules

- No fixes suggested during grilling — that comes after.
- If your answer reveals an unstated assumption, it joins the open questions list.
- We stop when every branch either holds or has a named gap.
- After grilling, I produce a **gap list**: unresolved incoherences ranked by impact.
