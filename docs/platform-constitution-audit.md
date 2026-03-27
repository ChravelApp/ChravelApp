# Chravel Platform Constitution Audit

Date: 2026-03-27
Branch: `cursor/chravel-platform-constitution-0870`
Scope: Platform-wide scalability, concurrency, integrity, permissions, reliability, and growth-stage architecture audit for the current repository state.

## 1. Executive Summary
Chravel currently presents a broad product surface, but the repository is still structurally closer to a prototype shell than to a production platform. The most important platform-wide risks are:

1. Core platform truth does not exist server-side for the main domain. Trips, memberships, permissions, chat, invites, shared objects, and most collaboration surfaces are represented primarily as frontend state, mock data, and UI gating rather than durable backend-enforced entities.
2. Authorization is fragmented and mostly client-implied. Roles in `src/hooks/useAuth.tsx`, `src/components/pro/ProTabsConfig.tsx`, `src/components/events/EventDetailContent.tsx`, and `src/components/TransportationAccommodations.tsx` are not backed by authoritative server-side checks for the main product surfaces.
3. Shared-state mutation safety is missing. Chat, calendar, files, receipts, polls, and collaborative itinerary behaviors use local React state with no platform mutation contract, no idempotency model, no optimistic concurrency, no conflict policy, and no audit trail.
4. Invite/share/join trust boundaries are not implemented. `src/components/InviteModal.tsx` creates a static invite token and a route that does not exist in `src/App.tsx`. There is no authoritative invite acceptance or membership-creation path in the repo.
5. AI and edge-function security are ahead of the UI in some places and behind it in others. `supabase/functions/generate-audio-summary/index.ts` is the only materially real cross-surface write path, but it trusts client-supplied `user_id`, uses service role, and performs arbitrary server-side URL fetches. Other edge functions explicitly lack JWT enforcement.
6. Observability, rollout safety, and plan-aware QoS are largely absent. There are no in-repo metrics, traces, feature flags, canary rules, or rate-limit policies that would protect a production system during bursty traffic or abuse.

The platform is coherent in a few narrow areas:

1. The product taxonomy is visible. Consumer trips, pro trips, and event trips are clearly intended as distinct surfaces through routes like `src/pages/TripDetail.tsx`, `src/pages/ProTripDetail.tsx`, and `src/pages/EventDetail.tsx`.
2. The UI organization is reasonably clean. Shared shells exist for trip-like experiences, and types in `src/types/pro.ts`, `src/types/events.ts`, and `src/types/messaging.ts` show the intended domain breadth.
3. The audio-summary Supabase migration shows that the team has started thinking about RLS, storage policies, and quotas.

The platform is fragmented in the load-bearing areas:

1. Identity and session lifecycle.
2. Membership and access control.
3. Shared durable object ownership.
4. Invite/share/join routing and redemption.
5. Realtime and unread semantics.
6. Shared-write integrity.
7. Tier-aware execution and abuse protection.

The currently safest surfaces are the ones that are effectively render-only or local-only:

1. Static route rendering and tab composition.
2. Read-mostly event/pro detail presentation.
3. Local user preference and settings UI that does not actually persist.

The most dangerous surfaces under real scale or concurrent usage are:

1. AI Concierge and audio generation.
2. Invites, share links, and join flow.
3. Auth/session/account lifecycle once real auth is wired in.
4. Chat, channels, unread counts, and any future realtime fanout.
5. Shared planning objects: tasks, polls, calendar, basecamp, places, links, files, receipts.
6. Media-heavy workflows.
7. Event-trip participation surfaces with large member counts.

Salvageability assessment:

1. The architecture is salvageable with staged hardening for stage-A and stage-B growth, but only if the team first establishes a canonical backend domain model and a platform mutation contract.
2. It does not honestly support production multi-user collaboration as-is.
3. For large shared state, hot trips, large events, and plan-aware QoS, a deeper redesign is required because those capabilities are effectively not implemented yet.

Current likely limits:

1. In its current repository form, Chravel is demo-safe, not production-safe.
2. Shared collaboration semantics break conceptually at the first real multi-user write because there is no canonical backend truth or conflict model.
3. Public exposure of current edge functions would create immediate abuse and cost risk before any large user scale is reached.

## 2. Full Platform System Map
### Major Entities In The Current Repo
Current domain entities are spread across frontend types, mock fixtures, and a small Supabase footprint:

1. Users and mock auth state: `src/hooks/useAuth.tsx`
2. Consumer subscription state: `src/hooks/useConsumerSubscription.tsx`, `src/types/consumer.ts`
3. Pro/team/org entities: `src/types/pro.ts`
4. Event entities: `src/types/events.ts`
5. Messaging entities: `src/types/messaging.ts`
6. Basecamp/place entities: `src/types/basecamp.ts`
7. Receipt entities: `src/types/receipts.ts`
8. Mock trip and event data: `src/data/proTripMockData.ts`, `src/data/eventsMockData.ts`
9. Audio summary storage/quota entities: `supabase/migrations/001_audio_summaries.sql`

### Major Product Surfaces
Primary UI surface modules:

1. Home/index: `src/pages/Index.tsx`
2. Consumer trip detail: `src/pages/TripDetail.tsx`
3. Pro trip detail: `src/pages/ProTripDetail.tsx`
4. Event detail: `src/pages/EventDetail.tsx`
5. Shared trip tabs: `src/components/TripTabs.tsx`
6. Chat/inbox: `src/components/TripChat.tsx`, `src/components/MessageInbox.tsx`, `src/hooks/useMessages.ts`
7. AI Concierge: `src/components/GeminiAIChat.tsx`, `src/components/UniversalTripAI.tsx`, `src/services/openAI.ts`, `src/services/aiFeatures.ts`, `src/hooks/useAiFeatures.ts`
8. Invites and trip membership settings: `src/components/InviteModal.tsx`, `src/components/TripSettings.tsx`, `src/components/TripUserManagement.tsx`
9. Files and receipts: `src/components/FilesTab.tsx`, `src/components/receipts/ReceiptUploadModal.tsx`, `src/components/receipts/ReceiptsTab.tsx`
10. Photos and comments: `src/components/PhotoAlbum.tsx`, `src/components/CommentsWall.tsx`
11. Basecamp and places: `src/components/BasecampSelector.tsx`, `src/components/PlacesSection.tsx`
12. Calendar/itinerary: `src/components/GroupCalendar.tsx`, `src/components/CollaborativeItineraryCalendar.tsx`, `src/pages/ItineraryAssignmentPage.tsx`
13. Polls: `src/components/poll/Poll.tsx`, `src/components/poll/CreatePollForm.tsx`
14. Event-specific networking/registration/agenda: `src/components/events/*`
15. Pro-specific roster/equipment/finance/compliance/media: `src/components/pro/*`, `src/components/enterprise/*`

