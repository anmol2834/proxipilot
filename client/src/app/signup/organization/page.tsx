import { Metadata } from "next";
import {
  RegistrationShell,
  OrganizationStepForm,
  RegistrationRouteGuard,
} from "@/components/registration";

export const metadata: Metadata = {
  title: "Create your workspace — ProxiPilot",
  description:
    "Set up your organization and configure your team's workspace in ProxiPilot.",
};

export default function OrganizationPage() {
  return (
    <RegistrationRouteGuard step="organization">
      <RegistrationShell
        step="organization"
        stepNumber={2}
        title="Create your workspace"
        subtitle="Let's set up your organization."
        showProgress={true}
      >
        <OrganizationStepForm />
      </RegistrationShell>
    </RegistrationRouteGuard>
  );
}
