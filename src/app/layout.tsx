import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OCSCO Project Crimson",
  description: "Platform foundation for the future OCSCO website and internal platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
