# AGENTS.md

## Operating contract

- Read the relevant project documentation in `docs/` before making major changes.
- Treat `main` as production. Use `feature/*` for active work and `staging` for integration and review.
- Never commit secrets, credentials, tokens, private keys, or local environment files.
- Do not make undocumented architecture changes. Keep `docs/DECISIONS.md` synchronized with major decisions.
- Prefer simple, maintainable solutions and avoid unnecessary dependencies or speculative features.
- Keep targeted work scoped; do not redesign unrelated application areas.
- Preserve separation between development, staging, and production environments.
- Run relevant validation before declaring work complete.
- Explain failures instead of hiding them, and do not claim completion without verification.

## Project guardrails

- Phase 0 foundation work and Phase 1 information architecture are complete. The current phase is Phase 2: content and visual design direction.
- Phase 2 is content planning and design definition work. Do not build public website routes, CMS, CRM, or production integrations until the relevant implementation phase is explicitly approved.
- Do not add production Supabase credentials, Vercel configuration values, domains, or account-specific identifiers to the repository.
- Update the README and applicable documentation when the architecture or developer workflow changes.
