import { Metadata } from "next";
import { SignInPage } from "@/components/auth";

export const metadata: Metadata = {
  title: "Sign in — ProxiPilot",
  description:
    "Sign in to your ProxiPilot workspace. Manage autonomous AI email triage, evidence retrieval, and enterprise inbox workflows.",
};

export default function Page() {
  return <SignInPage />;
}
