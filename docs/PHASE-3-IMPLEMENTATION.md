# Phase 3 — Public Website Implementation

**Status:** Public route skeleton implemented; owner review pending
**Scope:** First public route structure and shared visual expression
**Out of scope:** CMS, CRM, authentication, Supabase, protected routes, and unapproved proof content

## Implemented slice

The homepage currently includes:

- Dark typography-led hero with primary and secondary calls to action.
- OCSCO positioning statement using draft-safe, outcome-led language.
- Integrated capabilities section covering branding, website design and development, custom CMS, CRM and business tools, and custom web applications.
- Approach section explaining the three-step working model.
- Honest proof-of-work state that does not invent case studies, metrics, testimonials, or client names.
- Contact CTA linking to the approved project email address currently available in the project context.
- Footer and responsive navigation treatment.
- CSS-native hero atmosphere using animated grain and translucent glass planes, with reduced-motion support.
- Lucide React line icons for capability cards, with visible text labels preserved.
- Explicit portfolio media placeholder state until approved case-study assets are available.

The route tree now includes:

- `/services`
- `/services/[slug]` for the five proposed service capabilities
- `/work`
- `/about`
- `/contact`

## Implementation choices

- The first slice uses in-page anchors for sections that do not yet have implemented routes.
- The visual token layer is expressed in `src/app/globals.css` and follows the Phase 2 direction.
- The page uses the supplied OCSCO wordmark assets, Lucide React icons, and CSS-native visual treatment; it uses no project photography, CMS data, or backend connections.
- The page uses CSS and semantic HTML for the first visual pass; future component extraction should happen when repeated patterns appear across multiple routes.
- The homepage copy is a working draft. It must be reviewed before it is treated as final marketing copy.
- Service detail pages use structured local content from `src/lib/site-content.ts`; this is an interim boundary until a CMS exists.

## Known gaps before public launch

- Replace route-shell copy with approved content briefs and final copy.
- Replace the proof-of-work note with approved case-study content.
- Confirm and replace the draft homepage headline and supporting copy.
- Confirm the public contact workflow before replacing the email CTA with a form.
- Add approved brand assets, team information, case-study media, and metadata.
- Add full responsive and accessibility review across all implemented routes.
- Refine the visual system after the route responsibilities and content structure are approved.

## Review gate

The owner should review the live route structure and homepage slice for:

- Positioning and tone.
- Visual direction and hierarchy.
- Capability naming and ordering.
- CTA language and contact destination.
- Whether the proof-of-work state is acceptable while case-study content is gathered.
- Whether the route responsibilities and service ordering match the intended business structure.

No additional route or backend implementation should be treated as launch-ready until this slice is approved.
