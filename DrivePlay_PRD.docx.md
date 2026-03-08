  
**DrivePlay**

Google Drive Video Player

| Product Requirements Document MVP — Own It Internal Tool |
| :---: |

| Version | 1.0 — MVP |
| :---- | :---- |
| **Author** | Josue |
| **Organization** | Own It |
| **Status** | Draft — In Review |
| **Last Updated** | March 6, 2026 |
| **Target Users** | Own It Content Team (2–5 users) |

# **1\. Overview**

## **1.1 Problem Statement**

| The Core Pain Own It stores 8TB+ of video content on Google Drive. Files ranging from hundreds of MBs to multiple GBs cannot be previewed in Drive's native player — it either fails to load, shows a 'still processing' error, or produces degraded quality. This forces the content team to download files just to check if the content is what they need, creating significant friction in their daily workflow. |
| :---- |

This is not a minor inconvenience. The content team performs three types of video work that are all blocked by this problem:

* Discovery — searching for the right clip or footage from a large library

* Review — evaluating raw footage or cuts for quality and content

* Approval — confirming final cuts before use

## **1.2 Proposed Solution**

DrivePlay is a lightweight web application that integrates directly into Google Drive via the 'Open With' mechanism. When a team member right-clicks any video file in Drive and selects 'Open with DrivePlay,' the video plays immediately — no downloading, no processing errors, no quality degradation.

| How It Works A Node.js proxy backend receives the file ID from Google Drive, attaches OAuth credentials, and streams the raw video file directly to a web-based player using HTTP Range headers. The player receives only the bytes it needs for the current buffer, enabling instant playback of files of any size. |
| :---- |

## **1.3 Goals & Non-Goals**

**Goals (MVP)**

* Enable instant video preview of any Drive-hosted video file regardless of size

* Integrate natively into Google Drive via 'Open With' — no workflow change for the team

