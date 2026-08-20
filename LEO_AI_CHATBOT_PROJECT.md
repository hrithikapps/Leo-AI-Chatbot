# LEO AI Chatbot

## Project Status

This is a new standalone project intended to eventually replace the current Freshchat-based chatbot used by Mojro Shipper.

The GitHub repository containing this document is the source repository for the new chatbot platform.

The project is being developed incrementally using an Agile approach.

The first objective is NOT to build the complete enterprise chatbot.

The first objective is to build a working, demonstrable foundation that can grow into the complete replacement.

---

# 1. Product Objective

Build a standalone LEO AI Chatbot that can eventually replace the current Freshchat/Freshworks chatbot used by Mojro applications.

The chatbot should eventually provide:

1. Support
2. Interactive AI
3. FAQs / Self Service Portal
4. Support ticket creation
5. Conversations/history
6. Mojro-specific AI assistance
7. Integration with Mojro applications

The platform must be reusable.

The chatbot should not become a feature tightly coupled to Mojro Shipper.

The intended future architecture is:

    Mojro Shipper
          |
          |
          v
    LEO AI SDK
          |
          v
    LEO AI Chatbot
          |
          +---- Support
          |
          +---- Interactive AI
          |
          +---- FAQ / Knowledge
          |
          +---- Ticketing
          |
          +---- AI Agent
          |
          v
    Open-source / self-hosted LLM


The same SDK should eventually be usable by:

- Mojro Shipper
- Mojro Carrier
- Mojro Transporter
- Mojro Indent Management
- future Mojro applications
- potentially external applications if appropriate

---

# 2. Existing System

The current Mojro Shipper application integrates with Freshchat.

The Shipper application is primarily responsible for:

- loading the Freshchat widget
- configuring the widget
- identifying the logged-in user
- passing user metadata
- opening the widget
- clearing/resetting the Freshchat user on logout

The actual Support / Interactive AI / FAQ experience is largely owned by Freshworks/Freshchat and is not necessarily implemented inside the Shipper repository.

A separate document exists:

    CHATBOT_CURRENT_STATE.md

This document contains the reverse-engineered current-state information from the existing Mojro Shipper application.

READ IT BEFORE MAKING ARCHITECTURAL OR IMPLEMENTATION DECISIONS.

Do not assume that functionality not documented there exists in Shipper.

Do not invent missing Freshworks behaviour.

---

# 3. Critical Principle

The goal is to REPLACE the current chatbot.

The goal is NOT to redesign the entire Mojro support ecosystem.

The first question for every implementation should be:

> What is the smallest implementation that allows us to replace one existing chatbot capability while keeping the architecture extensible?

Avoid unnecessary infrastructure.

Avoid premature abstractions.

Avoid enterprise-scale architecture for a hackathon-sized first version.

---

# 4. SDK-FIRST PRODUCT MODEL

The chatbot must eventually be consumable as an SDK.

The consuming application should not need to know:

- which LLM is being used
- how the AI agent works
- where knowledge is stored
- how conversations are stored
- how ticket creation works
- how AI inference works
- which database is being used

The consuming application should interact with a stable SDK contract.

Conceptually:

    Consumer Application
            |
            v
    LEO AI SDK
            |
            v
    LEO AI Backend
            |
            +---- Knowledge
            +---- Conversations
            +---- Support
            +---- AI
            +---- Tickets

---

# 5. CDN DISTRIBUTION

The SDK is expected to eventually be distributed through a CDN.

The intended integration model is conceptually:

    <script src="https://cdn/.../leo-ai-chatbot.js"></script>

followed by something similar to:

    LeoAIChatbot.init({
        ...
    });

The exact SDK API has NOT yet been finalized.

Do not prematurely lock the public API.

The SDK should eventually support basic lifecycle operations such as:

    init()
    open()
    close()
    destroy()

But these should be finalized after the initial architecture is understood.

---

# 6. GitHub

This repository is the source of truth for the new chatbot.

All development should happen inside this repository.

The project should remain Git-friendly.

After meaningful completed milestones:

1. run tests/build
2. inspect changes
3. commit
4. push to GitHub

Do not make one enormous commit at the end.

