import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestionale Energia | Mancini Service",
  description: "Gestionale energia Mancini Service"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