### Current Data Flow Boundaries
Current runtime data flow is primarily:

1. Browser routes and components.
2. Local React state and mock fixture reads.
3. Optional `fetch('/api/...')` calls for AI/search.
4. Supabase edge functions for a narrow AI/audio footprint.
5. Third-party APIs behind edge functions or assumed host routes.

In practice:

1. `src/App.tsx` sets up the route shell and an unconfigured `QueryClient`.
2. Most user/session state is local state in `src/hooks/useAuth.tsx`.
3. Most shared object state is mock or local state inside components and hooks.
4. AI/search flows call relative `/api` paths in the client.
5. Edge functions in `supabase/functions/*` are the only repo-visible backend service layer.

### Trust Boundaries
Current trust boundaries are:

1. Browser client.
2. Relative `/api/*` backend or host routing not defined in repo.
3. Supabase edge functions: `supabase/functions/gemini-chat/index.ts`, `supabase/functions/search/index.ts`, `supabase/functions/ai-features/index.ts`, `supabase/functions/generate-audio-summary/index.ts`
4. Supabase Postgres/storage through edge functions and one migration.
5. Third-party providers: Google Gemini, OpenAI, ElevenLabs, Google Maps API.

Current weak trust boundaries:

1. Edge functions with no JWT validation.
2. Service-role writes that trust body fields.
3. Browser-only role/permission assumptions.
4. Hardcoded API key usage in `src/utils/distanceCalculator.ts`.

### Shared State Boundaries
Current shared-state boundaries are inconsistent:

1. Consumer trip objects are inline in `src/pages/Index.tsx` and not loaded by ID in `src/pages/TripDetail.tsx`.
2. Pro trips and event trips use mock data maps keyed by route IDs.
3. Messages are local hook state, not canonical shared rows.
4. Files, receipts, photos, comments, and itinerary additions are local-only.
5. Broadcasts and notifications are mock/local.

### User-Private State Boundaries
Current user-private state includes:

1. Mock auth user profile and notification settings in `src/hooks/useAuth.tsx`
2. Consumer subscription state in `src/hooks/useConsumerSubscription.tsx`
3. Travel wallet in `src/components/TravelWallet.tsx`
4. Audio summaries and quota in `supabase/migrations/001_audio_summaries.sql`

### Invite/Share Access Paths
Current access paths:

1. `src/components/InviteModal.tsx` creates `https://trips.lovable.app/join/${tripId}?invite=abc123`
2. `src/App.tsx` has no `/join` route
3. No server-side invite redemption or membership creation path exists in-repo

### Realtime Boundaries
Current realtime boundaries are effectively nonexistent:

1. No realtime client library is present in the SPA.
2. No websocket/subscription layer exists in `src/`.
3. Unread and notifications are local derivations.

### AI Mutation Boundaries
Current AI boundaries:

1. Most AI interactions are read-only prompt/response UX.
2. The only meaningful durable write path is `supabase/functions/generate-audio-summary/index.ts`, which writes storage and DB rows for audio summaries.
3. No generalized AI mutation layer or tool-calling framework exists.

### Likely Scale Bottlenecks
Likely first bottlenecks:

1. Edge-function abuse and provider-cost amplification.
2. Shared-state divergence once collaboration becomes real.
3. Invite/share funnel breakage due to missing routing and backend redemption.
4. Media upload memory and payload handling in the browser.
5. Event-hotspot fanout once channels/chat become real.
6. Lack of observability and feature flags during rollout.

## 3. Platform Invariants
The following platform invariants are non-negotiable and must govern every future feature.

### Ownership
1. Every durable object must carry a canonical scope tuple: `scope_type`, `scope_id`, `owner_principal_type`, `owner_principal_id`.
2. No object may be “implicitly owned” by whichever page created it.
3. Shared objects must belong to a trip, channel, event, or organization scope. Private objects must belong to a single user scope.

### Authorization
1. No client-supplied role, `permissions` array, or `user_id` field is authoritative.
2. All create, update, delete, invite, and share operations must be authorized server-side using authenticated identity plus membership/capability checks.
3. UI gating is advisory only and cannot be relied on for protection.

### Shared vs Private Writes
1. Private objects are writable only by the owning user unless explicit delegated access is modeled.
2. Shared objects must be writable only by authenticated members with explicit write capability for that scope.
3. Admin-only objects must never be writable from a generic shared mutation path.

### Actor Attribution
1. Every durable mutation must record `actor_user_id`, `actor_type` (`human`, `ai`, `system`), `request_id`, and `mutation_id`.
2. AI-originated changes must also record `initiating_user_id`.
3. Shared content must preserve attribution after later role changes or account deletion.

### Idempotency
1. Every externally retryable mutation must accept an idempotency key.
2. Every side-effecting AI/tool/media operation must dedupe by mutation key before provider calls or storage writes.
3. Idempotency must be enforced server-side, not only in the client.

### Duplicate Prevention
1. Memberships must be unique on `(container_id, user_id)`.
2. Invite redemption must be unique on `(invite_id, user_id)`.
3. Poll votes and RSVPs must be unique on `(poll_or_session_id, user_id)`.
4. File/object insertions with retries must reuse the same logical mutation key, not create duplicates.

### Retry Safety
1. Clients may retry network operations.
2. Servers must be safe under at-least-once delivery for all non-read operations.
3. Any operation that cannot be retried safely must be made asynchronous behind a deduped job entry.

### Optimistic UI Reconciliation
1. Optimistic UI is allowed only for objects with a clear rollback and reconciliation strategy.
2. The client must surface `pending`, `confirmed`, `rejected`, and `conflicted` states.
3. Local optimistic state must reconcile to canonical server version/sequence numbers after acknowledgement.

### Conflict Resolution
1. Membership/access/invite objects are strict and must use serializable uniqueness and transactional enforcement.
2. Shared planning objects must use version checks or compare-and-swap, not silent last-write-wins.
3. Append-only objects like chat messages, comments, uploads, and broadcasts must be immutable after creation except for moderation or soft-delete operations.
4. Presence, typing, and ephemeral counters may use eventual consistency and expiry.

### Background/Foreground Reconnection
1. Realtime reconnect must never assume lost deltas were delivered.
2. On app resume, the client must fetch canonical state since last acknowledged cursor/version.
3. Unread counts and activity feeds must always be recomputed from durable read pointers or event sequences.

### Membership State Truth
1. Membership truth lives only in membership rows, not route state, not UI local state, and not invite state.
2. Invite acceptance is not membership until the membership row is created successfully.
3. Revoked or expired invites must never implicitly grant access.

### Invite Acceptance Truth
1. Invite redemption and membership creation must happen in one transaction or one idempotent server command.
2. Duplicate redemptions must return the existing membership result, not error or double-create.