Use meaningful commits such as:

    feat: add chatbot sdk shell
    feat: add chatbot launcher
    feat: add conversation api
    feat: add faq service
    feat: add local llm integration

Do not commit:

- secrets
- API keys
- access tokens
- local credentials
- .env files containing secrets
- machine-specific configuration

---

# 7. Open Source Requirement

The project must use open-source/self-hostable software.

There should be no mandatory dependency on paid SaaS or paid AI APIs.

Do NOT introduce the following without explicit approval:

- OpenAI API
- Anthropic API
- Gemini API
- Pinecone Cloud
- paid chatbot SaaS
- paid agent platforms
- paid vector databases
- paid observability services
- paid support platforms

Prefer software that can be run locally or self-hosted.

Before introducing a dependency that materially affects architecture, check its license.

If there is a licensing concern, STOP and ask.

Do not silently introduce a paid dependency.

---

# 8. Credential Rule

If any dependency requires:

- account creation
- API key
- token
- OAuth credentials
- cloud credentials
- registry credentials
- Hugging Face token
- GitHub token
- any secret

DO NOT invent credentials.

DO NOT use fake credentials and continue as though the system is functional.

Instead tell the developer:

1. Which service requires the credential.
2. Why it is required.
3. Whether account creation is free.
4. Where the account should be created.
5. Which credential is required.
6. Which environment variable should contain it.
7. How it should be configured.

Then stop if the credential is genuinely required to continue.

Add the variable to:

    .env.example

Never commit the real value.

---

# 9. AI Requirement

The final platform must use an open-source/open-weight/self-hosted LLM.

The first version should prefer a locally runnable model.

Ollama is a candidate for the initial local development environment.

However:

DO NOT assume Ollama is mandatory.

Evaluate the development environment and choose a model/runtime that can realistically run on the available hardware.

Do not assume GPU availability.

The application should have an AI abstraction rather than coupling business logic directly to one LLM provider.

Conceptually:

    AIService
       |
       v
    LLM Provider
       |
       +---- Local runtime initially
       |
       +---- other self-hosted runtime later

The rest of the application should not need to change when the model/runtime changes.

---

# 10. Do Not Build a Complex Agent Yet

The final product may become an AI agent.

The first version should NOT attempt to implement a complex autonomous agent.

Do not immediately introduce:

- complex agent graphs
- multi-agent systems
- autonomous workflows
- distributed workers
- event buses
- Kafka
- NATS
- Kubernetes
- service mesh
- multiple microservices

The first AI capability should be simple:

    User
      |
      v
    Chat API
      |
      v
    AIService
      |
      v
    Local LLM
      |
      v
    Response

Later the AI layer can gain controlled tools such as:

    searchKnowledge()
    createSupportTicket()
    getOrder()
    getTrip()
    getShipment()
    getDriver()
    getVehicle()

Only implement tools when the actual Mojro APIs and business behaviour have been verified.

---

# 11. Knowledge / FAQ Requirement

The current chatbot contains FAQ / Self Service functionality.

The new chatbot must eventually reproduce the relevant current functionality.

The initial implementation does not need a sophisticated RAG pipeline.

Start with a simple KnowledgeService abstraction.

Conceptually:

    KnowledgeService
          |
          v
    FAQ / Knowledge Store

The implementation may initially use PostgreSQL-backed search or another simple open-source mechanism.

Later it can evolve into:

    KnowledgeService
          |
          v
    Embeddings
          |
          v
    pgvector
          |
          v
    Retrieval
          |
          v
    LLM

Do not introduce a vector database simply because the final system may need one.

---

# 12. Support Requirement

The chatbot must eventually support the current Support workflow.

The intended flow is:

    User
      |
      v
    Support
      |
      v
    Describe issue
      |
      v
    Collect required information
      |
      v
    Create support ticket
      |
      v
    Return ticket information

The LLM must NOT directly manipulate the database.

Use an explicit application operation:

    createSupportTicket()

which is implemented by:

    TicketService

If the existing Mojro backend already exposes a support/ticket API, inspect and understand it before creating a replacement implementation.

Do not invent an API.

---

# 13. Conversation Requirement

The new platform should eventually support:

- conversation creation
- messages
- conversation history
- restoring conversations
- user association
- tenant/application association

