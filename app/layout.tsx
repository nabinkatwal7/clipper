import type { Metadata } from "next";
import "./globals.css";
import { webLocale } from "@/lib/web-session";

export const metadata: Metadata = {
  title: "Clipper Studio",
  description: "Local AI video clipping, transcription and captions.",
};
// Applies the saved public-site theme before first paint. The studio manages its own theme.
const themeScript = `try{if(!location.pathname.startsWith("/app")){var t=localStorage.getItem("site-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}}catch(e){}`;
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={await webLocale()} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
