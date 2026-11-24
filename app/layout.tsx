import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Clipper AI · Your next great moment",
  description: "Local AI video clipping, transcription and captions.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
