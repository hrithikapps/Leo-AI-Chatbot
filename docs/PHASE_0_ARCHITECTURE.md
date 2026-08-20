# Phase 0 — Discovery + Architecture

Status: DRAFT — awaiting developer approval before Phase 1 begins.

This document is the Phase 0 deliverable required by `LEO_AI_CHATBOT_PROJECT.md` §22.
It is a plan only. No SDK, backend, or dependencies have been created/installed as part
of producing this document.

Repository state at time of writing: empty except `LEO_AI_CHATBOT_PROJECT.md` and
`CHATBOT_CURRENT_STATE.md`. No commits yet. `origin` already points at
`https://github.com/hrithikapps/Leo-AI-Chatbot.git`.

---

## A. Current system understanding

Source: `CHATBOT_CURRENT_STATE.md` (reverse-engineered from the Mojro Shipper repo).
Summarized here, not re-derived.

- Shipper does **not** implement a chatbot, FAQ engine, ticket API, or Interactive AI
  backend. It only loads and drives the third-party Freshchat widget.
- **Widget load**: `src/index.html` loads
  `//in.fw-cdn.com/31739313/888765.js` at app startup (`chat="true" hide="true" defer`),
  with `window.fcWidgetMessengerConfig = { eagerLoad: true, headerProperty: { hideChatButton: true } }`
  set before the script tag. No env vars are involved; the URL/IDs are hardcoded.
- **Launcher**: a header icon button (`tooltip="Chat"`), visible only when
  `isUserLoggedIn && !isPublicRoute`. Two public routes (`LocateAddress`, `ShipmentTrack`)
  hide the whole header, including Chat.
- **User identification** happens only on Chat click (not on login, not on widget init —
  that path is commented out), via `src/utils/freshchatUtils.js`:
  1. Overwrites `window.fcWidgetMessengerConfig` to `{ externalId: userDetails.email }`
     (does not merge back `eagerLoad`/`hideChatButton`).
  2. `fcWidget.user.get()` → if `status !== 200`, `fcWidget.user.create(...)`, else
     `fcWidget.user.update(...)`.
  3. Payload: `firstName = fullName`, `lastName = enterpriseName`, `email`,
     `externalId = email`, `meta.cf_enterprise`, `meta.cf_hierarchy = userHierarchy[0]?.name`,
     `meta.cf_role = role?.name`, `meta.cf_app = 'Shipper'`.
  4. `fcWidget.open('open')` if not already open. No close handler exists in Shipper.
- **Identity provenance**: Auth0 JWT → `GET /enterprise/v2/users/{authIDNumber}` →
  Redux `header.userDetails` / `enterpriseName` / `userHierarchy` → passed into
  `initializeFreshchat` on click. The JWT itself is never passed to Freshchat.
- **Logout**: `AuthService.logout()` calls `clearFreshchatUser()`
  (`fcWidget.user.clear()` or `fcWidget.resetUser()`), then clears local auth state.
- **Support entry points**: header "Support" button and the login-error "Contact Support"
  link both just `window.open` a hardcoded Freshdesk URL
  (`https://mojrosupport-assist.freshdesk.com`) in a new tab. No API call, no user
  context appended.
- **Owned by Freshworks** (outside this repo, unknown to us): everything that happens
  after `fcWidget.open()` — bot menus, Interactive AI, FAQ content, whether tickets get
  created in Freshdesk and with what fields.
- **Owned by Shipper**: script load, launcher visibility, identify-on-click, open,
  clear-on-logout, and the two static Support links.
- A separate, unrelated system — **MIA (Mojro Intelligent Agent)** — exists for plan
  Q&A (`IntelligentAgent` component, `/mia/*` API). It does not use Freshchat and is
  out of scope for this replacement unless product explicitly asks to unify them.

No conversation IDs, ticket-create APIs, feature flags, or Freshchat env vars exist
anywhere in the Shipper repo.

---

## B. Replacement boundary

```
Shipper (or any consumer app)
      |
      v
LEO AI SDK
      |
      v
LEO AI Backend
```

**Shipper / consumer app owns:**
- Deciding *when* to call `init()` (on login) and `destroy()`/logout-cleanup (on logout).
- Supplying whatever real user/application identity it has available — nothing invented.
- Nothing else. It does not know about conversation storage, the LLM, ticket storage,
  or the database.

