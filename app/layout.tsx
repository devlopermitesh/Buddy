import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://buddy.social"),
  title: "BUDDY — Your 24/7 Social Sidekick",
  description:
    "Meet BUDDY, the smiling sidekick that learns your brand, plans your content, and takes the everyday stress of social media off your plate.",
  keywords: [
    "BUDDY",
    "social media sidekick",
    "content planning",
    "brand voice",
    "social media manager",
  ],
  openGraph: {
    title: "BUDDY — Your 24/7 Social Sidekick",
    description:
      "A little less content chaos. A lot more consistency. Meet the sidekick that keeps your brand showing up.",
    type: "website",
    siteName: "BUDDY",
  },
  twitter: {
    card: "summary_large_image",
    title: "BUDDY — Your 24/7 Social Sidekick",
    description:
      "A little less content chaos. A lot more consistency. Meet the sidekick that keeps your brand showing up.",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf9f6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`}>
      <body>{children}</body>
    </html>
  );
}
