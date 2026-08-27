export type NavigationItem = {
  label: string;
  href: string;
};

export const defaultPrimaryNavigation: NavigationItem[] = [
  { href: "/services", label: "Services" },
  { href: "/work", label: "Work" },
  { href: "/insights", label: "Insights" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];
