# DrivePlay — Project Context

## What is DrivePlay?
A lightweight web app that integrates into Google Drive via "Open With" to stream video files of any size through a Node.js proxy. Built for Own It's content team (2-5 users) who manage 8TB+ of video on Google Drive.

## Architecture Decisions (Confirmed March 2026)

### Auth: Service Account + Domain-Wide Delegation
- Service account authenticates on behalf of all Workspace users automatically
- No user-facing login screen — click "Open With" and video plays
- Service account key stored as environment variable on the server
- Scoped to `drive.readonly`
- No session storage needed (no tokens to manage per-user)

### Formats: MP4 and MOV only
- MKV dropped from MVP (Chrome can't natively decode it)
- Browser `<video>` element handles MP4 (H.264) and MOV natively

### Drive Type: Shared Drives
- All Own It video content lives in Shared Drives
- Domain-Wide Delegation required to access Shared Drive files via service account
- Must include `supportsAllDrives=true` and `includeItemsFromAllDrives=true` on API calls

### State Parameter: Google "Open With" redirect
- Google sends URL-encoded `state` query param with JSON: `{"ids":["<file_id>"],"userId":"<id>","action":"open"}`
- Backend parses `ids[0]` to get the target file ID
- Handle single file only for MVP

### GCP Project: Created from scratch
- No existing Google Cloud project for Own It
- Need to set up: GCP project, OAuth consent screen, Drive API, Drive SDK, service account, Domain-Wide Delegation

## Tech Stack
| Layer | Choice |
|-------|--------|
| Backend | Node.js + Express |
| Frontend | HTML/CSS/JS + Plyr.js |
| Auth | Google Service Account + Domain-Wide Delegation |
| API | Google Drive API v3 (`files.get` with `alt=media`) |
| Hosting | Render.com |
| Streaming | HTTP 206 Range requests proxied through Express |

## Key Implementation Notes
- All Drive API requests go through the Express proxy (CORS prevents direct browser-to-Drive)
- Proxy pipes byte ranges — never buffers the full file
- MIME type detected from Drive file metadata, passed to the player
- Exponential backoff on 429 (rate limit) responses from Drive API
- `driveService.files.get()` calls must use `supportsAllDrives: true` for Shared Drive files

## MVP Scope
**In:** Drive "Open With", range streaming, video playback (play/pause/seek/volume/fullscreen), large file support, MP4/MOV, file metadata display, Workspace force-install
**Out:** Mobile, timestamp comments, approval workflows, folder browsing, MKV, multi-tenant, billing

## Success Criteria
- Video plays within 5 seconds of opening DrivePlay
- Seeking completes within 3 seconds
- Zero "still processing" errors
- All 2-5 team members adopt within 2 weeks

## Project Structure
```
DrivePlay/
  CLAUDE.md              # This file — project context
  DrivePlay_PRD.docx.md  # Product requirements document
  server/                # Express backend (proxy, auth, state parsing)
  public/                # Frontend (player UI, Plyr.js)
```