**LEO AI SDK owns** (per project doc §17):
- The launcher control and the chat UI itself (isolated, e.g. iframe-based — see §C).
- All HTTP/SSE communication with the configured backend URL.
- Client-side conversation/session state (e.g. current conversation id).
- Framework independence — must not assume React.

**LEO AI Backend owns:**
- Conversation + message persistence.
- The AI boundary (`AIService` → LLM provider — see §G).
- Knowledge/FAQ retrieval (Phase 3+).
- Ticket creation (Phase 5+), never performed by the LLM directly.
- All credentials (DB, LLM runtime, any future provider). None of these are ever
  exposed to the browser.

The SDK never talks to Postgres, the LLM runtime, or any Mojro backend API directly —
only to the LEO AI Backend's HTTP contract.

---

## C. Minimal architecture (first full demo, §31 definition)

```
Test host page (plain HTML first; Shipper in Phase 6)
      |
      v
LEO AI SDK  (TypeScript, iframe-based UI, framework-independent, CDN-buildable)
      |  HTTP (+ SSE for AI streaming, added Phase 4)
      v
LEO AI Backend  (single Node.js/TypeScript HTTP service)
      |
      +-- ConversationService  --> PostgreSQL
      +-- KnowledgeService     --> PostgreSQL (simple text search, Phase 3)
      +-- AIService            --> local LLM runtime, abstracted (Phase 4)
      +-- TicketService        --> PostgreSQL demo ticket store (Phase 5)
```

One backend process. One Postgres database. No message queue, no vector database, no
Redis, no microservices, no container orchestration. SSE is introduced only when
streaming AI responses actually exist (Phase 4). This is intentionally the same shape
as project doc §10's "do not build a complex agent yet" diagram, extended with
Knowledge and Ticket as sibling services rather than agent tools.

---

## D. SDK contract (minimum)

```ts
LeoAIChatbot.init({
  backendUrl: string,          // e.g. "http://localhost:4000"
  application: string,         // e.g. "shipper" — free-text app identifier
  user?: {
    id: string,                // stable unique id; Shipper source TBD (see Open Questions)
    name?: string,
    email?: string,
  },
  container?: HTMLElement | string,  // optional mount point; SDK creates its own
                                      // floating launcher if omitted
});

LeoAIChatbot.open();
LeoAIChatbot.close();
LeoAIChatbot.destroy();
```

Deliberately excluded for now (not over-designing per §5/§17):
- No `metadata`/custom-field bag yet (Shipper's `cf_enterprise`, `cf_hierarchy`,
  `cf_role` equivalents) — nothing to attach it to until Phase 6 integration is
  actually scoped, and inventing the shape now would be guessing.
- No event callbacks (`onOpen`, `onMessage`, etc.) — add when a real consumer needs one.
- No auth/JWT parameter — the SDK does not talk to Mojro APIs directly, so it has no
  use for a Mojro JWT at this stage.

---

## E. Backend API (minimum for first working slice — Phase 1 + Phase 2)

```
GET  /health
POST /conversations                  { applicationId, externalUserId? } -> { conversationId }
POST /conversations/:id/messages     { role: "user", content }          -> { message, aiMessage }
GET  /conversations/:id                                                 -> { conversation, messages[] }
```

- `/health` is all Phase 1 needs (proves the SDK can reach a configurable backend URL —
  demo criterion §23.7).
- The three `/conversations*` routes are Phase 2 scope, listed here only so the Phase 1
  health route is understood in context and not designed in a way that blocks it.
- `POST /conversations/:id/messages` returns a synthesized/controlled backend response
  in Phase 2 (per §24 — "Initially the response may be a controlled backend response").
  It becomes AI-backed in Phase 4, and SSE-streamed at that point — the route shape
  should not need to change, only the response mechanics.
- FAQ (`/faq/search`) and Ticket (`/tickets`) routes are explicitly deferred to Phase 3
  and Phase 5 and are not designed here to avoid guessing ahead of those phases.
- No Mojro/Auth0 JWT verification is implemented yet — flagged as an open question for
  Phase 6 (Shipper integration), not a Phase 1/2 blocker.

---

## F. First database model (Phase 2 scope)

```sql
conversations (
  id               uuid primary key,
  application_id   text not null,        -- e.g. 'shipper'; the multi-app boundary (§14)
  external_user_id text null,            -- opaque id supplied by the consumer app
  created_at       timestamptz not null default now()
);

messages (
  id               uuid primary key,
  conversation_id  uuid not null references conversations(id),
  role             text not null check (role in ('user','assistant','system')),
  content          text not null,
  created_at       timestamptz not null default now()
);
```

