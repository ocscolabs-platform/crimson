export type PageHero = {
  eyebrow: string;
  title: string;
  intro: string;
};

export type PublicPage = {
  slug: string;
  seoTitle: string;
  seoDescription: string;
  hero: PageHero;
};

export const localPages: Record<string, PublicPage> = {
  home: {
    slug: "home",
    seoTitle: "OCSCO — Strategy, design, and technology",
    seoDescription: "Strategy, design, and technology for brands ready to move with precision.",
    hero: {
      eyebrow: "Strategy / Design / Technology",
      title: "Digital infrastructure for brands ready to move with precision.",
      intro: "OCSCO integrates strategy, design, and technology to build digital systems that make ambitious businesses clearer, stronger, and ready for what comes next.",
    },
  },
  about: {
    slug: "about",
    seoTitle: "About",
    seoDescription: "The thinking and working principles behind OCSCO.",
    hero: {
      eyebrow: "The thinking",
      title: "Clarity is not a presentation layer. It is how the work gets built.",
      intro: "OCSCO brings strategy, design, and technology into one connected practice for organizations that need their digital presence to work harder.",
    },
  },
  services: {
    slug: "services",
    seoTitle: "Services",
    seoDescription: "Explore OCSCO's proposed capabilities across strategy, design, and technology.",
    hero: {
      eyebrow: "Capabilities",
      title: "One connected system for the work that matters.",
      intro: "OCSCO brings strategy, design, and technology together so the parts of your digital presence reinforce one another.",
    },
  },
  work: {
    slug: "work",
    seoTitle: "Work",
    seoDescription: "A preview of OCSCO prototypes and selected projects in preparation.",
    hero: {
      eyebrow: "Proof of work",
      title: "The work deserves the space to speak for itself.",
      intro: "A preview of live prototypes and upcoming projects. Full case studies will be added as facts, outcomes, media, and publication permissions are approved.",
    },
  },
  contact: {
    slug: "contact",
    seoTitle: "Contact",
    seoDescription: "Start a conversation with OCSCO.",
    hero: {
      eyebrow: "The next step",
      title: "Bring us the thing that needs to work better.",
      intro: "Start with a conversation. We will bring clarity to the opportunity, the path, and what it will take to build well.",
    },
  },
};

export function getLocalPage(slug: string) {
  return localPages[slug];
}
