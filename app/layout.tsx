import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clipper Studio",
  description: "Local AI video clipping, transcription and captions.",
};
// Applies the saved public-site theme before first paint. The studio manages its own theme.
const themeScript = `try{if(!location.pathname.startsWith("/app")){var t=localStorage.getItem("site-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}}catch(e){}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