* Support MP4 and MOV formats (MKV deferred — not natively supported by Chrome's video element)

* Work reliably for 2–5 concurrent users on desktop Chrome

* Build on a foundation that supports Phase 2 content ops features

**Non-Goals (MVP)**

* Mobile support — deferred to V1.5

* Timestamp comments or approval workflows — deferred to V1.5

* External user access or sharing — internal team only

* Video editing, transcoding, or format conversion

* Multi-tenant / other company support — comes after Own It validation

# **2\. User Context**

## **2.1 Target Users**

MVP is scoped entirely to the Own It content team. This is intentional — using Own It as the design partner allows us to validate the core experience before scaling.

| Team Size | 2–5 content team members |
| :---- | :---- |
| **Storage** | 8TB+ of video files on Google Drive |
| **File Sizes** | Hundreds of MBs to multiple GBs per file |
| **Primary Device** | Desktop (Chrome browser) |
| **Drive Setup** | Google Workspace (Shared Drives) |
| **Admin Access** | Yes — Workspace admin available for forced installation |

## **2.2 User Journey (MVP)**

**Primary Flow: Preview a video file**

* User opens Google Drive in Chrome and navigates to a video file

* User right-clicks the file and selects 'Open with DrivePlay'

* DrivePlay opens in a new tab — video begins loading immediately

* User scrubs, pauses, and seeks through the video without downloading

* User closes the tab and returns to Drive

| Key Insight The entire value of MVP lives in steps 3 and 4\. If the video plays in under 5 seconds and seeking works without freezing, the product has succeeded. Everything else is secondary. |
| :---- |

## **2.3 Pain Points Addressed**

| 'Still Processing' error | Bypassed entirely — DrivePlay streams raw file, not Drive's transcoded version |
| :---- | :---- |
| **Large file download** | Eliminated — Range header streaming means no full download required |
| **Quality degradation** | Resolved — raw file is streamed, not re-encoded by Drive |
| **Workflow disruption** | 'Open With' keeps team inside Drive — no new tool to learn |

# **3\. Technical Architecture**

## **3.1 Stack**

| Backend | Node.js \+ Express — optimal for I/O-heavy streaming operations |
| :---- | :---- |
| **Frontend** | HTML/CSS/JS \+ Plyr.js — lightweight, clean video player with seeking support |
| **Auth** | Google Service Account + Domain-Wide Delegation — scoped to drive.readonly. No user-facing login required. |
| **Drive Integration** | Google Drive API v3 — files.get with alt=media for raw binary |
| **Hosting** | Render.com — free tier, persistent servers (critical for streaming), simple deploys |
| **Domain/SSL** | Required for Google 'Open With' integration (HTTPS only) |

## **3.2 Architecture Overview**

**The Proxy Pattern**

The core architectural decision is a backend proxy. The video player never communicates directly with Google Drive — all requests go through the Express server, which attaches the OAuth Bearer Token and forwards Range requests to the Drive API.

| Why a Proxy is Non-Negotiable Direct browser-to-Drive requests fail due to CORS restrictions. The proxy also handles OAuth token management server-side, keeping credentials secure and enabling the team to share a single OAuth session rather than each member authenticating individually. |
| :---- |

**Request Flow**

* User clicks 'Open with DrivePlay' in Google Drive

* Google sends a GET request to DrivePlay with a state parameter containing the file ID

* DrivePlay backend parses the state, extracts the file ID

* Frontend player initiates Range requests to the DrivePlay proxy endpoint

* Proxy attaches OAuth token and forwards Range request to Drive API (alt=media)

* Drive returns the requested byte range — proxy pipes it back to the player

* Player renders the video chunk and requests the next range as needed

## **3.3 Key Technical Decisions**

| Range Headers | HTTP 206 Partial Content — player requests only the bytes needed for current buffer. Enables seeking on files of any size without full download. |
| :---- | :---- |
| **OAuth Scope** | drive.readonly — minimum required scope. Never request more permissions than needed. |
| **Token Storage** | No user sessions needed — service account key stored as server environment variable. No per-user token management. |
| **Error Handling** | Exponential backoff on Drive API rate limit errors (429). Graceful fallback message if quota exceeded. |
| **MIME Type Detection** | Detected server-side from Drive file metadata, passed to player for correct codec handling. |

# **4\. Google Drive Integration**

## **4.1 'Open With' Setup**

The Drive SDK integration is what makes DrivePlay feel native rather than a separate tool. Configuration happens in Google Cloud Console and Google Workspace Admin.

| Step 1 | Enable Google Drive API and Google Drive SDK in Google Cloud Console |
| :---- | :---- |
| **Step 2** | Configure 'Drive UI Integration' tab — set Open URL to the DrivePlay hosted domain |
| **Step 3** | Add supported MIME types: video/mp4, video/quicktime, video/x-matroska, video/\* |
| **Step 4** | Force-install for Own It team via Google Workspace Admin Console |
| **Step 5** | Test with a single user before rolling out to full content team |

## **4.2 State Parameter Handling**

When Google redirects to DrivePlay, it appends a state parameter containing the file ID(s) and user ID. The backend must parse this before rendering the player.

| State Parameter Format Google sends: { "ids": \["\<file\_id\>"\], "userId": "\<google\_user\_id\>", "action": "open" }. The backend extracts ids\[0\], fetches file metadata (name, MIME type, size), then returns the player page with the file ID embedded. |
| :---- |

## **4.3 Permissions & Workspace Admin**

| Admin Requirement Force-installing DrivePlay for the team requires Google Workspace Admin access. This has been confirmed as available. Domain-Wide Delegation is configured with a service account to access files in Shared Drives. All API calls must include `supportsAllDrives=true` and `includeItemsFromAllDrives=true`. |
| :---- |

# **5\. Feature Scope**

## **5.1 Feature Matrix**

| Feature | Description | Phase |
| :---- | :---- | ----- |
| **Drive 'Open With'** | Right-click any video in Drive → open in DrivePlay | **MVP** |
| **Range Streaming** | HTTP 206 partial content — no full file download | **MVP** |
| **Video Playback** | Play, pause, seek, volume, fullscreen | **MVP** |
| **Large File Support** | Files of any size — tested up to multi-GB | **MVP** |
| **Format Support** | MP4, MOV (MKV deferred — Chrome cannot natively decode it) | **MVP** |
| **OAuth Auth** | Service Account + Domain-Wide Delegation, scoped to drive.readonly. No user login required. | **MVP** |
| **Workspace Install** | Force-installed for Own It team via Workspace Admin | **MVP** |
| **File Metadata** | Display filename and file size in player UI | **MVP** |
| **Timestamp Notes** | Leave time-coded comments on specific moments | **V1.5** |
| **Approval Status** | Tag files as Unreviewed / Approved / Rejected | **V1.5** |
| **Folder Browser** | Browse Drive folders from within DrivePlay | **V1.5** |
| **Mobile Support** | iOS/Android compatibility | **V1.5** |
| **Multi-Tenant** | Other companies use DrivePlay (SaaS model) | **Deferred** |
| **Billing Layer** | Subscription management for external users | **Deferred** |
| **HLS/DASH Streaming** | Adaptive bitrate streaming | **Deferred** |

# **6\. Risks & Mitigations**

| 750GB Daily Limit | Google Drive enforces a 750GB/day download limit per account. Risk: content team exceeds this during heavy review days.Mitigation: Monitor usage. With 2–5 users streaming (not downloading) via Range requests, this limit is unlikely to be hit. Re-evaluate if team scales. |
| :---- | :---- |
| **API Rate Limiting** | Google Drive API caps requests per minute. A video player makes many Range requests per stream.Mitigation: Implement exponential backoff. Buffer sizes tuned to minimize request frequency. Free tier quota is sufficient for 2–5 users. |
| **Shared Drive Permissions** | Files in Shared Drives require Domain-Wide Delegation or explicit service account access.Mitigation: Configure Domain-Wide Delegation during Workspace Admin setup. Test with Shared Drive files before team rollout. |
| **Render Free Tier Limits** | Render's free tier spins down servers after inactivity (15-min timeout).Mitigation: Acceptable for MVP — first request after idle will have \~30s cold start. Upgrade to paid tier ($7/mo) if this becomes a team complaint. |
| **CORS & Browser Security** | Direct browser requests to Google Drive are blocked by CORS.Mitigation: Already handled by the proxy architecture. All Drive requests route through the Express backend. |
| **Mobile 'Open With' Flakiness** | Google Drive mobile app does not reliably support 'Open With' integrations.Mitigation: Scoped out of MVP. Desktop Chrome only. Mobile addressed in V1.5. |

# **7\. Success Metrics**

## **7.1 MVP Success Criteria**

| Definition of Done for MVP A content team member can right-click a video file of any size in Google Drive, select 'Open with DrivePlay,' and have the video playing within 5 seconds — without downloading the file, without quality degradation, and without a 'still processing' error. |
| :---- |

| Time to First Frame | Video begins playing within 5 seconds of opening DrivePlay |
| :---- | :---- |
| **Seek Performance** | Seeking to any point in the video completes within 3 seconds |
| **Error Rate** | Zero 'still processing' or load failure errors on supported formats |
| **Team Adoption** | All 2–5 content team members using DrivePlay as primary preview tool within 2 weeks of launch |
| **Download Elimination** | Content team no longer downloads files purely to preview content |

## **7.2 V1.5 Validation Signals**

Before building Phase 2 content ops features, validate these signals from the Own It team:

* Team is actively requesting timestamp/comment functionality

* At least 3 team members use DrivePlay daily for more than 2 weeks

* At least one other company expresses interest in using the tool

# **8\. Build Plan**

## **8.1 Phase 1 — MVP (Weeks 1–3)**

| Week 1 | Google Cloud setup, OAuth configuration, Drive API integration, basic proxy endpoint with Range header support |
| :---- | :---- |
| **Week 2** | Frontend player (Plyr.js), 'Open With' Drive SDK configuration, Workspace Admin forced installation |
| **Week 3** | Testing with real large files, edge case handling (rate limits, Shared Drives), team rollout |

## **8.2 Phase 2 — Content Ops Layer (V1.5)**

Phase 2 is not scoped until Phase 1 is validated. Tentative features based on anticipated team needs:

* Timestamp-based comments (leave notes at specific moments in a video)

* File status tags (Unreviewed / In Review / Approved / Rejected)

* Folder browser within the DrivePlay interface

* Mobile compatibility

## **8.3 Future — SaaS Expansion**

| Scale Decision Gate SaaS expansion (multi-tenant, billing, external users) is only pursued if: (1) Own It team uses DrivePlay daily for 30+ days, AND (2) at least 3 external teams express willingness to pay. Do not build multi-tenant infrastructure speculatively. |
| :---- |

# **9\. Open Questions**

| OQ-1 | ~~What video formats does the Own It content team actually use day-to-day?~~ **RESOLVED:** MP4 and MOV. MKV deferred. |
| :---- | :---- |
| **OQ-2** | ~~Are Own It videos stored in My Drive or Shared Drives?~~ **RESOLVED:** Shared Drives. Domain-Wide Delegation with service account confirmed. |
| **OQ-3** | What is the typical concurrent usage pattern? (How many team members likely previewing videos at the same time?) |
| **OQ-4** | Is there a preferred app name other than 'DrivePlay'? |
| **OQ-5** | Does the content team need to preview audio-only files as well, or strictly video? |

