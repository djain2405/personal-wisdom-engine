import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import type { Metadata, Viewport } from "next";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const sans = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personal Wisdom Engine",
  description:
    "An AI that learns your philosophy and helps you live according to it",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-stone-900">{children}</body>
    </html>
  );
}
