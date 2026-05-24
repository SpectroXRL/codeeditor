# Patterns Reference

Quick-reference summaries. The agent should **search** for specifics before stating trade-offs as facts.

---

## CQRS (Command Query Responsibility Segregation)

**What it is**: Separate the write model (commands that mutate state) from the read model (queries that return data).

**Data flow**:

```
Command → Command Handler → Write Store → Event → Read Model Projector → Read Store
Query  →                                                                 → Read Store
```

**When to use**: Read and write loads differ significantly; read model shape is very different from write model; multiple consumers need the same data in different formats.

**Watch out for**: Eventual consistency between write and read stores; operational complexity of keeping projections up to date.

---

## Event Sourcing

**What it is**: Store state as an immutable append-only log of events. Current state is derived by replaying events.

**Data flow**:

```
Command → Validate against current state → Append Event to log → Project state from events
```

**When to use**: Auditability is a hard requirement; time-travel / replay is needed; domain events have intrinsic business value.

**Watch out for**: Schema evolution of events is hard; replaying large event logs is slow; queries require projections (usually paired with CQRS).

---

## Domain Events

**What it is**: Emit a named, past-tense event when something meaningful happens in the domain (`OrderPlaced`, `PaymentFailed`). Consumers react to events asynchronously.

**Data flow**:

```
Command → Mutate aggregate → Collect domain events → Persist aggregate + events → Publish events → Consumers
```

**When to use**: Side effects (notifications, projections, third-party calls) should not be coupled to the command handler; multiple bounded contexts need to react to the same state change.

**Watch out for**: Events must be published reliably — use the Outbox pattern if the event bus is separate from the database.

---

## Outbox Pattern

**What it is**: Write events to an `outbox` table in the same transaction as the state change. A separate relay process publishes them to the event bus.

**Data flow**:

```
Transaction: [Mutate state] + [Insert into outbox]
Relay:       Poll/CDC outbox → Publish to bus → Mark as sent
```

**When to use**: You need at-least-once delivery of events with no chance of losing them due to a crash between the DB write and the bus publish.

**Watch out for**: Consumers must be idempotent (at-least-once means possible duplicates).

---

## Saga / Process Manager

**What it is**: Coordinate a multi-step business process that spans multiple services or aggregates. Each step either succeeds or triggers compensating transactions.

**Data flow**:

```
Trigger → Step 1 → [success] → Step 2 → [fail] → Compensate Step 1
```

Two styles:

- **Choreography**: Services emit events and react to each other's events (no central coordinator).
- **Orchestration**: A Saga manager issues commands and waits for replies.

**When to use**: A business process crosses service/aggregate boundaries and must maintain consistency without a distributed transaction.

**Watch out for**: Choreography is hard to follow causally; orchestration creates a central bottleneck. Pick based on how important observability vs. coupling is.

---

## Optimistic Locking

**What it is**: Read a version number with the entity. On write, assert the version hasn't changed. If it has, reject and let the caller retry.

**Data flow**:

```
Read entity (version=N) → Compute changes → Write WHERE version=N → [0 rows = conflict, retry]
```

**When to use**: Concurrent writes to the same entity are rare but possible; you don't want the overhead of pessimistic locks.

**Watch out for**: Retry logic must be explicit; poorly chosen retry strategies can thrash under contention.

---

## Idempotency Keys

**What it is**: Clients include a unique key with each request. The server stores processed keys and returns the same response if the same key is seen again.

**Data flow**:

```
Request (idempotency-key: X) → Check if X seen before → [yes] return cached response
                                                       → [no] process + store result against X
```

**When to use**: Any operation that must not execute twice (payments, emails, provisioning) in a network where retries are expected.

**Watch out for**: Key storage has a TTL — document it. Key collisions from poor key generation are silent duplicates.

---

## Polling vs. Push (SSE / WebSocket / Webhook)

|               | Polling                       | SSE                                      | WebSocket                              | Webhook                                    |
| ------------- | ----------------------------- | ---------------------------------------- | -------------------------------------- | ------------------------------------------ |
| Direction     | Client → Server (repeat)      | Server → Client                          | Bidirectional                          | Server → Client (external)                 |
| Connection    | Stateless                     | Long-lived HTTP                          | Long-lived TCP                         | Stateless POST                             |
| When to use   | Simple, low-frequency updates | Server-initiated, one-way stream         | Interactive, low-latency bidirectional | Notify external systems of events          |
| Watch out for | Over-polling wastes resources | Server must handle many open connections | Harder to load-balance                 | Retry/delivery guarantees are your problem |

---

## Read Model / Projection

**What it is**: A pre-computed, denormalised view of data optimised for a specific query. Built by consuming events or change-data-capture from the write store.

**Data flow**:

```
Write store change → Projector → Read store (shaped for query)
```

**When to use**: Queries require joining many tables or aggregating large datasets at read time; read performance is critical.

**Watch out for**: Projection lag introduces eventual consistency; projections must be rebuildable from scratch (idempotent).
