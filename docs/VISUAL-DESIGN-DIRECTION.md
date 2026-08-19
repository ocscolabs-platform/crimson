# Phase 2 — Visual Design Direction

**Status:** Proposed for owner review  
**Reference:** Existing OCSCO Brand Style Guide, Version 2.0  
**Scope:** Visual system and page composition principles; no route or component implementation yet.

## Design thesis

OCSCO should feel like a premium digital solutions studio: calm, precise, architectural, and quietly confident. The visual system should communicate that the company can think strategically and execute technically without relying on decoration or hype.

## Core principles

### Quiet authority

Use strong typography, generous space, and precise alignment to create confidence. Avoid loud effects, crowded layouts, and unnecessary motion.

### Clarity as a visual discipline

Each viewport should have one dominant message and one obvious next action. Content hierarchy should be understandable before a visitor studies the page.

### Substance before style

Visual polish must support explanation, proof, and conversion. Do not add visual elements that do not clarify an idea or establish trust.

### Integrated system

Brand, website, CMS, CRM, and custom application capabilities should feel like parts of one coherent platform rather than disconnected services.

## Provisional design tokens

These tokens are extracted from the existing brand reference and remain subject to owner confirmation before implementation.

### Color

| Token | Value | Intended use |
| --- | --- | --- |
| Ink | `#0A0A0A` | Hero, header, footer, premium feature areas |
| Green | `#00C853` | Primary actions and restrained accents |
| White | `#FFFFFF` | Primary light surfaces and text on dark surfaces |
| Snow | `#F7F7F7` | Alternating light sections and card surfaces |
| Graphite | `#1A1A1A` | Dark body text and secondary dark surfaces |
| Muted | `#9E9E9E` | Supporting text on dark backgrounds |
| Border | `#E8E8E8` | Light borders and quiet separators |

Rules:

- Green is an action and emphasis color, not a large background fill.
- Use black hero/header/footer sections to create rhythm, not to make every section dark.
- Maintain WCAG AA contrast for all text and controls.
- Do not use green body text on white for text smaller than 18px.
- Limit each component to a maximum of two primary colors.
- No gradients, rainbow palettes, or decorative color effects.

### Typography

- Primary family: **Plus Jakarta Sans**, matching the current OCSCO.io public site.
- Weight range: 400, 500, 600, 700, and 800.
- Body: 400, approximately 1.6 line height.
- Navigation: 500.
- Strong labels: 600.
- H3: 700, 24-28px.
- H1 and H2: 800, with tight tracking and approximately 1.0-1.1 line height.
- Body: 16-18px, regular, approximately 1.6 line height.
- Caption: 13-14px, regular.

Mobile sizes should scale down proportionally without sacrificing readable line length or hierarchy.

### Layout and spacing

- Use an 8px baseline spacing grid.
- Target 120px vertical spacing between major desktop sections and 64px on mobile.
- Use generous page margins and a readable content measure.
- Limit content grids to a maximum of three columns.
- Use a pill radius for action buttons and compact active navigation surfaces.
- Use a 12px radius consistently for cards, images, inputs, and modals.
- Use at least 24px internal component padding; use 32px where the content needs emphasis.

### Components and interaction

- Primary button: green fill, ink text, pill radius, generous horizontal padding.
- Secondary button: transparent or light surface with a one-pixel border and pill radius.
- Button states: default, a brighter green or inverted hover state, and a slightly darker pressed state must be defined.
- Top navigation: quiet default links, compact graphite hover/active surface, 8px radius, and 500 font weight.
- Avoid pill buttons, all-caps button labels, hard shadows, and 3D effects.
- Use one consistent geometric icon family, such as Lucide or Phosphor, at a consistent stroke weight.
- Motion should be subtle: 200-300ms ease-out transitions and restrained fade-up reveals where they improve orientation.
- Respect reduced-motion preferences.

## Page composition direction

### Home

Start with a dark, typography-led hero. Follow with light sections for capabilities, philosophy, proof, and a closing CTA. The page should feel editorial and intentional, not like a template assembled from repeated cards.

### Services

Use a system view: capabilities should connect to outcomes and to each other. Prefer a clear rhythm of statement, explanation, evidence, and CTA over a dense service grid.

### Work

Make project evidence the visual focus. Use large, well-cropped imagery or work artifacts only when approved and high quality. Avoid generic stock photography.

### About

Use lighter, more editorial layouts with strong text hierarchy. Philosophy and people should feel human and specific, not like corporate values copied from a template.

### Contact

Use a warm, light composition with generous form spacing and clear expectation-setting. The page should feel like an open door rather than a sales funnel.

## Image and asset direction

- Prefer real OCSCO or client work, editorial environments, abstract geometry, or carefully selected work-in-progress imagery.
- Avoid generic stock photography of people pointing at screens, shaking hands, or posing with oversized devices.
- Use darkened or desaturated imagery when it helps integrate media with the visual system.
- Do not copy the existing brand guide or source assets into the repository until the owner confirms which assets are cleared for project use.

## Explicit anti-patterns

- Emoji as interface icons.
- Gradient backgrounds or animated particle effects.
- Overloaded layouts or more than three content columns.
- Auto-playing sliders, carousels, pop-ups, or first-visit interstitials.
- Inconsistent corner radii, heavy shadows, or decorative motion.
- Unverified metrics, anonymous testimonials, or unsupported superlative claims.

## Implementation boundary

Phase 2 will produce design direction and content requirements only. The next implementation phase may create a token layer and one representative public route after the owner approves this direction and provides launch content. No public route, CMS schema, CRM schema, or Supabase integration should be added as part of this phase.
