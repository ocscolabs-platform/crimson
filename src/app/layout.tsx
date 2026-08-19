import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OCSCO Project Crimson",
  description: "OCSCO integrates strategy, design, and technology to build digital infrastructure for ambitious brands.",
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