### Deletion Semantics
1. Shared durable objects must default to soft-delete plus audit retention.
2. Media/blob deletion must lag logical deletion and be driven by retention-safe cleanup jobs.
3. Account deletion must preserve the integrity of shared history and attribution while removing or anonymizing private data per policy.

### Auditability
1. All privileged or shared mutations must emit audit records.
2. Audit records must be append-only and queriable by actor, scope, mutation type, and request ID.
3. No platform-critical path may depend solely on ad hoc `console.log`.

## 4. Object Scope Constitution
### User-Private Objects
Objects:

1. Profile settings
2. Personal notification settings
3. Travel wallet
4. Private AI scratchpad/history
5. Personal saved searches or drafts
6. User-owned audio summaries that are not explicitly trip-shared

Rules:

1. Owner: one user
2. Viewers: owner only unless explicitly shared
3. Editors: owner only
4. Mutation rules: direct write allowed by authenticated owner; idempotency required for provider-backed features
5. Concurrency rules: last-write-wins is acceptable for low-value preferences; version checks required for higher-value private artifacts
6. Audit requirements: profile/security changes audited; low-risk UI preferences may use reduced audit detail
7. Deletion/archive: hard delete allowed where legally safe; audit/security history retained separately

### Trip-Shared Objects
Objects:

1. Shared itinerary items
2. Shared tasks
3. Shared polls
4. Shared places
5. Basecamp
6. Shared links
7. Shared files and receipts
8. Trip-level broadcasts
9. Trip-level chat threads when no channel subdivision exists

Rules:

1. Owner: trip root object
2. Viewers: trip members according to role and sub-scope restrictions
3. Editors: trip roles with write capability
4. Mutation rules: every write requires membership, capability, mutation ID, and actor attribution
5. Concurrency rules: append-only for chat/broadcasts/comments/uploads; optimistic concurrency for mutable documents/items
6. Audit requirements: all create/update/delete/invite/share mutations audited
7. Deletion/archive: soft-delete first; attachments and comments follow cascading retention rules

### Channel-Scoped Objects
Objects:

1. Channel messages
2. Channel attachments
3. Channel polls or channel tasks
4. Channel-specific read pointers and moderation actions

Rules:

1. Owner: parent trip or event, never a random user
2. Viewers: inherited from channel membership policy
3. Editors: members with channel posting capability
4. Mutation rules: channel policy must be explicit (`announcement`, `discussion`, `admin_only`, `read_only`)
5. Concurrency rules: append-only messages; mutable channel settings versioned
6. Audit requirements: membership changes, mode changes, message moderation actions audited
7. Deletion/archive: archive channel before delete; preserve moderation log

### Event-Wide Objects
Objects:

1. Event agenda/session catalog
2. Registration state
3. Event-wide announcements
4. Event networking directory
5. Event analytics read models
6. Event-specific attendee capabilities

Rules:

1. Owner: event root object
2. Viewers: event participants by registration state and role
3. Editors: organizer/admin/moderator roles depending on object
4. Mutation rules: high-volume attendee actions must use narrow commands (`RSVP`, `check_in`, `vote`) rather than free-form updates
5. Concurrency rules: organizer edits use version checks; attendee actions use unique per-user rows
6. Audit requirements: registration, check-in, moderation, and announcement actions audited
7. Deletion/archive: event objects archived for analytics/compliance before cleanup

### Admin-Only Objects
Objects:

1. Role assignments
2. Membership suspensions/removals
3. Invite issuance/revocation
4. Compliance/medical access changes
5. Channel mode changes
6. QoS overrides and moderation actions

Rules:

1. Owner: trip/event/organization admin domain
2. Viewers: admins and auditors only
3. Editors: admin-capable actors only
4. Mutation rules: require explicit confirmation and full audit
5. Concurrency rules: strict version checks or serialized commands
6. Audit requirements: mandatory full audit payload including before/after role state
7. Deletion/archive: append-only log retained even if object is removed

### Ephemeral State
Objects:

1. Presence
2. Typing indicators
3. Client drafts
4. Temporary upload progress
5. Optimistic pending rows before server ack

Rules:

1. Owner: active client/session
2. Viewers: relevant active participants only
3. Editors: emitting session only
4. Mutation rules: no durable write path required unless converted to durable object
5. Concurrency rules: eventual consistency and expiry are acceptable
6. Audit requirements: none unless promoted into durable moderation/security events
7. Deletion/archive: automatic expiry

### Durable State
Objects:

1. Anything that affects shared truth, audit, access, billing, or user-visible history

Rules:

1. Must be stored in canonical backend tables
2. Must have actor attribution
3. Must have mutation contract and conflict policy
4. Must support recovery and replay

## 5. Permission Model Constitution
### Canonical Role Layers
Chravel should use layered permissions rather than one flat role system.

1. Platform principal: user account
2. Organization role: `org_owner`, `org_admin`, `org_member`
3. Trip role: `trip_owner`, `trip_admin`, `trip_member`, `trip_viewer`
4. Event role: `event_owner`, `event_organizer`, `event_moderator`, `event_speaker`, `event_exhibitor`, `event_attendee`
5. Channel mode plus channel capability: inherited plus overrides

### Read-Only vs Full Participation
1. Read-only is a capability state, not only a UI mode.
2. A read-only actor may view allowed content and acknowledge/read, but may not create chat messages, mutate shared objects, upload files, vote, or invite unless explicitly permitted.
3. Read-only mode must be enforceable per trip, per event, and per channel.

### Admin / Organizer / Moderator Distinctions
1. Owner: can transfer ownership, delete/archive root object, manage admins, manage billing-bound settings where applicable.
2. Admin/Organizer: can manage members, channels, announcements, invites, and shared configuration.
3. Moderator: can moderate chat/content and apply communication controls, but cannot change ownership or billing.
4. Member/Attendee: can participate in allowed shared surfaces.
5. Viewer/Read-only attendee: can consume information but not perform participatory writes unless explicitly granted.

### Event Attendee Permissions
1. Attendees may RSVP, react, vote, and post only in channels/events where participation mode allows it.
2. Speakers and exhibitors receive event-scoped capabilities only, not global admin rights.
3. Organizers can switch event mode between:
   1. `announcement_only`
   2. `moderated_discussion`
   3. `full_participation`

### Channel Posting Permissions
Channels must declare one of:

1. `admin_only`
2. `moderator_only`
3. `members_post`
4. `read_only`
5. `restricted_by_role`

Membership inheritance:

1. Default channel membership inherits from trip or event membership.
2. Restricted channels may narrow viewers or editors.
3. Private channels must never be inferred only by client-side filtering.

### Trip Types and Topologies
Chravel must treat consumer/friend trips, pro trips, and event trips as different topologies over a shared platform core, not as cosmetic variants.

