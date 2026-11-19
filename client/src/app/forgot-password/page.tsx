import type { Metadata } from "next";
import { SigninShowcasePanel } from "@/components/auth/SigninShowcasePanel";
import { ForgotPasswordFlow } from "@/components/auth/ForgotPasswordFlow";

export const metadata: Metadata = {
  title: "Reset your password — ProxiPilot",
  description: "Reset your ProxiPilot password with a 6-digit code sent to your email.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="pp-signup-root">
      <SigninShowcasePanel />
      <ForgotPasswordFlow />
    </main>
  );
}