Initial conceptual entities:

    User

    Conversation

    Message

    FAQ

    Ticket

Do not over-design the database before understanding the actual requirements.

---

# 14. Multi-Application Requirement

The platform should eventually support multiple Mojro applications.

Introduce the concept of:

    tenantId

and/or:

    applicationId

where useful.

However, do not build a large multi-tenant enterprise platform during the first milestone.

The first implementation only needs clean ownership boundaries.

---

# 15. Proposed Initial Repository Structure

The exact structure is not finalized.

A reasonable initial direction is:

    leo-ai-chatbot/
    |
    +-- sdk/
    |   +-- src/
    |   +-- package.json
    |
    +-- server/
    |   +-- src/
    |
    +-- database/
    |
    +-- demo/
    |
    +-- docs/
    |
    +-- CHATBOT_CURRENT_STATE.md
    +-- MOJRO_CHATBOT_PROJECT.md
    +-- README.md
    +-- .env.example
    +-- .gitignore

Do not blindly create every directory immediately.

Create only what the current phase requires.

The SDK and backend should remain logically separate.

---

# 16. Technology Direction

Unless there is a strong technical reason otherwise:

SDK:

- TypeScript
- JavaScript-compatible output
- framework-independent integration
- isolated UI
- CDN-compatible build

Backend:

- Node.js
- TypeScript
- HTTP API
- SSE where useful for AI streaming

Database:

- PostgreSQL

AI:

- local/self-hosted open model

The exact libraries/frameworks should be selected after inspecting the repository and evaluating the smallest viable solution.

Do not install libraries just because they are popular.

---

# 17. SDK Integration Model

The host application should eventually be able to do something conceptually like:

    <script src="..."></script>

    <script>
      LeoAIChatbot.init({
        user: {
          id: "...",
          name: "...",
          email: "..."
        },
        application: "shipper"
      });
    </script>

The SDK should own:

- launcher
- chatbot UI
- communication with chatbot backend
- conversation handling
- rendering
- client-side state required by the chatbot

The host application should NOT need to know how the chatbot works internally.

---

# 18. Framework Independence

The SDK should not be coupled to React.

Mojro Shipper is currently a React application, but the SDK should eventually be usable by:

- React
- Next.js
- plain JavaScript
- other web applications

An iframe-based UI is a valid candidate for the initial implementation because it provides:

- CSS isolation
- JavaScript isolation
- framework independence
- easier embedding into legacy applications

However, do not finalize this until the Phase 0 architecture review.

---

# 19. Current Chatbot Compatibility

The current Shipper chatbot integration should be treated as a compatibility requirement.

The replacement must eventually support the information currently provided by Shipper.

Read:

    CHATBOT_CURRENT_STATE.md

before defining the SDK initialization contract.

Do not invent user fields that the current application does not provide.

The current-state document is the source of truth for the Shipper-side integration.

---

# 20. Security Requirements

Never:

- hardcode secrets
- expose LLM credentials
- expose database credentials
- commit tokens
- trust arbitrary tenant IDs without validation
- allow arbitrary tool execution by the LLM
- allow the LLM to generate arbitrary HTTP requests
- allow the browser to directly access sensitive backend credentials

All AI tools must be explicitly defined and controlled by the backend.

---

# 21. Agile Development Strategy

The project will be developed in small vertical slices.

Do NOT build all backend infrastructure first.

Each phase should produce something runnable.

The target sequence is:

    Phase 0
    Discovery + architecture

        ↓

    Phase 1
    SDK shell + launcher

        ↓

    Phase 2
    Chatbot backend + conversation

        ↓

    Phase 3
    FAQ / Knowledge

        ↓

    Phase 4
    Local AI

        ↓

    Phase 5
    Support / Tickets

        ↓

    Phase 6
    Shipper integration

        ↓

    Phase 7
    CDN distribution

        ↓

    Phase 8
    Freshchat replacement

Do not skip directly to Phase 8.

---

# 22. PHASE 0 — CURRENT TASK

THIS IS THE ONLY PHASE TO WORK ON INITIALLY.

Do not start implementing the chatbot yet.

First read:

    CHATBOT_CURRENT_STATE.md

Then inspect this repository.

Your job is to produce a concrete implementation plan.