Consumer/friend trips:

1. Small-group collaboration default
2. Broad shared planning participation
3. Low moderation burden
4. Light channel structure, usually optional
5. Lower fanout and lower QoS reservation needs

Pro trips:

1. Organization-linked by default
2. Strong role segmentation
3. Sensitive sub-scopes such as finance, medical, compliance, sponsor, or roster operations
4. Higher need for admin-defined channels and read restrictions
5. More explicit audit and entitlement requirements

Event trips:

1. Potentially large participant counts
2. Registration and attendee-state heavy
3. Higher moderation and fanout risk
4. Strong need for announcement, read-only, and mode-switch controls
5. Different default assumptions for chat, presence, and attachments

Platform rule:

1. All three topologies should share canonical primitives for identity, memberships, invites, messages, attachments, and audit.
2. They must be differentiated by `trip_type` plus capability/mode configuration, not by ad hoc frontend-only semantics.

### Channel Model Constitution
Channels should be modeled as first-class objects under a trip or event root.

Required channel attributes:

1. `parent_scope_type`
2. `parent_scope_id`
3. `channel_type`
4. `visibility_mode`
5. `posting_mode`
6. `membership_mode`
7. `archived_at`

Allowed channel topology:

1. Trip-local channels for consumer and pro trips
2. Event-local channels for event trips
3. Admin-defined channels by default for pro and event trips
4. User-created channels only where explicitly enabled for the trip type
5. Role-based or audience-based channels where needed (`staff`, `speakers`, `exhibitors`, `moderators`, `admins`)

Membership inheritance:

1. Default inheritance from parent trip/event membership
2. Optional narrowing by role, registration type, or admin inclusion list
3. Channel membership overrides must be explicit rows, not client-only filters

Moderation and posting:

1. Every channel must have a posting mode and moderation policy
2. Announcement channels default to admin/moderator posting only
3. Event channels should default to stricter posting than consumer trips

### Who Can Mutate Shared Resources
1. Shared trip planning objects: trip members with write capability
2. Event agenda/session catalog: organizer/admin only
3. Polls/tasks/calendar entries: creator plus roles with edit capability, subject to object ownership rules
4. Financial, medical, compliance, or sponsor objects: dedicated restricted capabilities only
5. Channel settings and moderation: admin/moderator only

### Who Can Invite Others
1. Invite creation requires explicit `can_invite` capability.
2. Share-link creation and invite creation are different operations:
   1. Invite links grant membership intent.
   2. Share links grant view access only unless explicitly upgraded through server-side redemption.
3. Event attendee self-join should only be possible for event types configured for open registration.

### Explicit Confirmation Required
Require explicit confirmation for:

1. Role escalation
2. Member removal
3. Channel mode change to or from read-only
4. Invite revocation
5. Trip/event deletion or archival
6. Any AI action that would modify shared durable state

### Auto-Applied Operations Allowed
Safe auto-applied operations:

1. Read-pointer updates
2. Ephemeral presence/typing
3. Idempotent check-in acknowledgements if explicitly modeled
4. Draft saves in private scope

### Server-Side Enforcement Expectations
1. RLS or equivalent backend checks must be the final enforcement layer.
2. Edge functions must validate JWT and membership/capability.
3. The client must never be the source of authority for role or plan checks.

## 6. Concurrency + Mutation Constitution
### Standard Mutation Envelope
Every non-read operation must carry:

1. `request_id`
2. `mutation_id`
3. `idempotency_key`
4. `actor_user_id` from verified identity
5. `actor_type`
6. `scope_type`
7. `scope_id`
8. `expected_version` where applicable

### Idempotency Keys
Required for:

1. Invite issuance
2. Invite redemption
3. Membership joins/leaves
4. File uploads and processing jobs
5. AI/audio generation
6. Payment or quota-affecting operations
7. Any user action the client may retry after timeout or reconnect

### Mutation IDs
1. The server must persist mutation IDs for dedupe and audit correlation.
2. The client must reuse the same mutation ID on retries of the same logical action.

### Retries
1. Append-only commands may be safely retried with idempotency.
2. Mutable-object writes must retry only with version awareness.
3. AI/provider jobs must never duplicate expensive work because a client retried blindly.

### Duplicate Suppression
Required server-side unique rules:

1. One active membership per `(scope_id, user_id)`
2. One redemption per `(invite_id, user_id)`
3. One vote per `(poll_id, user_id)`
4. One RSVP per `(session_id, user_id)`
5. One attachment-processing job per `(attachment_id, pipeline_stage)`

### Version Checks / OCC
Use compare-and-swap or version checks for:

1. Basecamp
2. Mutable task fields
3. Calendar events
4. Shared link metadata
5. Channel settings
6. Event agenda/session metadata

### Last-Write-Wins
Allowed only for:

1. Non-critical private preferences
2. Ephemeral presence
3. Client-local drafts

Last-write-wins is explicitly forbidden for:

1. Membership
2. Roles
3. Invites
4. Poll votes
5. RSVP state
6. Shared mutable planning objects with multiple editors

### Merge / Reject / Serialize Policy By Object Family
1. Chat messages/comments/broadcasts/uploads: append-only, idempotent create
2. Membership/invite/access control: strict transactional serialize or unique-constraint enforcement
3. Poll votes/RSVPs/reactions: per-user upsert semantics
4. Tasks/calendar/basecamp/places/links: optimistic concurrency with explicit conflict reject and client refresh
5. AI/provider jobs: queue + dedupe + status machine

### Actor Attribution
1. Every write stores human initiator even when executed through AI.
2. AI writes must use the same command path as manual writes; no hidden bypass.

### Audit Trails
1. Every shared or privileged mutation produces an audit row.
2. Audit rows must include before/after version for mutable objects.

### AI-Triggered vs User-Triggered Mutation Handling
1. AI may propose actions, but shared durable mutations require explicit tool commands with validation.
2. AI-created content is never trusted more than user-created content.
3. High-risk AI actions must require explicit user confirmation.

### Multi-User Concurrent Writes
The following object families require strict treatment:

1. Invites and memberships: strict transactional
2. Tasks/calendar/basecamp: optimistic concurrency with reject-on-stale
3. Poll votes and RSVPs: unique per-user upsert
4. Messages/comments/uploads: append-only

## 7. Access Funnel Constitution
### Invite Links
1. Invite links must be opaque, high-entropy, and server-minted.
2. Invite tokens must be stored hashed server-side.
3. Invite records must include target scope, target role/capability, issuer, expiry, status, and optional max-use count.

### Share Links
1. Share links are not membership links.
2. Share links should default to read-only and time-bounded.
3. Upgrading a viewer to member must require explicit redemption or invite flow.

### Join Flow
Canonical join flow:

