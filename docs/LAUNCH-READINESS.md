# Phase 3 Launch Readiness

**Status:** In progress

This checklist is the release gate for the public OCSCO website before the full staging implementation is promoted to `main`.

## Engineering checks completed

- `npm run lint` passes.
- `npm run build` passes.
- All public routes return HTTP 200 in the built application, including `/design-style-guide`.
- Supplied brand assets and favicon paths return HTTP 200.
- Invalid inquiry payloads return HTTP 400.
- The inquiry honeypot returns HTTP 201 without creating a normal inquiry.
- The staging contact workflow has been tested end-to-end by the owner: Supabase record creation and Resend notification both succeeded.
- Production currently contains only the CTA routing update; the contact workflow remains isolated in staging.

## Owner review still required

- Approve final homepage and route copy; current messaging is still draft content.
- Supply approved case-study facts, outcomes, testimonials, team details, and portfolio media.
- Confirm whether the labeled Work placeholder is acceptable until approved project material is available.
- Approve contact-form field language, privacy/consent copy, response-time expectation, and inquiry owner.
- Complete desktop, mobile, keyboard, focus, and screen-reader review across all public routes.

## Production configuration gate

Do not reuse staging credentials in Production. Before promoting the full contact workflow:

- Create or select the separate Production Supabase project.
- Apply and verify the `public.inquiries` schema, RLS, and least-privilege server access in Production.
- Apply `supabase/migrations/20260819000000_create_inquiries.sql` to the selected Production Supabase project and verify the resulting policies and grants.
- Add Production Vercel variables for Supabase and Resend; never commit them.
- Use a Resend sending key and a verified OCSCO sender domain for Production.
- Run one controlled Production submission and confirm both the database record and owner notification.
- Confirm the production deployment logs show no configuration or notification errors.

## Release sequence

1. Owner reviews and approves the remaining content and accessibility items in staging.
2. Production Supabase and Resend configuration is created and tested separately.
3. The full reviewed staging branch is promoted to `main`.
4. Vercel Production is redeployed with Production variables.
5. A final smoke test verifies routes, CTA navigation, contact submission, database storage, and email notification.

Phase 3 is complete when the owner review and Production configuration gates are closed. The next major platform phase is the custom CMS foundation; CMS and CRM work should not begin before this release gate is approved.
