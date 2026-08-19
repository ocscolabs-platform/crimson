# Deployment Model

## Intended branch and environment flow

```text
feature/* → Vercel preview deployment
staging   → staging environment
main      → production environment
```

Feature branches should be used for active development and review. The `staging` branch is the integration and review point before production. The `main` branch represents production and should not be used as an experimentation branch.

## Current deployment

The `main` branch is connected to Vercel and the production deployment is publicly available at [ocsco-project-crimson.vercel.app](https://ocsco-project-crimson.vercel.app/). The `ocsco.io` and `www.ocsco.io` domains are assigned to the Vercel Production environment, and the website DNS now points to Vercel. WordPress email records remain in place.

## Environment separation

Preview/Staging and Production must eventually use separate environment configurations. Production secrets must not be shared indiscriminately with preview or staging deployments. Supabase projects, keys, storage policies, authentication settings, and other external resources should be selected explicitly for the environment being deployed.

The repository intentionally does not contain account IDs, deployment URLs, domains, credentials, or environment values. Human owners will need to supply those values through GitHub/Vercel/Supabase configuration when the integrations are approved.

## Remaining owner configuration

- Configure GitHub branch protection for `feature/*`, `staging`, and `main`.
- Keep Preview/Staging and Production variables separate and rotate keys independently.
- Keep WordPress hosting available during the short rollback window, then cancel it after final owner confirmation.

Vercel authorization was completed after the foundation was approved. The owner has configured separate Production Supabase and Resend resources in Vercel, completed a controlled submission, and switched the website DNS to Vercel.

## Staging contact-form configuration

The staging `/contact` form writes validated submissions to the `public.inquiries` table in the dedicated `crimson-staging` Supabase project through the server-side `/api/inquiries` route. Configure these variables in Vercel for the Preview environment only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` — server-only; never expose this in client code or commit it
- `RESEND_API_KEY` — server-only; use a sending-only key where available
- `INQUIRY_NOTIFICATION_EMAIL` — owner inbox for new inquiry notifications
- `INQUIRY_NOTIFICATION_FROM` — verified sender, or `OCSCO inquiries <onboarding@resend.dev>` for the initial Resend account-owner test

Do not add these values to the repository. Production uses separate values from Preview/Staging.

## Production contact-form configuration

The Production `/contact` form uses the selected clean Production Supabase project and the verified `send.ocsco.io` Resend sending domain. The six required variables are configured in Vercel under Production only, and the owner has confirmed database storage and email delivery.