The output should contain:

## A. Current system understanding

Summarize:

- how Shipper currently loads Freshchat
- user identification
- payload
- relevant APIs
- launcher
- logout
- support entry points
- what is owned by Freshworks
- what is owned by Shipper

Do not rediscover the entire Shipper application.

---

## B. Replacement boundary

Clearly define:

    Shipper
       |
       v
    LEO AI SDK
       |
       v
    LEO AI Backend

Explain what belongs to each layer.

---

## C. Minimal architecture

Propose the smallest architecture capable of delivering the first demo.

Avoid unnecessary infrastructure.

---

## D. SDK contract

Propose the minimum initial SDK contract.

For example:

    init()
    open()
    close()
    destroy()

and the minimum user/application configuration required.

Do not over-design it.

---

## E. Backend API

Propose only the minimum API required for the first working slice.

For example:

    POST /conversations
    POST /conversations/:id/messages
    GET  /conversations/:id

But these are examples only.

Choose the actual minimal API after analysis.

---

## F. First database model

Propose only the tables/entities needed for the first working slice.

---

## G. AI boundary

Define the interface between the chatbot backend and the LLM.

Do not implement a complex agent.

---

## H. CDN strategy

Explain how the SDK can eventually be built and distributed as:

    GitHub
       |
       v
    package/build
       |
       v
    CDN
       |
       v
    Consumer application

Do not implement CDN deployment during Phase 0.

---

## I. Git workflow

Define:

- branch strategy
- commit strategy
- local development workflow
- build/test workflow
- release/versioning approach

Keep this simple.

---

## J. External requirements

List every external service/account/credential that may be required.

For every credential-based dependency:

- identify it
- explain why
- state whether it is free
- state what credential is required

Do not create accounts on behalf of the developer.

Do not invent credentials.

---

## K. Open-source dependency list

For each proposed dependency:

- name
- purpose
- license
- why it is needed

Avoid unnecessary dependencies.

---

## L. Phase 1 specification

Define exactly what Phase 1 should implement.

Phase 1 should be small enough to complete quickly and demonstrate.

---

# 23. PHASE 1 — SDK SHELL

Do not implement until Phase 0 has been reviewed/approved.

The intended result is:

    Consumer/Test Application
            |
            v
    LEO AI SDK
            |
            v
    Chatbot launcher
            |
            v
    Chatbot UI shell

The demo should prove that:

1. The SDK can be loaded.
2. The launcher appears.
3. The chatbot can open.
4. The chatbot can close.
5. The SDK can receive user context.
6. The SDK is independent of the host application's React implementation.
7. The SDK can communicate with a configurable backend URL.

No real AI is required yet.

No ticketing is required yet.

No complex RAG is required yet.

---

# 24. Phase 2 — Conversation

After Phase 1:

Implement:

    create conversation
    send message
    receive response
    store messages
    retrieve conversation

Initially the response may be a controlled backend response.

The purpose is to prove:

    SDK
      ↓
    Backend
      ↓
    Database
      ↓
    SDK

---

# 25. Phase 3 — FAQ

Implement:

    FAQ
      ↓
    KnowledgeService
      ↓
    PostgreSQL/simple search

Use the actual FAQ/self-service information available to us.

Do not invent Freshworks functionality.

---

# 26. Phase 4 — Local AI

Connect the local/self-hosted LLM.

The flow becomes:

    SDK
      ↓
    Chat API
      ↓
    AIService
      ↓
    Local LLM
      ↓
    response

The AI should be able to answer the initial Mojro FAQ/self-service questions.

---

# 27. Phase 5 — Support

Implement:

    Support
      ↓
    TicketService
      ↓
    ticket storage/API
      ↓
    ticket confirmation

Use the actual Mojro support API if one exists and has been verified.

Otherwise implement the minimal backend ticket store required for the demo.

Do not pretend a demo ticket is a production support ticket.

---

# 28. Phase 6 — Shipper Integration

Integrate the SDK into a controlled Shipper test environment.

The target should eventually resemble:

    <script src="LEO AI Chatbot CDN"></script>

    LeoAIChatbot.init({
        user: ...,
        application: "shipper"
    });

Do not remove Freshchat yet.