`application_id` is a plain text column, not a full tenant system — satisfies §14's
"clean ownership boundaries" without building multi-tenant infrastructure prematurely.
`FAQ` and `Ticket` tables are intentionally not designed yet (Phase 3 / Phase 5) —
designing them now would mean guessing at content this document has no basis for.

---

## G. AI boundary

```ts
interface AIService {
  generateReply(history: Message[], newMessage: string): Promise<string> | AsyncIterable<string>;
}
```

- Phase 1/2: no `AIService` exists yet; `/conversations/:id/messages` returns a fixed/
  controlled response directly from `ChatService`.
- Phase 4: introduce `AIService` with a provider behind it (candidate: Ollama, see §J/§K),
  selected via an env var (e.g. `AI_PROVIDER=stub|ollama`) so the rest of the backend
  never changes when the model/runtime changes (§9).
- No tools (`searchKnowledge()`, `createSupportTicket()`, `getOrder()`, etc.) are wired
  to the LLM in Phase 0–4. Per §10/§20, the LLM never calls these directly or gets
  arbitrary execution — any future tool-calling is backend-mediated and explicitly
  allow-listed, and only after the relevant Mojro API/business rule has been verified,
  not before.

---

## H. CDN strategy (not implemented in Phase 0)

```
GitHub (this repo)
      |
      v
Versioned build (tsup/esbuild bundling sdk/ to an IIFE + ESM output)
      |
      v
Package/release artifact (npm package and/or GitHub Release asset)
      |
      v
CDN (e.g. jsDelivr resolving the published npm package, or a Release asset URL)
      |
      v
Consumer application: <script src="https://cdn/.../leo-ai-chatbot@0.1.0.js">
```

Explicit versions (`@0.1.0`), never a floating `@latest`, per §29. No proprietary CDN
infrastructure — lean on an existing public CDN that mirrors npm/GitHub. This is
architecture only; nothing here is built in Phase 0 or Phase 1.

---

## I. Git workflow

- **Branching**: trunk-based. Short-lived feature branches per phase/slice, e.g.
  `feat/phase1-sdk-shell`, merged back to `main` via PR.
- **Commits**: Conventional-commit-style prefixes (`feat:`, `fix:`, `chore:`, `docs:`),
  small and meaningful, matching the examples in project doc §6.
- **Local dev workflow**: each package (`sdk/`, `server/`) gets its own
  install/build/test scripts once created; no monorepo tooling (Nx/Turborepo) unless a
  real cross-package build problem shows up.
- **Build/test workflow**: run `build`/`test` before every commit that touches code
  (§33.16). CI (GitHub Actions running build+test on PRs) is reasonable to add once
  Phase 1 code exists — not part of Phase 0.
- **Release/versioning**: SDK package starts at `0.1.0` once Phase 1 lands; semver
  from there. Backend does not need independent versioning until it has external
  consumers beyond the SDK.

---

## J. External requirements

No credential is required to start Phase 1. Listed for transparency:

| Dependency | Required for | Free? | Credential | Notes |
|---|---|---|---|---|
| GitHub (`origin`) | Source control | Already set up | Existing developer GitHub credentials | Remote already configured; nothing new needed. |
| PostgreSQL | Phase 2+ (conversation/message storage) | Yes, self-hosted (local install or Docker) | `DATABASE_URL` env var | Not needed until Phase 2. No cloud Postgres account implied. |
| Local LLM runtime (candidate: Ollama) | Phase 4 (AI responses) | Yes, free, self-hosted binary | None (no API key) | Not an "account" — a local install. Needs confirmation of available RAM/disk on the dev machine (no GPU assumed, per §9) before Phase 4. |
| Open-weight model (e.g. via Ollama) | Phase 4 | Yes, if a non-gated model is chosen | Possibly none | Prefer non-gated models (e.g. Llama 3.x, Qwen2.5, Phi-3 class) specifically to avoid needing a Hugging Face token. If a gated model is ever preferred, a free HF account + token would be required — flagged in advance, not assumed. |

Explicitly **not** required and **not** to be introduced without approval (§7):
OpenAI, Anthropic, Gemini APIs, Pinecone Cloud, any paid chatbot/agent/vector-DB/
observability/support SaaS.

