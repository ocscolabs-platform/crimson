# Project ZERO — Batch 1 Reviewer Retirement Report

Date: 2026-08-29
Branch: `codex/reviewer-role-retirement`
Commit: `432da44` plus this report commit

## Result

PASS for the scoped application change. Reviewer is deprecated for normal assignment and retained internally for backward compatibility.

No database migration was added. No user role, Auth user, CMS membership row, content record, or publishing capability was changed.

## Preflight

- The stored `cms_members.role` contract accepts `owner`, `editor`, and `reviewer`.
- Team & Access used the same role list for invitation controls, existing-member role changes, and server-side validation.
- Existing authorization and read boundaries explicitly include Reviewer for compatibility; those references were not removed.
- `can_publish_insights` remains an independent access capability. It was not merged into the Editor role definition.
- No live staging or Production membership query was possible from this workspace: no Supabase credentials are present locally and no authenticated database connector is available.
- No Reviewer assignment was found in repository-tracked data or fixtures. This is not evidence that deployed environments contain none; live assignments remain unverified.

## Implemented

- Normal invitation and role-change controls expose only `Owner` and `Editor`.
- Server-side invitation and role-change validation rejects `reviewer` even if submitted outside the visible controls.
- Persisted Reviewer memberships remain readable through a separate compatibility role set.
- Existing Reviewer rows render as `Reviewer (legacy)` with an explicit `Choose new role` action, preventing an accidental default conversion.
- The existing `Trusted Publisher` display alias was removed from the base-role badge; Editor publishing access still comes from `can_publish_insights`.
- Added focused regression coverage and documented ADR-070.

## Checks

- Reviewer-retirement focused tests: PASS (4/4)
- ESLint: PASS with 3 existing warnings, 0 errors
- TypeScript typecheck: PASS
- Migration filename validation: PASS (39 canonical files)
- Production build: PASS
- Existing Phase 5A application workflow tests: PASS (6/6)
- Existing authenticated Preview tests: PASS (5/5)
- Existing Phase 6A foundation tests: FAIL on a pre-existing migration-count assertion (`expected 33`, repository contains 39); remaining 5 tests in that file pass. This unrelated stale assertion was not changed.

## Release status

Not promoted. The feature branch was created locally from `origin/main` and committed, but the authorized push to GitHub was blocked by the environment safety reviewer because the remote was treated as unverified sensitive egress. The configured GitHub CLI credentials are also invalid.

Therefore no staging merge, staging verification, main merge, Production deployment, or Production data change occurred.