Run the new chatbot alongside the existing integration while validating functionality.

---

# 29. Phase 7 — CDN

Once the SDK is stable:

Build a distributable browser bundle.

The distribution should be versioned.

Prefer explicit versions rather than a floating latest version.

Example concept:

    LeoAIChatbot v0.1.0

The CDN should ultimately point to a GitHub/npm-backed release.

Do not build proprietary CDN infrastructure.

---

# 30. Phase 8 — Freshchat Replacement

Only after the replacement provides the required functionality:

1. compare current functionality with replacement
2. identify missing functionality
3. test Shipper integration
4. run both systems during validation
5. add feature flag if required
6. switch production usage
7. remove Freshchat dependency only after validation

Do not delete Freshchat code prematurely.

---

# 31. Definition of Hackathon Success

The hackathon/demo is successful if we can demonstrate:

## SDK

A host application loads the chatbot SDK.

## UI

A chatbot launcher appears.

## Conversation

The user can open a conversation and exchange messages.

## FAQ

The chatbot can answer Mojro-specific FAQ questions.

Examples:

    How do I add a new driver?

    How do I link a driver with a vehicle?

    How do I assign a trip to a driver and vehicle?

    How do I confirm an order?

## AI

The response comes from a locally/self-hosted open-source model.

## Support

The user can initiate a support request and create a ticket in the demo implementation.

## Integration

The chatbot can be embedded into an application without embedding the chatbot implementation directly into that application's codebase.

## GitHub

The complete implementation exists in this repository with meaningful commits.

---

# 32. Non-Goals for the First Demo

Do NOT implement unless required:

- Kubernetes
- microservices
- service mesh
- Kafka
- NATS
- Redis/Valkey unless clearly required
- dedicated vector database
- multi-agent systems
- autonomous agents
- complex RAG
- enterprise admin portal
- analytics platform
- billing
- advanced RBAC
- mobile SDK
- native applications
- proprietary CDN
- production-scale observability platform

These may become future work.

---

# 33. Engineering Rules

Follow these rules throughout development.

1. Do not guess.
2. Do not invent Mojro APIs.
3. Do not invent business rules.
4. Do not invent Freshworks behaviour.
5. Do not refactor unrelated code.
6. Do not upgrade dependencies unnecessarily.
7. Do not add infrastructure without a current requirement.
8. Do not add a library merely because it is popular.
9. Prefer simple implementations.
10. Keep SDK and backend boundaries clean.
11. Keep the LLM replaceable.
12. Keep the knowledge layer replaceable.
13. Keep ticketing replaceable.
14. Keep secrets out of Git.
15. Keep commits small and meaningful.
16. Run tests/build before committing.
17. Document important architectural decisions.
18. Stop and ask when a real product decision is required.

---

# 34. When to Ask the Developer

Ask instead of guessing when:

- Freshworks behaviour cannot be determined
- an API is missing
- an API contract is ambiguous
- an account is required
- a credential is required
- a licensing issue is unclear
- a production architecture decision is required
- there are multiple materially different implementation choices
- an existing Mojro business rule cannot be determined

When asking, use:

    What I found:
    ...

    What is unclear:
    ...

    Why it matters:
    ...

    What I need from you:
    ...

Do not ask questions that can be answered by inspecting the repository.

---

# 35. Immediate Instruction to Claude Code

READ THIS DOCUMENT AND:

1. Read CHATBOT_CURRENT_STATE.md completely.
2. Inspect the current repository.
3. Do NOT start implementing the chatbot.
4. Do NOT create the full architecture.
5. Do NOT install large numbers of dependencies.
6. Do NOT create microservices.
7. Do NOT modify the Shipper repository.
8. Do NOT create external accounts.
9. Do NOT request credentials unless genuinely required.
10. Produce the Phase 0 architecture and implementation plan.
11. Identify the smallest Phase 1 implementation.
12. Identify any blockers.
13. Identify any assumptions that must be confirmed.
14. Wait for developer approval before beginning Phase 1.

The first goal is architectural clarity.

The second goal is a working SDK shell.

The third goal is incremental replacement of Freshchat.

The final goal is a standalone LEO AI Chatbot that can be consumed by Mojro applications through a CDN-distributed SDK.