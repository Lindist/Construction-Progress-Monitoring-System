import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/shared/Providers";
import Navbar from "@/components/shared/Navbar";

export const metadata: Metadata = {
  title: "Construction Progress Monitor",
  description: "Upload and preview construction media for progress monitoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
