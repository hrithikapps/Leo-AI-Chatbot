# CHATBOT_CURRENT_STATE.md

Current-state documentation of the Mojro Shipper Web App **Freshchat / Freshdesk** integration, for a later standalone chatbot that can replace Freshchat.

This document describes **only what exists in this repository**. It is not an architecture proposal for the replacement.

---

## 1. Scope of what was found

The Shipper app does **not** implement a custom chatbot UI, FAQ engine, ticket API, or Interactive AI backend.

What exists in-repo:

| Surface | What it is |
| --- | --- |
| Freshchat widget | Third-party Freshworks script + `window.fcWidget` SDK usage |
| Header **Chat** button | Custom launcher that identifies the user and opens the widget |
| Header **Support** button | Opens a Freshdesk portal in a new tab |
| Login error **Contact Support** | Same Freshdesk URL |
| Logout | Clears Freshchat user session |

A **separate** in-app AI (Mojro Intelligent Agent / MIA) exists for plan Q&A. It is **not** wired to Freshchat. See [Section 10](#10-interactive-ai-flow).

---

## 2. Files that implement the current chatbot

| Path | Role |
| --- | --- |
| `src/index.html` | Loads Freshworks widget script; sets initial widget config |
| `src/utils/freshchatUtils.js` | Identify/create/update/clear/open Freshchat user |
| `src/components/Header/Header.js` | Chat launcher, Support link, `window.fcSettings` |
| `src/containers/HeaderContainer.js` | Passes `userDetails`, `userHierarchy`, `enterpriseName` from Redux |
| `src/modules/header.js` | Builds `userDetails` / `enterpriseName` / `userHierarchy` after login |
| `src/utils/getInitialState.js` | Same user fields on session restore |
| `src/utils/authService.js` | Logout clears Freshchat; login persists user payload used later |
| `src/routes/Login/constants.js` | Freshdesk Support URL constant |
| `src/routes/Login/components/Login/Login.js` | Passes Support URL into login error page |
| `src/components/ErrorPage/ErrorPage.js` | “Contact Support” opens that URL |
| `src/routes/Login/apis/LoginAPIs.js` | `GET /enterprise/v2/users/:authID` — **source of user fields**, not a chat API |
| `src/static/mojro-icomoon-settings.json` | `chat_outline` / `help_outline` icons |

No other `freshchat` / `fcWidget` / `freshdesk` / `fw-cdn` references were found.

No chatbot feature flags, env vars, npm SDK, conversation IDs, or ticket-create APIs were found.

---

## 3. Entry point to backend (actual path)

```text
SPA boot (src/index.html)
        ↓
Freshworks CDN script loads (defer)
        ↓
window.fcWidget becomes available (Freshworks-owned)
        ↓
User logs in → Redux header state (userDetails, userHierarchy, enterpriseName)
        ↓
Logged-in Header renders Chat + Support buttons
        ↓
User clicks Chat
        ↓
initializeFreshchat(...) then openFreshchatWidget()
        ↓
window.fcWidget.user.get / create / update  (Freshchat SDK, not Mojro HTTP)
        ↓
window.fcWidget.open('open')
        ↓
All bot menus, tickets, FAQ, Interactive AI run inside Freshchat/Freshdesk
        (not implemented in this repository)
```

There is **no** Shipper API client call whose purpose is “send a chat message” or “create a support ticket”.

---

## 4. Current chatbot initialization

### 4.1 Script load (application startup)

**File:** `src/index.html:169-179`

On every page that uses the SPA shell:

1. Sets `window.fcWidgetMessengerConfig` **before** the script:

```text
{
  config: {
    eagerLoad: true,
    headerProperty: {
      hideChatButton: true
    }
  }
}
```

2. Loads:

```text
src="//in.fw-cdn.com/31739313/888765.js"
attributes: chat="true" hide="true" defer
```

Meaning in this repo:

- Widget is loaded at **HTML parse / app startup**, not after login.
- Native Freshchat launcher is requested hidden (`hide="true"` and `hideChatButton: true`).
- `31739313` and `888765` are path segments of the public widget script URL (Freshworks account/widget identifiers). They are **not** environment variables. They are not API secrets in this repo; they are hardcoded in HTML.

No `token`, JWT, user, or enterprise is passed at script-load time.

### 4.2 Header `fcSettings` (Header mount)

**File:** `src/components/Header/Header.js:204-215` (`componentDidMount`)

Sets:

```text
window.fcSettings = {
  config: {
    headerProperty: {
      hideChatButton: true
    }
  },
  onInit: function () {
    if (userDetails && userHierarchy && enterpriseName) {
      // initializeFreshchat(...)  <-- COMMENTED OUT
    }
  }
}
```

**When:** Header mounts (logged-in shell).

**Important:** User identification on widget `onInit` is **disabled**. Identification runs only when the user clicks Chat.

### 4.3 User identification (on Chat click, not at startup)

**File:** `src/utils/freshchatUtils.js`  
**Functions:** `initializeFreshchat`, `getMetaForFreshchat`  
**Caller:** `src/components/Header/Header.js:379-381`

Sequence:

1. If `window.fcWidget` is missing → `console.warn('Freshchat widget not loaded')` and return.
2. Overwrite `window.fcWidgetMessengerConfig` with **only**:

```text
{ externalId: userDetails.email }
```

This replaces the earlier object from `index.html` (the code does not merge `eagerLoad` / `hideChatButton` back in).

3. `window.fcWidget.user.get(callback)`
4. If `resp.status !== 200` → `window.fcWidget.user.create(...)`
5. Else → `window.fcWidget.user.update(...)`

### 4.4 Open widget

**File:** `src/utils/freshchatUtils.js:113-126`  
**Function:** `openFreshchatWidget`

If `window.fcWidget.isOpen` exists and the widget is not open:

```text
window.fcWidget.open('open')
```

No close handler is registered in this repo. No other `fcWidget` events (`on`, `onUserCreate`, conversation callbacks) are registered except the unused/commented `fcSettings.onInit`.

### 4.5 Environment variables used for Freshchat

**None found.** Widget URL and IDs are hardcoded in `src/index.html`.

---

## 5. Current user context / payload

### 5.1 Payload actually sent to Freshchat

Constructed in `src/utils/freshchatUtils.js:54-98`.

#### `window.fcWidgetMessengerConfig`

| Field | Type in code | Source | Mandatory in this code | Purpose in this code |
| --- | --- | --- | --- | --- |
| `externalId` | value of `userDetails.email` | Redux `header.userDetails.email` | Used as-is; no null check | Comment: “user's id unique to your system” |

#### `fcWidget.user.create` body (when get status !== 200)

| Field | Type in code | Source | Purpose |
| --- | --- | --- | --- |
| `firstName` | `userDetails.fullName` | User record `fullName` | Freshchat first name |
| `lastName` | `enterpriseName` | User record `enterpriseName` | **Enterprise name stored in lastName** |
| `email` | `userDetails.email` | Primary profile `email` | Freshchat email |
| `externalId` | `userDetails.email` | Same email | Freshchat external id |
| `meta.cf_enterprise` | `enterpriseName` | User record `enterpriseName` | Custom field |
| `meta.cf_hierarchy` | `userHierarchy[0] && userHierarchy[0].name` | Currently selected hierarchy root `name` | Custom field |
| `meta.cf_role` | `userDetails.role && userDetails.role.name` | Primary profile `role.name` | Custom field |
| `meta.cf_app` | literal `'Shipper'` | Hardcoded | Identifies this app |

#### `fcWidget.user.update` body (when get status === 200)

Same as create **except `externalId` is not included** in the update object.

### 5.2 Fields that exist in Shipper user state but are **not** sent to Freshchat

From `setUserDetails` in `src/modules/header.js:164-172`:

- `userDetails.id`
- `userDetails.authId`
- `userDetails.photoUrl`
- `userDetails.role` object beyond `.name` (e.g. `role.id` is never passed)

Also not sent:

- JWT / Auth0 id token
- `enterpriseId` / `enterpriseRefId`
- Hierarchy `id` / `refId`
- Locale, timezone
- Auth token from Header local state (`authToken`)

### 5.3 Provenance of each sent field

```text
Auth0 login
  → id token (localStorage `idToken`)
  → AuthService.getAuthIDAndEnterpriseID()
       JWT `sub` / SAML `user_id` → authIDNumber
  → GET /enterprise/v2/users/{authIDNumber}?readPlantAddress=true
       response.data = userData
  → AuthService.login → localStorage `userData`
  → header.logUserIn / getInitialState
  → Redux header.userDetails, header.enterpriseName, header.userHierarchy
  → HeaderContainer mapStateToProps
  → Header Chat onClick
  → initializeFreshchat(userDetails, userHierarchy, enterpriseName)
```

Sources:

| Freshchat field | Origin | Code |
| --- | --- | --- |
| `email` | `userData.profiles` item with `isPrimary === true`, field `email` | `src/modules/header.js:161-171` |
| `fullName` | `userData.fullName` | same |
| `role.name` | `profile.role.name` | `src/utils/freshchatUtils.js:58` |
| `enterpriseName` | `userData.enterpriseName` | `src/modules/header.js:126,151` |
| `userHierarchy[0].name` | `userData.hierarchy` then possibly replaced by selected global hierarchy | `src/modules/header.js:157-158`; Header can call `setUserHierarchy(getFilteredUserHierarchy(...))` |

After login, profile edits can refresh the same `userDetails` shape via `src/routes/Profile/routes/MyProfile/modules/myprofile.js:33-56` (`handleUserDataUpdate`). Freshchat is **not** updated until the next Chat click.

### 5.4 `userDetails` / `role` / hierarchy shapes (as used, not a full API spec)

`userDetails` written by this app:

```text
{
  fullName,   // from userData.fullName
  photoUrl,   // not sent to Freshchat
  id,         // not sent
  authId,     // not sent
  role,       // object; Freshchat uses role.name
  email       // from primary profile
}
```

`role` is treated as an object with at least `name` (Freshchat) and elsewhere `id` (other features). No TypeScript interface exists.

`userHierarchy` is an array of hierarchy nodes. Freshchat uses only index `0`:

- `name` → `cf_hierarchy`
- If `userHierarchy[0]` is missing, `cf_hierarchy` is falsy (`undefined`).

If `userHierarchy` itself is `null`/`undefined`, `getMetaForFreshchat` would throw on `userHierarchy[0]` (no guard on the array). Header still passes current props on click.

### 5.5 SDK responses

`user.get` uses `resp.status` compared to `200`.

`user.create` / `user.update` callbacks only `console.log` the `data` argument.

**Response body shape is not defined in this repository.**

---

## 6. Current API calls

### 6.1 Chatbot-specific HTTP APIs in Shipper

**None.**

Freshchat traffic is the CDN script plus the Freshworks widget talking to Freshworks. Those HTTP contracts are not in this repo.

### 6.2 APIs that only **supply identity** for the widget

These are login/session APIs. They are not invoked from `freshchatUtils.js`.

#### GET `/enterprise/v2/users/{authIDNumber}`

| Item | Value in repo |
| --- | --- |
| Method | GET |
| Path | `/enterprise/v2/users/${authIDNumber}` |
| Client | `enterpriseAPIService` (`src/apis/APIService.js:126-128`, base `config.API_ENDPOINT_ENTERPRISE`) |
| Caller (login) | `src/routes/Login/apis/LoginAPIs.js:30-46` via `src/routes/Login/components/Login/Login.js:76-79` |
| Query | `{ readPlantAddress: true }` on login path |
| Headers | Axios interceptor adds `Authorization: Bearer ${idToken}` when token exists (`src/apis/APIService.js:7-24`) |
| Auth | Auth0 id token in localStorage / URL query `token` or `idToken` |
| Caching | In-memory `memory-cache` key `'userData' + authIDNumber` |
| Error | Rethrow; login maps via `readApiErrorDetails` |
| Response used | `response` / `{ data: userData }`. **No typed schema in this repo.** Fields consumed for chat listed in Section 5. |

Duplicate helper without `readPlantAddress`: `src/apis/APIs.js:186-206` (`getUserData`). Not used by Freshchat utils.

#### GET `/enterprise/v2/accounts/config`

Login also fetches enterprise config (`LoginAPIs.getEnterpriseConfig`). **Not passed into Freshchat.**

### 6.3 Freshchat SDK “APIs” (browser, not Mojro backend)

| Call | When | Request (this repo) | Response handling |
| --- | --- | --- | --- |
| `fcWidget.user.get(cb)` | Chat click | none | `resp.status !== 200` → create, else update |
| `fcWidget.user.create(payload, cb)` | No existing FC user | Section 5 | `console.log` |
| `fcWidget.user.update(payload, cb)` | Existing FC user | Section 5 without `externalId` | `console.log` |
| `fcWidget.user.clear()` | Logout | none | log / warn |
| `fcWidget.resetUser()` | Logout fallback | none | log |
| `fcWidget.isOpen()` / `fcWidget.open('open')` | Chat click | `'open'` string | warn on throw |

### 6.4 Support portal

Not an API. Navigation to a hardcoded HTTPS URL (Section 9).

---

## 7. Request payloads (exact)

### 7.1 Freshchat create

Built inline in `initializeFreshchat` (`src/utils/freshchatUtils.js:78-85`):

```text
{
  firstName: userDetails.fullName,
  lastName: enterpriseName,
  email: userDetails.email,
  externalId: userDetails.email,
  meta: {
    cf_enterprise: enterpriseName,
    cf_hierarchy: userHierarchy[0] && userHierarchy[0].name,
    cf_role: userDetails.role && userDetails.role.name,
    cf_app: 'Shipper'
  }
}
```

No conversation id, tenant id, JWT, or ticket fields.

### 7.2 Freshchat update

```text
{
  firstName: userDetails.fullName,
  lastName: enterpriseName,
  email: userDetails.email,
  meta: { cf_enterprise, cf_hierarchy, cf_role, cf_app }  // same helper
}
```

### 7.3 User fetch (identity source only)

```text
GET {API_ENDPOINT_ENTERPRISE}/enterprise/v2/users/{authIDNumber}?readPlantAddress=true
Authorization: Bearer <Auth0 id token>
```

`authIDNumber` from JWT: Auth0 `sub` after `|`, or SAML `user_id` after `|` (`src/utils/authService.js:121-136`).

---

## 8. Response payloads

### Freshchat SDK

Not specified in this repo. Only `resp.status` on get.

### GET user

No interface. Chat-related consumption is listed in Section 5. Remaining `userData` fields are used by the rest of Shipper and are out of scope except as unused-for-chat.

---

## 9. Support flow

There are **two** Support-related UIs. Neither creates a ticket inside Shipper.

### 9.1 Header Support (logged-in)

**File:** `src/components/Header/Header.js:390-400`

```text
User clicks header “Support” (tooltip "Support", icon help_outline)
  → react-router Link, target="_blank"
  → https://mojrosupport-assist.freshdesk.com
```

- No query params
- No user id, email, or JWT in the URL
- No Shipper API call
- Ticket creation, if any, happens **inside Freshdesk** (not in this repo)

### 9.2 Login error Contact Support

**Files:**  
`src/routes/Login/constants.js:3`  
`src/routes/Login/components/Login/Login.js:150-157`  
`src/components/ErrorPage/ErrorPage.js:24-32`

Same URL: `https://mojrosupport-assist.freshdesk.com` (`SUPPORT_URL`), opened `target="_blank"` `rel="noopener noreferrer"`.

### 9.3 Header Chat vs Support

Clicking **Chat** opens Freshchat (`fcWidget`). Clicking **Support** does **not** open Freshchat; it opens Freshdesk.

Whether the Freshchat bot later creates Freshdesk tickets is **Unknown / not found in repository**.

### 9.4 Ticket creation in Shipper

**Does not exist** (no `ticket` API/module matches in `src`).

---

## 10. Interactive AI flow

### 10.1 Freshchat “Interactive AI”

**Not found in this repository.**

No strings, routes, feature flags, or APIs named Interactive AI, Oliv, FAQ bot, or Freshchat conversation APIs.

If Interactive AI is a Freshchat/Freshworks product feature, it runs **inside the loaded widget** after `fcWidget.open`. This frontend:

- Does not open a separate Interactive AI screen
- Does not send conversation IDs
- Does not stream AI tokens to/from Mojro for Freshchat
- Does not pass JWT or operational Mojro data (orders, trips, etc.) into Freshchat beyond the user meta in Section 5

**Need to investigate outside this repo:** Freshworks widget configuration (bot topics, AI, handoff).

### 10.2 Distinct system: Mojro Intelligent Agent (MIA) — not Freshchat

This is an in-app plan assistant. It does **not** use `fcWidget`, Freshchat, or Freshdesk.

| Item | Location |
| --- | --- |
| UI | `src/components/IntelligentAgent/IntelligentAgent.js` |
| HTTP | `src/apis/IntelligentAgentApis.js` |
| Used from | Plan estimate UI `src/components/EstimateAndConfirm/EstimateAndConfirm.js` (`showMia`), Plan Comparator `src/routes/Plans/routes/PlanComparator/components/PlanComparator/PlanComparator.js` |
| Session cleanup | `src/routes/Plans/routes/Estimation/modules/estimation.js`, `src/routes/Plans/routes/History/modules/history.js` (`deleteSession`) |

MIA APIs (for disambiguation only):

| Method | Path | Purpose in code |
| --- | --- | --- |
| POST | `{API_ENDPOINT_AGENT}/mia/ingest/` | Start session; body includes `enterpriseid`, `planid`, `userId`, `env_selected`, `token` |
| POST | `{API_ENDPOINT_AGENT}/mia/chatResponse/` | Chat; can stream (`Accept: text/event-stream`) with `sessionId`, `planid`, `enterpriseid`, `user_query`, `stream: true` |
| POST | `{API_ENDPOINT_AGENT}/plancomparator/advanceComparator/` | Plan comparator chat |
| DELETE | `{API_ENDPOINT_AGENT}/mia/delete/` | Delete session |

`userId` for MIA comes from localStorage `userIdentifier` (user `authId`), **not** the Freshchat email `externalId`.

`package.json` includes `openai` (`^6.44.0`) but **no `import`/`require` of `openai` was found** in application source. MIA uses `agentAPIService` / `fetch` to `API_ENDPOINT_AGENT`.

**Replacement of Freshchat should not assume it must replace MIA** unless product explicitly unifies them. They are separate entry points and backends.

---

## 11. FAQ / Self Service Portal

### In this repository

- No FAQ data, categories, search, or Self Service Portal routes.
- README “FAQ” is the React starter-kit wiki, unrelated to the product chatbot (`README.md:218-220`).
- The only “self service / help portal” URL in product UI is Freshdesk:

```text
https://mojrosupport-assist.freshdesk.com
```

Hardcoded in `src/routes/Login/constants.js` and again as a template string in `Header.js:394` (not imported from the constant).

User context is **not** appended. Authentication to Freshdesk is **Unknown / not found in repository** (browser session with Freshdesk, if any, is outside this app).

FAQ content inside Freshchat/Freshdesk: **Unknown / not found in repository**.

---

## 12. Chatbot UI / entry point

### Launcher

- **Component:** `Header` (`src/components/Header/Header.js:377-388`)
- **Control:** `Button` `buttonType="iconButton"` `tooltip="Chat"`
- **Icon:** `Icons icon="chat_outline"` (`src/components/Icons/Icons.js` + icomoon set)
- **Placement:** Header toolbar `ul.rightToolsList`, after Notifications, before Support
- **CSS:** No chat-specific class. Shared `.rightToolsList` (`src/components/Header/Header.scss:498-505`) — flex row, left border on `li`
- **Native Freshchat bubble:** Hidden via HTML/config (Section 4)

### When the launcher is shown

Shown only if `isUserLoggedIn && !isPublicRoute` (`Header.js:308`).

Public routes that hide the whole header chrome (including Chat):

- `src/routes/LocateAddress/index.js` — `setIsPublicRoute(true)` on enter
- `src/routes/Track/routes/ShipmentTrack/index.js` — same

No `Can` / permission wrapper on Chat. No feature flag. No route list besides the public-route hide.

### Mobile

Chat stays in the header icon row on mobile. Only QuickSearch is relocated (`Header.js:336`, `443-447`). No separate mobile chat behaviour.

### Open/close

Open: Chat click → identify user → `fcWidget.open('open')` if not already open.  
Close: not implemented in Shipper (user uses widget UI).

### Support launcher (related UI)

Same toolbar: `tooltip="Support"`, `Icons icon="help_outline"`, new tab to Freshdesk.

---

## 13. Authentication and user identity (chat-relevant only)

| Topic | Behaviour in this repo |
| --- | --- |
| App auth | Auth0; Bearer JWT on Mojro HTTP APIs |
| Freshchat auth | Freshchat widget session via `fcWidget.user.*`. JWT is **not** passed to Freshchat |
| User id for Freshchat | `email` as `externalId` (not `authId` / numeric `id`) |
| Name | `fullName` → `firstName`; enterprise name → `lastName` |
| Email | Primary profile email |
| Cookies / localStorage for Freshchat | Not written by Shipper. Widget may use its own storage (Freshworks; not in this repo) |
| Shipper localStorage used as **source** | `userData`, `idToken` (for fetching user, not for FC payload) |
| Sync | On each Chat click (create or update). Not on login. Not on hierarchy change until next click |
| Logout | `AuthService.logout` (`src/utils/authService.js:89-91`) calls `clearFreshchatUser()` then clears `idToken`, `userData`, etc. Header Sign out: `src/components/Header/Header.js:829-834`. Also `HeaderContainer.js:108` version-mismatch logout and `APIService` 401 logout |

`clearFreshchatUser` (`src/utils/freshchatUtils.js:19-43`):

1. If no `fcWidget`, skip  
2. Else `fcWidget.user.clear()` if present  
3. Else `fcWidget.resetUser()` if present  

Does not call `fcWidget.close`. Does not clear `fcWidgetMessengerConfig`.

---

## 14. Environment variables and configuration

| Item | Found? |
| --- | --- |
| Freshchat env vars (`FRESHCHAT_*`, etc.) | **No** |
| Freshdesk env vars | **No** |
| Feature flags for chat | **No** |
| Widget script URL | Hardcoded `src/index.html:179` |
| Support URL | Hardcoded (two places, same string) |
| Deployment config for chat | **No** (not in `config/index.js` / `config/proxy-api-config.js`) |

`API_ENDPOINT_ENTERPRISE` is used only as the host for the **user** GET that fills Redux, not for chat.

`API_ENDPOINT_AGENT` is **MIA only**, not Freshchat.

---

## 15. Current dependencies

No npm package named Freshchat / Freshworks.

| Package | Version (package.json) | Chatbot relevance |
| --- | --- | --- |
| *(none)* | — | Widget loaded from CDN, not npm |
| `react-icomoon` | `^2.5.4` | Renders `chat_outline` / `help_outline` launcher icons only |
| `react-router` `Link` | app dependency | Support button `target="_blank"` |

`jquery` is on `index.html` for other app reasons; Freshchat utils do not use it.

---

## 16. Current chatbot architecture

```text
Mojro Shipper SPA
      │
      ├── src/index.html
      │     loads //in.fw-cdn.com/31739313/888765.js
      │     hideChatButton / hide=true / eagerLoad
      │
      ├── Header (logged-in, not public route)
      │     │
      │     ├─ Chat button
      │     │     initializeFreshchat(userDetails, userHierarchy, enterpriseName)
      │     │     openFreshchatWidget()
      │     │           │
      │     │           ▼
      │     │     Freshchat widget (window.fcWidget)
      │     │           │
      │     │           └─ Support / Interactive AI / FAQ inside widget
      │     │                 Unknown / configured in Freshworks, not this repo
      │     │
      │     └─ Support button
      │           new tab → https://mojrosupport-assist.freshdesk.com
      │
      └── AuthService.logout → clearFreshchatUser()

(Separate, not on this diagram’s Freshchat path)
MIA IntelligentAgent ──► API_ENDPOINT_AGENT /mia/*  (plans only)
```

---

## 17. Current API flow diagram

```text
User
 │
 ├─► Login
 │     GET /enterprise/v2/users/{authID}   (identity for later Chat click)
 │     (Freshchat not called)
 │
 ├─► Click Chat
 │     no Mojro HTTP
 │     fcWidget.user.get → create|update
 │     fcWidget.open
 │     subsequent HTTP: Freshworks (not in this repo)
 │
 ├─► Click Support / Contact Support
 │     GET https://mojrosupport-assist.freshdesk.com  (browser navigation)
 │
 └─► Logout
       fcWidget.user.clear or resetUser
       no Mojro chat API
```

---

## 18. Data flow

```text
User logs into Shipper (Auth0)
  ↓
JWT stored (localStorage idToken)
  ↓
GET /enterprise/v2/users/{authID}
  ↓
userData persisted; Redux header:
    userDetails { fullName, email, role, id, authId, photoUrl }
    enterpriseName
    userHierarchy[]
  ↓
User clicks Chat
  ↓
Payload to Freshchat (email as id, fullName, enterprise as lastName, meta cf_*)
  ↓
Freshchat widget UI
  ↓
Support / AI / FAQ / tickets: Freshworks/Freshdesk
  ↓
Shipper does not read conversation id, ticket id, or bot replies
```

---

## 19. Existing functionality checklist

| Functionality | Exists | Implementation | Source |
| --- | --- | --- | --- |
| Chatbot launcher | Yes | Header icon button | `src/components/Header/Header.js:377-388` |
| Hide default FC launcher | Yes | `hide="true"`, `hideChatButton: true` | `src/index.html:169-179`, `Header.js:204-208` |
| Widget script load | Yes | CDN, defer, app HTML | `src/index.html:179` |
| User identification | Yes | `fcWidget.user.create` / `update`, `externalId` = email | `src/utils/freshchatUtils.js:63-104` |
| User metadata | Yes | `cf_enterprise`, `cf_hierarchy`, `cf_role`, `cf_app` | `src/utils/freshchatUtils.js:54-60` |
| Open widget | Yes | `fcWidget.open('open')` | `src/utils/freshchatUtils.js:113-126` |
| Clear user on logout | Yes | `clear` / `resetUser` | `src/utils/authService.js:89-91`, `freshchatUtils.js:19-43` |
| Identify on login / widget init | No (commented) | `onInit` body commented | `src/components/Header/Header.js:210-213` |
| Support (header + login error) | Yes | New tab Freshdesk URL | `Header.js:390-400`, `Login/constants.js:3` |
| Ticket creation in Shipper | No | Unknown / not found in repository | — |
| Interactive AI in Shipper (Freshchat) | No | Unknown / not found in repository (likely Freshworks) | — |
| FAQ in Shipper | No | Unknown / not found in repository | — |
| Self Service Portal URL | Yes (Freshdesk host only) | Hardcoded URL, no app filtering | `Login/constants.js`, `Header.js` |
| Conversation object in Shipper | No | Unknown / not found in repository | — |
| Conversation ID in Shipper | No | Unknown / not found in repository | — |
| JWT passed to chatbot | No | Not in FC payload | `freshchatUtils.js` |
| Chat permission / feature flag | No | Hidden only when header hidden | `Header.js:308` |
| Mojro HTTP chat API (Freshchat) | No | — | — |
| MIA plan AI chat | Yes, **separate product** | IntelligentAgent + `/mia/*` | See Section 10.2 |

---

## 20. What the replacement chatbot MUST support

Not a wishlist. Only current behaviour.

### Must reproduce

1. **Logged-in header Chat control** that opens a chat UI, with default third-party bubble hidden.
2. **Identify the signed-in user** using:
   - unique id = **email**
   - first name = **fullName**
   - last name field = **enterprise name**
   - email = **primary profile email**
   - metadata: enterprise name, current hierarchy root **name**, role **name**, app tag **`Shipper`**
3. **Re-apply identity when Chat is opened** (create vs update based on existing widget user).
4. **Clear widget user on Shipper logout** so the next login does not keep the previous identity.
5. **Do not require Chat on public track/locate routes** (header not shown).
6. **Header Support + login-error Contact Support** must still reach `https://mojrosupport-assist.freshdesk.com` in a new tab **unless/until product replaces that portal** — that is current UX, independent of the widget internals.
7. Widget must load for the SPA (today: India Freshworks CDN script with `chat=true`, eager load, hidden default button).

### Need to investigate

Anything users see **inside** Freshchat/Freshdesk after the widget or portal opens, because it is not in this repo:

- Bot greeting, menus, “Support” vs “Interactive AI” vs FAQ inside the widget
- Whether Freshchat creates Freshdesk tickets and with which fields
- FAQ / knowledge base content and categories
- Freshdesk portal auth, branding, ticket forms
- Freshworks dashboard: widget `31739313` / `888765`, custom fields `cf_*`
- Effect of overwriting `fcWidgetMessengerConfig` to only `{ externalId }` on Chat click
- MIA (`IntelligentAgent`) — keep as a separate plan feature unless product says to merge

### Future enhancements

**None discovered as unimplemented-but-intended chat features in this repo**, other than the **commented** `initializeFreshchat` inside `fcSettings.onInit` (would identify the user at widget init, not only on click). That is disabled today; reproducing **current** UX means identify-on-click, not identify-on-init.

---

## 21. What this document does not do

It does not choose an LLM, vector DB, agent framework, database, or cloud for the replacement.

It does not document the rest of Shipper (orders, trips, Auth0 beyond chat identity, MIA beyond disambiguation).

---

## 22. Source index (quick verify)

```text
src/index.html:169-179                          script + fcWidgetMessengerConfig
src/utils/freshchatUtils.js                     all FC SDK usage
src/components/Header/Header.js:204-215         fcSettings; onInit commented
src/components/Header/Header.js:308             launcher visibility
src/components/Header/Header.js:377-400         Chat + Support buttons
src/containers/HeaderContainer.js:160-164       Redux props
src/modules/header.js:111-173                   logUserIn → userDetails / enterprise / hierarchy
src/utils/getInitialState.js:41-48              same userDetails on restore
src/utils/authService.js:89-91                  logout clear FC
src/utils/authService.js:121-136                authID from JWT
src/routes/Login/apis/LoginAPIs.js:30-46        GET user
src/routes/Login/components/Login/Login.js:76-79  getUserData call
src/routes/Login/constants.js:3                 SUPPORT_URL
src/components/ErrorPage/ErrorPage.js:24-32     Contact Support
src/routes/Profile/.../myprofile.js:33-56       userDetails refresh (not auto-pushed to FC)
src/apis/APIService.js:7-24,126-128             Bearer token; enterprise base URL
src/routes/LocateAddress/index.js               public route hides header
src/routes/Track/routes/ShipmentTrack/index.js  public route hides header
src/components/IntelligentAgent/*               MIA, not Freshchat
src/apis/IntelligentAgentApis.js                MIA HTTP
```

Search performed for: Freshchat, Freshworks, freshchat, freshworks, fcWidget, fcSettings, fw-cdn, chatbot, FAQ, Self Service, Interactive AI, Oliv, conversationId, ticket, widget launcher, and related SDK names. No additional Freshchat integration files were found.