1. User opens `/join/:token`
2. Server validates token metadata
3. If unauthenticated, token state is parked and auth/signup is completed
4. Redemption command runs server-side
5. Membership row is created or existing membership is returned
6. User is routed to canonical target object path

### Account Creation During Invite Acceptance
1. Signup during invite acceptance must preserve the pending token and intended target scope.
2. Signup completion must not auto-join a different scope because of stale route state.
3. Invite redemption after signup must be idempotent.

### Membership Confirmation
1. Membership is confirmed only when the membership row exists.
2. Invite status alone is insufficient.

### Duplicate Join Attempts
1. Duplicate attempts must return success with the same final membership if the user is already a member.
2. Duplicate attempts must never create duplicate memberships or burn invite state incorrectly.

### Expired / Revoked / Invalid Links
1. The user must see distinct states for invalid, expired, revoked, already-used, and unauthorized.
2. Invalid links must never leak target object metadata.

### Abuse Handling
1. Invite creation and redemption must be rate-limited.
2. Share-link hits from unknown clients must be monitored and throttled.
3. Repeated invalid-token attempts should trigger abuse controls.

### Wrong-Trip / Wrong-Event Routing Prevention
1. Tokens must encode target scope type and target scope ID.
2. The redemption endpoint must verify the canonical object path and redirect only there.
3. Client route params are never enough to determine membership.

### Authoritative Invite / Membership Truth Model
The only authoritative truth model is:

1. Invite exists as an invite row
2. Invite is redeemable only if active and valid
3. Redemption creates or returns one membership row
4. Membership row is the sole source of access truth
5. Share-link access, if allowed, is tracked separately from membership

Invite states should include:

1. `pending`
2. `redeemed`
3. `expired`
4. `revoked`
5. `cancelled`

Membership states should include:

1. `pending`
2. `active`
3. `suspended`
4. `removed`

### Trust Boundaries During Onboarding
1. Before auth: token validation only, no protected data.
2. After auth but before redemption: still not a member.
3. After redemption: member capabilities loaded from backend membership truth.

## 8. Realtime + Sync Constitution
### What Truly Needs Realtime
Realtime should be reserved for:

1. Active chat/channel messages
2. Broadcast delivery indicators
3. Poll result deltas when the poll is open
4. Task/calendar change notifications in active collaborative sessions
5. Presence/typing only for low-scale rooms

Everything else should default to query/invalidate or periodic refresh.

### Subscription Model
1. Per-user inbox subscription
2. Per-active-trip subscription
3. Per-active-channel subscription
4. Avoid subscribing to all trip surfaces simultaneously

### Reconnect and Backfill
1. Every realtime stream must carry or map to a durable sequence/cursor.
2. On reconnect or foreground resume, the client must query for missed events since last acknowledged sequence.
3. Realtime is a delta notification path, not the durable source of truth.

### Activity Feed Consistency
1. Activity feeds should be fed from append-only event records or materialized read models.
2. They should not be recomputed from local component state.

### Unread Calculations
1. Unread counts must be based on server-side read pointers and message sequences.
2. The client may cache unread counts, but canonical truth is backend-derived.

### Hot Room / Hot Event Behavior
For large events:

1. Default to announcement channels and limited participation.
2. Disable typing, presence, and per-message read receipts.
3. Batch broadcast fanout.
4. Use denormalized unread/activity read models.

### Channel and Trip Sync Rules
1. Trip-level state updates should invalidate trip-level queries.
2. Channel-specific deltas should not force full-trip refetch unless the object family overlaps.

### Background / Foreground Lifecycle
1. Backgrounded clients stop low-value realtime subscriptions where possible.
2. Foreground resume performs catch-up queries before declaring sync complete.

### Multi-Device Consistency
1. Read pointers, membership state, and durable object versions are server truth.
2. Device-local drafts remain private until submitted.

### Event-Scale Modes
Event trips require explicit operational modes.

Announcement mode defaults:

1. Event-wide announcement channel enabled
2. Attendee posting disabled by default
3. Typing and presence disabled
4. Attachments restricted to organizers/moderators
5. Polls and Q&A only if separately moderated

Moderated participation mode:

1. Attendee posting may be allowed in selected channels
2. Message throughput limits apply per attendee
3. Attachment posting is restricted or size-limited
4. Moderation queues may be required for specific channels

Full participation mode:

1. Use only for smaller or intentionally collaborative events
2. Must still support emergency fallback to read-only or announcement-only
3. Presence/typing should remain disabled above defined occupancy thresholds

Presence and typing rule:

1. Presence and typing should not exist by default for event scopes expected to exceed moderate room size.

## 9. Scale-Tier Architecture Plan
### Stage A: 100–1,000 active users
Primary bottlenecks:

1. Missing real auth and membership enforcement
2. Missing canonical backend data for main trip surfaces
3. Open AI edge-function abuse

Required infra changes:

1. Real auth/session client and server validation
2. Core tables and RLS for trips, memberships, invites, attachments, audit log
3. Restrictive CORS and edge JWT enforcement

Required data integrity changes:

1. Canonical IDs and memberships
2. Invite redemption transaction
3. Mutation envelope and audit basics

Required QoS/rate limiting:

1. Basic per-IP and per-user rate limits on auth, invite, AI, and media
2. Basic monthly quotas for costly AI features

Required observability:

1. Error tracking
2. Structured edge logs
3. Request IDs

Surfaces that become risky first:

1. AI/audio
2. Invites/join
3. Chat/unread

Acceptable now but fails later:

1. Single Postgres instance for core domain
2. Query/invalidate instead of full realtime for most non-chat surfaces

### Stage B: 1,000–10,000
Primary bottlenecks:

1. Shared planning object contention
2. File/media upload paths
3. Search and AI cost
4. Event and inbox unread computation

Required infra changes:

1. Background job queue for AI/media processing
2. Denormalized unread/activity read models
3. Proper file metadata tables and cleanup jobs

Required data integrity changes:

1. Versioned writes for mutable shared objects
2. Dedupe and retry-safe processing jobs

Required QoS/rate limiting:

1. Per-trip and per-org caps for hot scopes
2. Paid-priority worker queue for AI/media jobs

Required observability:

1. Latency, error, and cost dashboards by feature and tier
2. Synthetic invite/auth/AI checks

Surfaces that become risky first:

1. Tasks/polls/calendar/basecamp
2. Media uploads
3. Event participation at moderate scale

Acceptable now but fails later:

1. Single-region operation
2. Trip-scoped subscriptions without hot-channel isolation

### Stage C: 10,000–100,000
Primary bottlenecks:

1. Hot event fanout
2. Messaging/unread pressure
3. Search indexing and attachment metadata growth
4. Abuse and spam on invite/share/auth funnels

Required infra changes:

1. Dedicated messaging/realtime subsystem or heavily optimized Postgres read models
2. Queue-backed fanout
3. CDN-backed media delivery with derivative generation
4. Strong abuse detection and moderation tooling

