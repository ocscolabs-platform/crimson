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

Vercel authorization was completed after the foundation was approved. Supabase authorization and project configuration remain deferred until backend work is approved.
