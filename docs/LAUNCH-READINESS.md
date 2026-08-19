# Phase 3 Launch Readiness

**Status:** Technical launch complete; owner content and accessibility follow-up pending

This checklist is the release gate for the public OCSCO website before the full staging implementation is promoted to `main`.

## Engineering checks completed

- `npm run lint` passes.
- `npm run build` passes.
- All implemented public routes return HTTP 200 in the built application, including `/style-guide`.
- Supplied brand assets and favicon paths return HTTP 200.
- Invalid inquiry payloads return HTTP 400.
- The inquiry honeypot returns HTTP 201 without creating a normal inquiry.
- The staging contact workflow has been tested end-to-end by the owner: Supabase record creation and Resend notification both succeeded.
- The reviewed contact workflow is now merged into `main` in commit `1dc5c54`.
- The owner has configured separate Production Supabase and Resend resources in Vercel; values are intentionally not stored in the repository.
- The owner confirmed a controlled Production submission, database row, and email notification.
- `ocsco.io` and `www.ocsco.io` now resolve to the Vercel Production deployment.

## Owner review still required

- Approve final homepage and route copy; current messaging is still draft content.
- Supply approved case-study facts, outcomes, testimonials, team details, and portfolio media.
- Confirm whether the labeled Work placeholder is acceptable until approved project material is available.
- Approve contact-form field language, privacy/consent copy, response-time expectation, and inquiry owner.
- Complete desktop, mobile, keyboard, focus, and screen-reader review across all public routes.

## Production configuration gate

Do not reuse staging credentials in Production. Before promoting the full contact workflow:

- [x] Select the separate clean Production Supabase project.
- [x] Apply and verify the `public.inquiries` schema, RLS, and least-privilege server access in Production.
- [x] Apply `supabase/migrations/20260819000000_create_inquiries.sql` to the selected Production Supabase project.
- [x] Add Production Vercel variables for Supabase and Resend; values remain outside the repository.
- [x] Verify the `send.ocsco.io` Resend sending domain.
- [x] Run one controlled Production submission and confirm both the database record and owner notification.
- [x] Confirm the production deployment responds without configuration or notification errors.

## Release sequence

1. Owner reviews and approves the remaining content and accessibility items.
2. Production Supabase and Resend configuration is created and tested separately. **Complete.**
3. The full reviewed staging branch is promoted to `main`. **Complete in `1dc5c54`.**
4. Vercel Production redeploys with Production variables. **Complete.**
5. A controlled Production smoke test verifies routes, CTA navigation, contact submission, database storage, and email notification. **Complete.**
6. DNS is switched from WordPress to Vercel after the controlled test passes. **Complete.**

Phase 3 is complete when the owner review and Production configuration gates are closed. The next major platform phase is the custom CMS foundation; CMS and CRM work should not begin before this release gate is approved.
