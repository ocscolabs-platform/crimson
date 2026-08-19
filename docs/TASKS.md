# Staging Task Queue

This queue records approved next-step work before implementation. Tasks in this file are not production changes until they are implemented, reviewed in staging, and explicitly promoted to `main`.

## STG-001 — Add a contact form workflow after capability exploration

- **Status:** Promoted to `main`; controlled Production delivery test pending
- **Related experience:** Homepage `Explore the capabilities` CTA and `/services`
- **Goal:** Give visitors a clear path from reviewing OCSCO capabilities to starting a qualified conversation through the approved contact workflow.
- **UX rule:** Keep `Explore the capabilities` as a discovery link to `/services`. Do not turn it into a form-submission action. Add the form on `/contact` and/or introduce a contextual `Discuss this capability` action after a visitor has explored a capability.

### Acceptance criteria

- The form submits validated inquiries to `public.inquiries` and sends an owner notification through the environment-specific server-side provider; staging delivery is complete and Production delivery requires one controlled test.
- The final field list, required fields, privacy copy, validation, error state, success state, and confirmation behavior are approved.
- The form works with keyboard navigation, visible focus, readable labels, mobile layouts, and accessible error messaging.
- Capability context can be carried into the inquiry when a visitor arrives from a service or capability CTA.
- The form is tested in staging without adding credentials, tokens, or production integrations to the repository. **Complete for the current UI and server slice.**
- Production promotion is complete; DNS cutover remains gated on the controlled Production test.

### Dependencies

- Confirm whether submissions should use an approved email workflow first or a future Supabase-backed inquiry record.
- Confirm the response time expectation and who owns follow-up.
- Approve the contact form content and privacy/consent requirements.

## STG-002 — Close Phase 3 launch readiness

- **Status:** In progress — promotion and configuration complete; controlled Production test and DNS cutover pending
- **Goal:** Establish a repeatable release gate for promoting the reviewed public website and contact workflow to Production.
- **Reference:** `docs/LAUNCH-READINESS.md`

### Acceptance criteria

- All public routes, style-guide paths, supplied brand assets, and favicon paths pass smoke checks.
- Lint and production build pass from the staging branch.
- Owner approves final copy, proof placeholders, portfolio/team assets, form language, privacy/consent copy, and response ownership.
- Production Supabase and Resend resources are separate from staging and configured through Vercel only.
- A controlled Production smoke test verifies route navigation, inquiry storage, and owner notification.
