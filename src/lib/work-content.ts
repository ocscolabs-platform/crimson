export type WorkProject = {
  slug: string;
  name: string;
  status: "Featured" | "Case study" | "Prototype" | "Upcoming";
  category: string;
  description: string;
  href?: string;
  featured?: boolean;
  clientVisibility?: "hidden" | "approved";
};

export const workProjects: WorkProject[] = [
  {
    slug: "cimet-law",
    name: "CIMET Law",
    status: "Featured",
    category: "Upcoming build",
    description: "The featured OCSCO project in preparation. Approved project story, imagery, and outcomes will be added as the work is published.",
    featured: true,
  },
  {
    slug: "cairnstack",
    name: "Cairnstack",
    status: "Prototype",
    category: "Platform ecosystem",
    description: "A live prototype exploring a software ecosystem for traceability and operational visibility.",
    href: "https://cairnstack.netlify.app/",
  },
  {
    slug: "trxio",
    name: "TRXIO",
    status: "Prototype",
    category: "Inventory platform",
    description: "A live prototype exploring calm, exact inventory operations and item-level visibility.",
    href: "https://css-trxio.netlify.app/",
  },
  {
    slug: "toofarts",
    name: "TooFarts",
    status: "Prototype",
    category: "Commerce experience",
    description: "A live commerce prototype for a distinctive product and content experience.",
    href: "https://toofarts-web.vercel.app/",
  },
  {
    slug: "membership-portal",
    name: "Membership portal",
    status: "Upcoming",
    category: "Web application",
    description: "An upcoming membership experience. Final scope, content, and approved outcomes will be added during the build.",
  },
];
