import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SoundProvider } from "@/components/shared/SoundProvider";
import { DynamicFavicon } from "@/components/shared/DynamicFavicon";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProConnect | MortgagePros Employee Portal",
  description:
    "Secure, unified internal employee portal for MortgagePros — directory, kudos, alerts, calendar & more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('proconnect-theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <SoundProvider>
              <DynamicFavicon />
              {children}
              <Toaster position="bottom-right" richColors />
            </SoundProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