Required data integrity changes:

1. Explicit event sequence architecture
2. Strong moderation/audit controls

Required QoS/rate limiting:

1. Tier-aware reserved capacity
2. Event-host/admin priority lanes
3. Tight per-scope burst controls

Required observability:

1. SLOs and burn-rate alerting
2. Cost anomaly detection

Surfaces that become risky first:

1. Large event chat/channels
2. Registration/check-in
3. Shared file/comment/media flows

Acceptable now but fails later:

1. Generic query-per-screen patterns for hot events
2. Full-participation default in large public events

### Stage D: 100,000–1,000,000+
Primary bottlenecks:

1. Multi-region latency and failover
2. Global abuse and bot pressure
3. Event hotspot amplification
4. Search and AI cost at scale

Required infra changes:

1. Multi-region frontend and edge routing
2. Dedicated queue and job orchestration
3. Sharded or partitioned high-volume message/activity tables
4. Dedicated moderation and abuse services

Required data integrity changes:

1. Partition-aware read models
2. Explicit disaster-recovery and replay strategies

Required QoS/rate limiting:

1. Tier and organization reservation pools
2. Budget-based circuit breakers for AI/tooling

Required observability:

1. Full distributed tracing
2. Region-aware SLOs
3. Capacity forecasting

Surfaces that become risky first:

1. Event trips
2. Channels
3. AI and media-heavy workflows

Architecture choices acceptable now but failing later:

1. Single shared provider quota pools
2. No partitioning of activity/message data
3. No explicit hot-scope protection

## 10. Free vs Paid QoS Constitution
### Traffic Segmentation Principles
1. Free usage must never degrade organizer/admin/core operational workflows.
2. Paid interactive requests and organizer/admin actions get priority over free exploratory AI and bulk uploads.
3. Free and paid resource budgets must be enforceable server-side.

### Default Initial QoS Policy
Consumer Free:

1. 2 concurrent AI requests per user
2. 20 AI/search requests per 10 minutes
3. 2 simultaneous uploads
4. Lower-priority async queue for expensive AI/media jobs

Consumer Plus:

1. 5 concurrent AI requests per user
2. 100 AI/search requests per 10 minutes
3. 5 simultaneous uploads
4. Medium-priority async queue

Pro/Event Admin and Organizer:

1. Reserved request budget per org/event
2. Higher-priority queue for operational actions
3. Higher upload concurrency
4. Elevated notification and invite issuance budgets

### Feature-Level Rate Limits
1. Auth/login/signup/reset endpoints: aggressive abuse throttling
2. Invite creation: per issuer and per scope caps
3. Invite redemption: per token and per IP caps
4. AI chat: per user, per org, and global provider budget
5. Audio generation: per user/month and per org/month
6. File/media uploads: per user active upload caps and per-scope storage caps

### Queueing and Degraded Behavior
1. AI/audio/media transforms should queue when resource pressure is high.
2. Free-tier background jobs should yield to paid operational jobs.
3. During degradation:
   1. Typing/presence disabled first
   2. AI disabled or downgraded next
   3. Bulk invite/send delayed before critical operational paths are affected

### Event Host/Admin Protections
1. Event organizer announcements and moderation commands must always have reserved capacity.
2. Event-wide read-only mode must be available as a pressure valve.
3. Large events should default to announcement-first configuration until explicitly opened.

### Abuse Containment
1. Invalid invite redemption spikes, login spikes, and AI bursts must trip protective throttles.
2. Public link scraping and repeated bad-token attempts must be detectable.

## 11. Dangerous Surface Ranking
### 1. AI Concierge and Audio Generation
Severity: Critical

1. Failure shape: provider-cost blowup, user-id spoofing, SSRF-like external fetch abuse, wrong-scope data injection
2. Blast radius: org-wide, user-wide, and provider-budget-wide
3. Why risky: current edge functions lack strong auth and trust body fields; client paths are inconsistent
4. Governing rule: all AI execution must be authenticated, scoped, rate-limited, deduped, and audited

### 2. Trip Invites, Share Links, and Join Flow
Severity: Critical

1. Failure shape: wrong routing, open access, duplicate joins, broken conversion funnel
2. Blast radius: access control and growth funnel
3. Why risky: no canonical route or server-side redemption exists; invite token is static
4. Governing rule: invite and membership truth must be transactional and server-owned

### 3. Auth and Account Lifecycle
Severity: Critical

1. Failure shape: session confusion, spoofed roles, abuse on signup/login, no durable identity truth
2. Blast radius: every platform surface
3. Why risky: auth is still mock/local in the repo
4. Governing rule: real auth/session lifecycle must be the root trust layer for all features

### 4. Chat and Future Channels
Severity: High

1. Failure shape: duplicate messages, inconsistent unread counts, split-brain local state, future fanout overload
2. Blast radius: high for active trips/events
3. Why risky: no canonical backend store, no realtime contract, no channel model
4. Governing rule: messages are append-only, unread derives from read pointers, channels have explicit modes

### 5. Shared Planning Objects: Tasks, Polls, Calendar, Basecamp, Places, Links
Severity: High

1. Failure shape: lost updates, duplicate actions, stale overwrites
2. Blast radius: trip or event scope
3. Why risky: local state today, no versioning or conflict policy
4. Governing rule: mutable shared objects require optimistic concurrency and audit

### 6. Media Uploads and Attachments
Severity: High

1. Failure shape: memory blowups, orphaned blobs, wrong access, expensive retries
2. Blast radius: user, trip, or org storage footprint
3. Why risky: client-only blob URLs and partial storage implementation
4. Governing rule: all durable media goes through metadata-backed storage with cleanup and auth

### 7. Event Trips and Hot Participation Modes
Severity: High

1. Failure shape: hot-room fanout, unread collapse, moderation failure, noisy channels
2. Blast radius: whole event
3. Why risky: event-scale controls are only suggested by UI
4. Governing rule: event mode, channel mode, and participant caps must be explicit platform controls

### 8. Account Deletion
Severity: Medium-High

1. Failure shape: broken attribution, orphaned memberships, dangling shared content
2. Blast radius: user-private and shared history
3. Why risky: no lifecycle implementation exists yet
4. Governing rule: account deletion must separate private-data deletion from shared-history preservation

## 12. Recommended Immediate Platform Changes
Highest-leverage changes to make now, before feature-specific hardening:

