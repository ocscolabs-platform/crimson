export type Service = {
  slug: string;
  name: string;
  summary: string;
  audience: string;
  outcome: string;
};

export const services: Service[] = [
  {
    slug: "branding",
    name: "Branding",
    summary: "Positioning and identity systems that give the quality of your business a clear, credible expression.",
    audience: "Teams whose business has outgrown its current identity or market position.",
    outcome: "A sharper identity and a clearer foundation for every customer touchpoint.",
  },
  {
    slug: "website-design-development",
    name: "Website design & development",
    summary: "High-performing digital experiences that turn clarity into trust and trust into momentum.",
    audience: "Organizations that need their public presence to match the quality of their work.",
    outcome: "A digital experience built around understanding, credibility, and action.",
  },
  {
    slug: "custom-cms",
    name: "Custom CMS",
    summary: "Content systems shaped around how your team actually works, publishes, and grows.",
    audience: "Teams with structured content needs that do not fit a generic publishing workflow.",
    outcome: "More control, less friction, and a content foundation that can evolve with the business.",
  },
  {
    slug: "crm-business-tools",
    name: "CRM & business tools",
    summary: "Purpose-built workflows that reduce friction and help your team operate with more signal.",
    audience: "Organizations ready to replace disconnected workarounds with a coherent operating system.",
    outcome: "Clearer workflows and tools that reflect the way the business actually operates.",
  },
  {
    slug: "custom-web-applications",
    name: "Custom web applications",
    summary: "When an off-the-shelf answer is not enough, we architect the application your process needs.",
    audience: "Teams with unique workflows, data, or customer experiences that need a bespoke solution.",
    outcome: "A durable application boundary built around the work, not around a template.",
  },
];

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}
