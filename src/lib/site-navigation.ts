export type NavigationItem = {
  label: string;
  href: string;
};

export const defaultPrimaryNavigation: NavigationItem[] = [
  { href: "/services", label: "Services" },
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];