1. Create the canonical backend domain model for users, organizations, trips, trip variants, memberships, invites, channels, messages, attachments, audit logs, and usage counters.
2. Replace mock auth and mock subscription hooks with real session and entitlement loading.
3. Consolidate authorization into server-side membership/capability enforcement.
4. Standardize a mutation envelope with request IDs, mutation IDs, idempotency keys, actor attribution, and expected versions.
5. Build one invite/share/join service with canonical routes and transactional redemption.
6. Standardize object scopes: private, trip-shared, channel-scoped, event-wide, admin-only, ephemeral.
7. Introduce a shared attachment/media model with storage keys, metadata rows, and cleanup jobs.
8. Define and implement the channel model before adding more messaging variants.
9. Harden all edge functions immediately: JWT validation, origin restrictions, rate limits, and removal of client-trusted `user_id`.
10. Introduce structured logging, request correlation, error tracking, and feature flags before enabling more shared-state features.
11. Remove hardcoded secrets and environment assumptions from the client.
12. Stop hiding backend failures behind mock success responses in production paths.

## 13. Exact Platform Changes
### Code Areas To Modify
Identity and entitlements:

1. `src/hooks/useAuth.tsx`
2. `src/hooks/useConsumerSubscription.tsx`
3. `src/components/AuthModal.tsx`
4. `src/components/settings/*`

Core route/data loading:

1. `src/pages/Index.tsx`
2. `src/pages/TripDetail.tsx`
3. `src/pages/ProTripDetail.tsx`
4. `src/pages/EventDetail.tsx`
5. `src/App.tsx`

Shared collaboration surfaces:

1. `src/hooks/useMessages.ts`
2. `src/components/TripChat.tsx`
3. `src/components/MessageInbox.tsx`
4. `src/components/TripTabs.tsx`
5. `src/components/CollaborativeItineraryCalendar.tsx`
6. `src/components/poll/*`
7. `src/components/PlacesSection.tsx`
8. `src/components/BasecampSelector.tsx`
9. `src/components/AddLinkModal.tsx`
10. `src/components/TripSettings.tsx`
11. `src/components/TripUserManagement.tsx`

Media and storage:

1. `src/components/PhotoAlbum.tsx`
2. `src/components/FilesTab.tsx`
3. `src/components/receipts/*`
4. `src/types/receipts.ts`

AI and search:

1. `src/services/openAI.ts`
2. `src/services/aiFeatures.ts`
3. `src/hooks/useAiFeatures.ts`
4. `src/components/GeminiAIChat.tsx`
5. `src/components/UniversalTripAI.tsx`
6. `src/components/chat/geminiService.ts`
7. `src/hooks/useTripSearch.ts`
8. `src/hooks/useGlobalSearch.ts`

Edge functions and migrations:

1. `supabase/functions/gemini-chat/index.ts`
2. `supabase/functions/search/index.ts`
3. `supabase/functions/ai-features/index.ts`
4. `supabase/functions/generate-audio-summary/index.ts`
5. `supabase/migrations/*`

Operational cleanup:

1. `vite.config.ts`
2. `src/utils/distanceCalculator.ts`
3. `.github/workflows/ci.yml`

### Schema, Index, and Policy Changes
Add foundational tables:

1. `accounts`
2. `organizations`
3. `organization_members`
4. `trips`
5. `trip_variants`
6. `trip_memberships`
7. `channels`
8. `channel_memberships`
9. `invites`
10. `share_links`
11. `messages`
12. `message_reads`
13. `broadcasts`
14. `attachments`
15. `attachment_comments`
16. `tasks`
17. `task_assignees`
18. `polls`
19. `poll_options`
20. `poll_votes`
21. `calendar_entries`
22. `places`
23. `basecamps`
24. `audit_log`
25. `idempotency_keys`
26. `usage_counters`

Required indexes and constraints:

1. Unique `(scope_id, user_id)` on memberships
2. Unique `(invite_id, user_id)` on invite redemptions or membership creation path
3. Unique `(poll_id, user_id)` on votes
4. Unique `(session_id, user_id)` on RSVPs
5. Sequence indexes on message/event tables
6. TTL/cleanup indexing for ephemeral or pending-job tables

Required policies:

1. Membership-join RLS for trip/event/channel reads
2. Role/capability checks on writes
3. Storage object policies tied to metadata rows rather than path conventions alone
4. Remove client write access to quota rows

### Env, Secret, and Infra Changes
Introduce or formalize:

1. `APP_BASE_URL`
2. `ALLOWED_WEB_ORIGINS`
3. `SUPABASE_URL`
4. `SUPABASE_ANON_KEY`
5. `SUPABASE_SERVICE_ROLE_KEY`
6. `OPENAI_API_KEY`
7. `GEMINI_API_KEY`
8. `ELEVENLABS_API_KEY`
9. `GOOGLE_MAPS_API_KEY` moved out of source
10. Rate-limit backing store or service
11. Background job infrastructure for media/AI

### Account Lifecycle Safety Changes
Required lifecycle implementation changes:

1. Replace mock session/auth with real signup, login, logout, session refresh, reset-password, and password-change flows.
2. Introduce account-state handling for `active`, `pending_verification`, `suspended`, and `deleted`.
3. Add account deletion workflow that:
   1. Revokes sessions
   2. Cancels pending invites owned by the user where required
   3. Removes or anonymizes private data
   4. Preserves shared content attribution in an immutable form
   5. Reassigns or blocks orphaned ownership-sensitive objects
4. Add policy for membership cleanup vs attribution retention after deletion.

### Service Boundaries To Introduce Or Clean Up
1. Identity and entitlements service
2. Access/invite/share service
3. Shared mutation service or command layer
4. Messaging and unread service
5. Media/attachment service
6. AI orchestration service
7. Search/indexing service

### Migration Order
1. Add principals, orgs, trips, memberships, and audit tables
2. Add invites/share links and redemption path
3. Add messages, reads, channels, and broadcasts
4. Add attachments and media metadata
5. Add shared planning objects
6. Add idempotency and usage counters
7. Migrate AI/audio/search endpoints onto the new auth and scope model

### Deployment Order
1. Deploy additive schema first
2. Deploy backend authorization paths behind feature flags
3. Switch auth/session loading in the client
4. Switch invite/share/join routing
5. Switch messaging and shared object surfaces
6. Switch media/storage surfaces
7. Switch AI/search endpoints last after auth, quotas, and logging are in place

### Rollback Plan
1. Use additive migrations first; avoid destructive schema changes until traffic proves stable
2. Keep old UI paths behind flags until new backend reads are verified
3. Make every new risky feature kill-switchable
4. Roll back by disabling flags and redeploying previous frontend artifact while preserving additive schema
5. For edge endpoints, preserve prior versions or route aliases until new endpoints are validated

## 14. Verification + Load Plan
### Contract Tests
1. Authenticated route contracts for trips, events, channels, invites, attachments, AI, and search
2. Edge-function request/response and auth contracts
3. Storage metadata and signed-URL issuance contracts

### Permission Tests
1. Role-based create/update/delete across trip/event/channel objects
2. Read-only mode enforcement
3. Channel posting restrictions
4. Admin-only operations
5. Private vs shared scope isolation