`.env.example` will be added starting Phase 2 (first point any env var, `DATABASE_URL`,
actually exists). Adding it now would be a placeholder with nothing real to document.

---

## K. Open-source dependency list (proposed for Phase 1 — none installed yet)

| Name | Purpose | License | Why needed |
|---|---|---|---|
| `typescript` | Type-checked source for both `sdk/` and `server/` | Apache-2.0 | Project doc §16 direction; catches contract mismatches between SDK and backend early. |
| `tsup` (esbuild-based) | Bundle `sdk/` into an IIFE (`window.LeoAIChatbot`) + ESM output | MIT | Smallest-config path to a CDN-shaped bundle (§5/§H) without hand-rolling a bundler config. |
| A minimal HTTP framework for `server/` — candidate: `express` or Node's built-in `http` | Serve `GET /health` (Phase 1) | MIT (Express) / N/A (built-in) | Only a single route is needed in Phase 1; final choice (bare `http` vs Express) deferred to Phase 1 kickoff based on how much Phase 2's routing needs justify a framework. |

Deferred, not proposed yet (introduce only when the phase that needs them starts):
- Postgres client/ORM (Phase 2) — e.g. `pg` or a lightweight query builder; ORM choice
  deferred until the Phase 2 schema is final.
- Ollama client (Phase 4).
- Any test runner (e.g. `vitest`) — add when there is behavior worth testing beyond
  a single health route; not proposed for the very first commit.

All candidates above are MIT/Apache-2.0. No GPL/AGPL/SSPL or paid-license dependency is
proposed. Per §7, any dependency that would materially affect architecture gets a
license check before adoption, and anything ambiguous stops for developer input rather
than being silently added.

---

## L. Phase 1 specification

**Goal:** prove the seven items in project doc §23 — nothing else.

**Scope:**
1. `sdk/` — new TypeScript package.
   - Exposes `LeoAIChatbot.init/open/close/destroy` per §D.
   - Renders a framework-independent floating launcher button (vanilla DOM APIs — no
     React/Vue/etc. dependency).
   - `open()` shows an iframe-based panel pointing at a static placeholder page (no
     real chat UI yet — just proves isolation + open/close).
   - On `init()`, performs `GET {backendUrl}/health` and logs success/failure, to prove
     "communicates with a configurable backend URL" (§23.7).
   - Built with `tsup` to `dist/leo-ai-chatbot.js` as a global (`window.LeoAIChatbot`).
2. `server/` — new minimal Node/TypeScript service exposing only `GET /health`.
   No database, no conversation logic yet.
3. `demo/` — a plain static HTML page (not React) that loads the built SDK bundle from
   a local path/port and calls `LeoAIChatbot.init({...})`, demonstrating framework
   independence (§23.6) without touching the real Shipper repo (§35.7 — never modify
   Shipper).

**Explicitly out of scope for Phase 1** (per §23 and §32): no conversation storage, no
AI, no ticketing, no FAQ, no CDN publish, no Postgres, no Docker.

**Done when:** all seven §23 demo points are shown working locally: SDK loads, launcher
appears, chatbot opens, chatbot closes, SDK receives user context (visible via console
log or the placeholder panel echoing it back), SDK works from a plain HTML page (proving
no React coupling), SDK successfully calls the configured backend's `/health`.

---

## Open questions / assumptions to confirm before later phases (none block Phase 1)

1. **Unique user id for the SDK.** Current Freshchat behavior uses `email` as the
   identifying id (§13 of current-state doc). Whether the LEO AI SDK should also key on
   email, or use Shipper's internal `authId`/`id` instead, is a product decision for
   Phase 6 — not invented here.
2. **MIA relationship.** Current-state doc explicitly separates MIA (`/mia/*`) from the
   Freshchat replacement. This plan keeps them separate. Confirm before Phase 6 that
   product does not intend to unify them.
3. **Existing Mojro ticket/support API.** Per project doc §12, if the Mojro backend
   already has a ticket-creation API, it must be inspected before `TicketService` is
   implemented (Phase 5). Not investigated here — out of scope for this repo/document.
4. **Dev machine capability for local LLM.** Before Phase 4, confirm available RAM/disk
   on the target dev machine(s) to pick a realistically runnable model size (no GPU
   assumed, per §9).
5. **Postgres hosting for local dev.** Docker vs. local native install — needed before
   Phase 2, not Phase 1.

No blockers exist for starting Phase 1.
