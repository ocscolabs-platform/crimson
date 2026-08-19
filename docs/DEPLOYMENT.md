# Deployment Model

## Intended branch and environment flow

```text
feature/* → Vercel preview deployment
staging   → staging environment
main      → production environment
```

Feature branches should be used for active development and review. The `staging` branch is the integration and review point before production. The `main` branch represents production and should not be used as an experimentation branch.

## Current deployment

The `main` branch is connected to Vercel and the current foundation deployment is publicly available at [ocsco-project-crimson.vercel.app](https://ocsco-project-crimson.vercel.app/). No custom domain or environment-specific secrets are configured.

## Environment separation

Preview/Staging and Production must eventually use separate environment configurations. Production secrets must not be shared indiscriminately with preview or staging deployments. Supabase projects, keys, storage policies, authentication settings, and other external resources should be selected explicitly for the environment being deployed.

The repository intentionally does not contain account IDs, deployment URLs, domains, credentials, or environment values. Human owners will need to supply those values through GitHub/Vercel/Supabase configuration when the integrations are approved.

## Future owner configuration

- Configure GitHub branch protection for `feature/*`, `staging`, and `main`.
- Configure preview, staging, and production environment variables in the appropriate Vercel scopes when those integrations are needed.
- Create or select separate Supabase environments/projects and provide only the required variables to each deployment.
- Configure the production domain only after the application and deployment workflow have been approved.

Vercel authorization was completed after the foundation was approved. Supabase authorization and project configuration are active for the staging contact-form slice only.

Supabase authorization and project configuration are now active for the staging contact-form slice only. The staging Vercel deployment still requires the environment variables below; production remains unconfigured.

## Staging contact-form configuration

The staging `/contact` form writes validated submissions to the `public.inquiries` table in the dedicated `crimson-staging` Supabase project through the server-side `/api/inquiries` route. Configure these variables in Vercel for the Preview environment only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` — server-only; never expose this in client code or commit it
- `RESEND_API_KEY` — server-only; use a sending-only key where available
- `INQUIRY_NOTIFICATION_EMAIL` — owner inbox for new inquiry notifications
- `INQUIRY_NOTIFICATION_FROM` — verified sender, or `OCSCO inquiries <onboarding@resend.dev>` for the initial Resend account-owner test

Do not add these values to the repository or to the Production environment until the full notification and follow-up workflow has been approved.
