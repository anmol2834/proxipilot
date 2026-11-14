import { Metadata } from "next";
import {
  RegistrationShell,
  BusinessStepForm,
  RegistrationRouteGuard,
} from "@/components/registration";

export const metadata: Metadata = {
  title: "Describe your business — ProxiPilot",
  description:
    "Help ProxiPilot understand your business context to deliver personalized, high-accuracy inbox intelligence.",
};

export default function BusinessPage() {
  return (
    <RegistrationRouteGuard step="business">
      <RegistrationShell
        step="business"
        stepNumber={3}
        title="Describe your business"
        subtitle="Help our AI understand what you do, who you serve, and how you work."
        showProgress={true}
      >
        <BusinessStepForm />
      </RegistrationShell>
    </RegistrationRouteGuard>
  );
}
