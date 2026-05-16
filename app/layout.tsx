import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSDomada — Omada WiFi Billing System",
  description: "Uza WiFi kwa urahisi na faida zaidi. Captive portal, malipo ya simu, na usimamizi wa Omada — mahali pamoja.",
  icons: {
    icon: "/images/SSDomada.png",
    apple: "/images/SSDomada.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
