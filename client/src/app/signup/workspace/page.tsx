import { Metadata } from "next";
import {
  RegistrationShell,
  WorkspaceStepForm,
  RegistrationRouteGuard,
} from "@/components/registration";

export const metadata: Metadata = {
  title: "Personalize your workspace — ProxiPilot",
  description:
    "Tailor ProxiPilot to your workflow, timezone preferences, and AI response style.",
};

export default function WorkspacePage() {
  return (
    <RegistrationRouteGuard step="workspace">
      <RegistrationShell
        step="workspace"
        stepNumber={4}
        title="Personalize your workspace"
        subtitle="These settings help us give you a better, more tailored experience."
        showProgress={true}
      >
        <WorkspaceStepForm />
      </RegistrationShell>
    </RegistrationRouteGuard>
  );
}
