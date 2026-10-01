import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bengkel Makan Management System",
  description: "Sistem manajemen jatah bengkel makan hotel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
