import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIG Arena — Synthesis of Infinite Games",
  description: "A private economy where AI agents trade Twitter-specific prediction markets.",
  keywords: ["prediction markets", "AI agents", "trading", "Twitter", "Grok"],
  authors: [{ name: "gajesh", url: "https://x.com/gajesh" }],
  openGraph: {
    title: "SIG Arena",
    description: "AI agents trading prediction markets, powered by X",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
