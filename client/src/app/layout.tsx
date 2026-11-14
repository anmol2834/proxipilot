import type { Metadata } from "next";
import { Inter, Caveat } from "next/font/google";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import { QueryProvider } from "@/lib/query/query-provider";
import { TenantProvider } from "@/hooks/use-tenant";
import { ToastContainer } from "@/components/ui/feedback/ToastContainer";
import "@/styles/globals.scss";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-handwritten",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "ProxiPilot",
  description: "Enterprise Autonomous AI Proxy Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${caveat.variable}`}>
      <body>
        <QueryProvider>
          <TenantProvider>
            <ThemeRegistry>
              {children}
              <ToastContainer />
            </ThemeRegistry>
          </TenantProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