### Concurrency Tests
1. Duplicate invite redemption
2. Duplicate membership joins
3. Multi-user concurrent edits to tasks/calendar/basecamp/places/links
4. Same poll vote from retries
5. AI plus manual concurrent updates to the same shared object
6. Storage-processing retries for attachments/audio

### Realtime Tests
1. Reconnect and backfill from last sequence
2. Background/foreground state recovery
3. Multi-device read-pointer sync
4. Hot room and hot event subscription behavior
5. Subscription cleanup on route changes

### Funnel and Access Tests
1. Mass invite issuance
2. Mass join spikes
3. Invalid/expired/revoked token handling
4. Wrong-object route prevention
5. Signup during invite acceptance

### Media Stress Tests
1. Concurrent upload batches
2. Partial upload failure
3. Storage-orphan cleanup
4. Signed URL expiry and refresh
5. Event-scale attachment browsing

### Account Lifecycle Tests
1. Signup spike
2. Login spike
3. Session refresh
4. Password reset/change
5. Account deletion and shared-history handling

### Multi-User And Hot-Event Tests
1. 10-user shared-trip mutation storm
2. 100-user event with announcement-only mode
3. 1,000-user event with broadcast fanout and unread updates

### Free vs Paid QoS Tests
1. Free-tier burst while paid organizer traffic is active
2. Queue priority correctness
3. Provider budget and rate-limit trip points

### Local Reproducibility Steps
1. Run `npm ci`
2. Run `npm run lint`
3. Run `npx tsc --noEmit -p tsconfig.app.json`
4. Run `npm run test -- --run`
5. Run `npm run dev`
6. After backend work exists, run local Supabase stack and seeded fixtures
7. Reproduce multi-user flows with multiple browsers/sessions and scripted concurrent requests

### Observability Foundation Verification
Required telemetry fields on every request or mutation:

1. `request_id`
2. `mutation_id` where applicable
3. `actor_user_id`
4. `actor_type`
5. `plan_tier`
6. `trip_id` or `event_id`
7. `channel_id` where applicable
8. `route_name`
9. `status_code`
10. `latency_ms`

Required counters and dashboards:

1. Auth signup/login/reset failures
2. Invite creation and redemption outcomes
3. Membership creation conflicts
4. Mutation conflicts and OCC rejects
5. Duplicate suppression hits
6. Realtime reconnect and catch-up latency
7. Upload failures and orphan cleanup actions
8. AI request count, cost, throttles, and failures
9. Degraded-mode activations by feature

### Staging Reproducibility Steps
1. Use seeded org/trip/event fixtures
2. Run synthetic invite, join, AI, upload, and realtime checks on every deploy
3. Replay concurrency and hot-event scenarios before enabling public traffic

### Synthetic Load Plan
1. k6 or equivalent for invite redemption, auth, AI, and upload endpoints
2. Worker-queue load tests for audio/media jobs
3. Realtime subscription fanout tests for hot event channels

### Success Criteria
1. No unauthorized cross-scope reads or writes in permission tests
2. No duplicate memberships or duplicate expensive jobs under retries
3. Realtime reconnects recover without unread drift
4. Paid organizer operations remain within SLO under free-tier bursts
5. Invite and join success paths are deterministic and measurable

### Rollout Guardrails
1. Feature flags on all new backend-backed shared surfaces
2. Canary rollout for AI/media/storage changes
3. Automatic rollback criteria on auth, invite, and AI error-rate regressions

## 15. Platform Scorecard
### Domain model coherence: 42/100
Blocked from 95 because:

1. Consumer, pro, and event entities are modeled differently and inconsistently
2. Multiple duplicate/overlapping types exist
3. Domain truth is mostly not server-backed

### Scope/ownership clarity: 35/100
Blocked from 95 because:

1. Shared vs private scope is not explicit for most objects
2. Trip/channel/event/admin scopes are not canonicalized
3. Ownership is often implied by UI context only

### Authorization model: 28/100
Blocked from 95 because:

1. Permissions are largely client-side
2. Core shared surfaces lack server-side enforcement
3. Edge functions lack consistent JWT and capability checks

### Shared-write safety: 22/100
Blocked from 95 because:

1. Shared mutations are mostly local-only or unmodeled
2. No versioning/OCC contract exists
3. No append-only or transactional standard exists for collaboration

### Idempotency/deduplication: 18/100
Blocked from 95 because:

1. No standard idempotency envelope exists
2. Current expensive edge paths do not dedupe work
3. Duplicate join/vote/upload semantics are unimplemented

### Realtime architecture: 12/100
Blocked from 95 because:

1. There is no real realtime layer in the SPA
2. No unread/read-pointer truth exists
3. No reconnect/backfill contract exists

### Invite/share/join safety: 10/100
Blocked from 95 because:

1. Invite token is static
2. Join route is missing
3. No server-side redemption or membership truth path exists

### Media/storage robustness: 24/100
Blocked from 95 because:

1. Most media is local-only blob/data URL state
2. Storage metadata and cleanup are not generalized
3. Authenticated access patterns are incomplete

### AI cross-surface mutation safety: 20/100
Blocked from 95 because:

1. Edge auth is inconsistent
2. `user_id` trust and SSRF-style URL fetching are unsafe
3. AI execution and client paths are fragmented

### Plan-aware traffic shaping: 16/100
Blocked from 95 because:

1. Consumer Plus is hardcoded
2. Tier limits are not enforced server-side
3. No queue priority or reserved capacity exists

### Observability: 18/100
Blocked from 95 because:

1. No metrics, traces, dashboards, or alerts are defined in-repo
2. Logging is ad hoc
3. No request correlation or cost attribution exists

### Rollback readiness: 30/100
Blocked from 95 because:

1. No feature flags or kill switches exist
2. No canary pattern is encoded
3. `/api` routing and backend deployment boundaries are unclear

### Production readiness: 20/100
Blocked from 95 because:

1. Core auth, access, shared state, realtime, and invite semantics are not production-implemented
2. Edge security and QoS are incomplete
3. Multi-user collaboration would rely on timing luck rather than enforceable contracts

## Recommended Follow-Up Prompt Sequence
If the team wants this constitution turned into staged execution work, the highest-value follow-up prompt order is:

1. Core domain schema, memberships, invites, and RLS
2. Auth/session lifecycle and entitlement integration
3. Shared mutation contract and audit log implementation
4. Invite/share/join funnel implementation
5. Messaging/channels/unread/realtime foundation
6. Media/attachments/storage architecture
7. Shared planning objects hardening: tasks, polls, calendar, basecamp, places
8. AI orchestration hardening and cost controls
9. Event-scale mode and moderation architecture
10. Observability, feature flags, canary rollout, and load testing foundation
