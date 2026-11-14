import { Metadata } from "next";
import { SignupAuthForm, SignupShowcasePanel } from "@/components/registration";

export const metadata: Metadata = {
  title: "Get Started Now — ProxiPilot",
  description:
    "Enter your credentials to access your account. The simplest way to automate your inbox with ProxiPilot.",
};

export default function SignupPage() {
  return (
    <main className="pp-signup-root">
      <SignupAuthForm />
      <SignupShowcasePanel />
    </main>
  );
}
