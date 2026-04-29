import type { Metadata } from "next";
import { DM_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Typography:
//   Poppins — display headlines (and brand wordmark when used inline)
//   System sans-serif — body (no custom font load; matches the OS UI font)
//   DM Mono — captions, labels, all-caps accents
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-poppins",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "comfyBites — Online ordering for restaurants",
  description:
    "Hot, fresh, delivered. comfyBites is the online ordering platform for independent restaurants — your menu, your brand, your customers.",
  icons: {
    // SVG mark with transparent background — scales perfectly across browsers.
    // Modern browsers (Chrome, Firefox, Safari) prefer the SVG; the PNG
    // fallbacks remain for older clients and HTTP-only contexts.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/app-icon.png", sizes: "1024x1024", type: "image/png" }],
  },
  openGraph: {
    title: "comfyBites — Online ordering for restaurants",
    description:
      "Hot, fresh, delivered. comfyBites is the online ordering platform for independent restaurants.",
    images: [{ url: "/og-card.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "comfyBites",
    description: "Online ordering for restaurants — your menu, your brand.",
    images: ["/og-card.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${dmMono.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
