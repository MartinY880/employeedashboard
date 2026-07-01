import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SoundProvider } from "@/components/shared/SoundProvider";
import { DynamicFavicon } from "@/components/shared/DynamicFavicon";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { ITHelpDeskChat } from "@/components/ITHelpDeskChat";
import { getAuthUser } from "@/lib/logto";
import { prisma } from "@/lib/prisma";
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
    "Secure, unified internal employee portal for MortgagePros — directory, props, alerts, calendar & more.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthenticated, user } = await getAuthUser();

  // AI bot is enabled unless an admin has explicitly turned it off in Site Branding.
  let aiBotEnabled = true;
  try {
    const aiBotSetting = await prisma.calendarSetting.findUnique({
      where: { id: "ai_bot_settings" },
    });
    if (aiBotSetting?.data) {
      const parsed = JSON.parse(aiBotSetting.data) as { enabled?: boolean };
      aiBotEnabled = parsed.enabled !== false;
    }
  } catch {
    // DB unavailable — default to enabled
  }

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
        suppressHydrationWarning
      >
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <SoundProvider>
              <DynamicFavicon />
              {children}
              <Toaster position="bottom-right" richColors />
              {isAuthenticated && user && aiBotEnabled && (
                <ITHelpDeskChat userName={user.name} userEmail={user.email} />
              )}
            </SoundProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
