# Text Editor + Ayles Product Roadmap

Last updated: 2026-03-10 (includes R2 migration track)

## Goals
- Make text editing safe: users can always recover work and move back in time.
- Make restore UX obvious: timeline-style selection, preview, and low-risk restore.
- Keep editing fast while autosave is frequent.
- Align text editor roadmap with Ayles-wide platform quality and scale goals.

## Product Principles
- Recovery first: no destructive action without easy undo/restore.
- Fast feedback: every async action shows progress state immediately.
- Low-friction defaults: autosave + auto-revisions without user setup.
- Predictable history: clear naming, timestamps, and source (manual vs auto).

## Text Editor Roadmap

### Phase 1 (Now, 0-2 weeks) — Stable Revisions Foundation
- [x] Flush autosave before creating global canvas version (race fix).
- [x] Manual text snapshots per text node.
- [x] Restore from text snapshot.
- [x] Auto revisions on idle cadence with min time gap.
- [x] Version menu with timeline slider (oldest -> newest) and restore confirmation.
- [x] Outside-click close behavior for menus/composer.
- [x] Helper loading indicator for text actions.

Acceptance criteria:
- Saving a version never misses the latest text.
- Auto revisions appear without manual save when user edits over time.
- Restore operation updates editor and persisted node state.

### Phase 2 (Next, 2-6 weeks) — Professional Restore UX
- [ ] Side-by-side diff preview before restore.
- [ ] "Preview mode" scrub: temporary view while dragging slider, commit on confirm.
- [ ] Keyboard shortcuts for history navigation (`Cmd/Ctrl+[` and `Cmd/Ctrl+]`).
- [ ] Tagging and filtering: `manual`, `auto`, `agent`, `import`.
- [ ] Pin/lock important revisions.
- [ ] One-click duplicate as new document from any revision.

Acceptance criteria:
- User can inspect any revision with clear diff and no accidental overwrite.
- Restore intent is explicit and reversible.

### Phase 3 (Later, 6-10 weeks) — Collaboration & Policy
- [ ] Multi-user revision attribution (who changed what).
- [ ] Conflict-safe merge strategy for concurrent edits.
- [ ] Retention policies (e.g., keep every revision for 24h, then compact autos).
- [ ] Export/import of revision history.
- [ ] Audit log API for enterprise plans.

Acceptance criteria:
- Teams can collaborate with reliable history and controlled storage growth.

## Ayles Overall Roadmap

### Phase 1 (Now, 0-3 weeks) — Reliability Baseline
- [ ] Unified async status system (loading/success/error) across editor, media, and agent actions.
- [ ] Global toast/event stream for long-running actions.
- [ ] Error taxonomy and user-safe messaging.
- [ ] Observability baseline: client event logs + server timing for critical flows.
- [ ] Recovery QA checklist for regressions in overlay positioning and close behavior.
- [ ] Storage migration design: move all binary/object storage from Convex storage to Cloudflare R2 (security model, key paths, signed URL strategy, lifecycle policy).

### Phase 2 (Next, 3-8 weeks) — Workflow Depth
- [ ] Canvas history: cross-node timeline with jump-to-state.
- [ ] Agent memory controls: pin outputs to canvas with provenance.
- [ ] Media pipeline hardening: retries, cancelation, queue visibility.
- [ ] Consistent command palette for editor/canvas/agent actions.
- [ ] Project-level backups and restore checkpoints.
- [ ] Storage migration execution: dual-write to Convex + R2, backfill historical objects, and validate checksums.

### Phase 3 (Later, 8-16 weeks) — Scale & Enterprise Readiness
- [ ] Permissions model (viewer/editor/admin) per project.
- [ ] Activity feed + notifications.
- [ ] Performance targets for large canvases and long documents.
- [ ] Data lifecycle controls (retention, delete, export compliance).
- [ ] Admin analytics dashboard (adoption, success rate, recovery usage).
- [ ] Storage cutover: disable Convex storage writes, complete read path switch to R2, and decommission old buckets after retention window.

## Technical Workstreams

### 1) Data Model
- Keep using `versions` table for short term.
- Add explicit metadata fields (future): `scope`, `nodeId`, `source`, `actorId`, `isAuto`.
- Add revision compaction job for auto snapshots.

### 2) UX + Interaction
- Slider-based revision picker (implemented baseline).
- Add non-destructive preview + diff panel.
- Keep close behavior consistent across overlay components.

### 3) Performance
- Throttle auto-revision creation under high-frequency updates.
- Deduplicate identical HTML snapshots.
- Measure revision payload size and cap growth.

### 4) Quality
- Add tests:
  - Autosave flush before version creation.
  - Auto-revision timer behavior and minimum gap.
  - Restore correctness and menu state transitions.
  - Overlay positioning and outside-click close.

### 5) Storage & Infra (Convex Storage -> R2)
- Target state: Convex DB keeps metadata only; all file payloads live in Cloudflare R2.
- Build an object abstraction layer (single API for upload/get/delete/sign) so app code is storage-backend agnostic.
- Implement signed-upload + signed-download URLs through backend actions.
- Standardize object keys: `env/projectId/nodeId/contentType/yyyy/mm/<uuid>`.
- Add migration worker for historical object copy + checksum verification.
- Run dual-read fallback during transition (prefer R2, fallback to Convex if missing) with telemetry.
- Define cutover gates: 100% successful dual-write for 7 days, 0 checksum mismatches, 0 fallback reads for 72h.
- Finalize decommission plan: freeze old writes, archive for retention period, then delete.

## Metrics (Definition of Success)
- Revision restore success rate >= 99.5%.
- "Lost work" support incidents reduced by >= 80%.
- Median time to restore a prior version < 8 seconds.
- Auto-revision coverage: >= 95% of active editing sessions get at least one auto revision.
- P95 editor action latency (format/helper/menu) < 120ms.
- Storage migration integrity: 100% objects copied with checksum match.
- Storage migration reliability: fallback read rate < 0.1% before full cutover.

## Suggested Delivery Order (Concrete)
1. Ship Phase 1 text revision baseline to production.
2. Add diff preview + scrub preview behavior.
3. Add revision metadata schema and backfill path.
4. Build cross-canvas history and project restore checkpoints.
5. Execute storage migration (dual-write -> backfill -> cutover to R2 -> decommission Convex storage).
6. Add enterprise controls (permissions/audit/retention).
