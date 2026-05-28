---
name: feature-patterns
description: Explains the technological patterns and data flows behind a feature before any code is written. Covers what is happening structurally, which patterns apply, how data moves through the system, and the trade-offs between approaches. Use when user asks "how do I implement X", "what's the pattern for Y", "how should this feature work under the hood", wants to understand business logic as a data model, or needs to choose between implementation strategies.
---

# Feature Patterns

Before touching code, understand the shape of the problem. Every feature is a state machine operating on data.

## Workflow

### 1. Restate the feature as a data problem

Strip the UI/language away. Rewrite the feature as:

> "Given **[current state / input data]**, when **[event / trigger]**, produce **[new state / output data]**."

If you cannot fill in all three slots precisely, ask the user before continuing.

### 2. Search for canonical patterns

Use the search tool before stating anything that could be contested or version-sensitive:

- Search for the pattern name + "trade-offs" or "when to use"
- Search for how the pattern behaves in the user's specific stack
- Link every major claim to a source; don't assert from training data alone

Patterns to consider (see [PATTERNS.md](PATTERNS.md) for summaries):

- **Read/write split**: CQRS, read models, projections
- **State change tracking**: Event Sourcing, Domain Events, Outbox
- **Coordination**: Saga / Process Manager, two-phase commit
- **Consistency**: Optimistic locking, idempotency keys, versioned entities
- **Data delivery**: Webhooks, polling, SSE, WebSocket, pub/sub

### 3. Map the data flow

Draw the flow explicitly, even as plain text:

```
[Trigger] → [Validate/Authorize] → [Mutate state] → [Persist] → [Emit event?] → [Side effects]
                                                                  ↓
                                                          [Read model update?]
```

Label each arrow with **what data** is moving, not just which component.

### 4. Present approaches

For each viable approach, give:

|                      | Approach A                | Approach B           |
| -------------------- | ------------------------- | -------------------- |
| **Pattern**          | e.g. synchronous DB write | e.g. async via queue |
| **Data flow**        | one sentence              | one sentence         |
| **When to use**      | specific conditions       | specific conditions  |
| **What you give up** | explicit trade-off        | explicit trade-off   |

Do not recommend a single answer if the right choice depends on scale, team, or ops maturity — surface the decision instead.

### 5. Confirm before suggesting implementation

After presenting patterns and flows, ask:

- Which approach fits your constraints?
- Any nuances in your stack that would change this?

Then offer to move into implementation.

## Principles

- Business logic = **data + rules that constrain or transform it**. A "feature" is just a named set of those rules applied to a named slice of data.
- Search first. Training data goes stale. Pattern names get re-used with different meanings. Verify.
- Contested trade-offs (e.g. "use event sourcing for auditability") must cite a source, not just assert.
- When two patterns both work, the right one is determined by **operational constraints** (team size, deployment model, consistency requirements) — not by which is more fashionable.

## Advanced reference

See [PATTERNS.md](PATTERNS.md) for quick summaries of common patterns and when each one is appropriate.
