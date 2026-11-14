import type { Metadata } from "next";
import { LegalPage, LEGAL_CONTACT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — ProxiPilot",
  description: "How ProxiPilot collects, uses, stores and protects your data, including Google user data.",
  alternates: { canonical: "https://www.proxipilot.com/privacy" },
};

const li = { margin: "4px 0" } as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          ProxiPilot (&ldquo;ProxiPilot&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) helps businesses answer customer
          emails. It reads incoming emails in a mailbox you connect, drafts replies grounded in your own company
          knowledge, and sends the replies you approve. This policy explains what data we process, why, and the
          choices you have.
        </p>
      }
      sections={[
        {
          heading: "Data we collect",
          body: (
            <ul>
              <li style={li}><strong>Account data:</strong> your name, email address, organization details and sign-in information.</li>
              <li style={li}><strong>Connected mailbox data (Google user data):</strong> when you connect a Gmail account, the email messages, threads, sender and recipient addresses, subjects and message metadata of that mailbox, plus your Google account email address and basic profile.</li>
              <li style={li}><strong>Company knowledge:</strong> files you upload, such as product or service catalogues and price lists.</li>
              <li style={li}><strong>Usage data:</strong> technical logs needed to operate, secure and troubleshoot the service.</li>
            </ul>
          ),
        },
        {
          heading: "How we use Google user data",
          body: (
            <>
              <p>With your permission, ProxiPilot requests these Google scopes and uses them only to provide the features you see in the app:</p>
              <ul>
                <li style={li}><strong>Read (gmail.readonly) and modify (gmail.modify):</strong> receive new customer emails in real time, read the conversation so the AI can draft an accurate reply, and keep message state (for example read status) in sync.</li>
                <li style={li}><strong>Send (gmail.send):</strong> send a reply in the same Gmail thread, only when you or your team approve it, or when your organization has enabled automatic sending.</li>
                <li style={li}><strong>Email address and profile:</strong> identify which mailbox is connected.</li>
              </ul>
              <p>We do not use Google user data for advertising, we do not sell it, and we do not use it to build user profiles for any purpose unrelated to answering your customers.</p>
            </>
          ),
        },
        {
          heading: "Google API Services User Data Policy (Limited Use)",
          body: (
            <p>
              ProxiPilot&apos;s use and transfer to any other app of information received from Google APIs will adhere
              to the{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Humans at ProxiPilot do not read your emails, except with your
              explicit permission for a specific support request, where necessary for security purposes (such as
              investigating abuse), or to comply with applicable law.
            </p>
          ),
        },
        {
          heading: "AI processing",
          body: (
            <p>
              To draft a reply, the relevant parts of an email conversation and matching entries from your company
              knowledge are sent to our AI provider (OpenAI) through its API. This data is used only to generate the
              draft for you. Google user data is not used to develop, improve or train generalized AI or machine
              learning models.
            </p>
          ),
        },
        {
          heading: "How we share data",
          body: (
            <p>
              We share data only with service providers that operate ProxiPilot on our behalf (cloud hosting,
              database, and the AI provider described above), under obligations to protect it and use it only to
              provide the service. We may disclose data if required by law. We never sell personal data.
            </p>
          ),
        },
        {
          heading: "Storage, security and retention",
          body: (
            <p>
              Data is encrypted in transit (TLS) and OAuth tokens are encrypted at rest. Each organization&apos;s data is
              isolated from every other organization. When you disconnect a mailbox, ProxiPilot immediately stops
              receiving and reading its email. We keep stored data while your account is active; you can ask us to
              delete it at any time, and we delete it within 30 days of your request, except where we must keep it
              to meet a legal obligation.
            </p>
          ),
        },
        {
          heading: "Your choices and rights",
          body: (
            <ul>
              <li style={li}>Disconnect a mailbox at any time from Integrations in the app, or revoke ProxiPilot&apos;s access from your Google Account security settings.</li>
              <li style={li}>Request access to, correction of, or deletion of your data (including all stored Google user data) by emailing {LEGAL_CONTACT_EMAIL}.</li>
            </ul>
          ),
        },
        {
          heading: "Changes to this policy",
          body: <p>We will post any changes on this page and update the effective date. Material changes will be communicated to account owners.</p>,
        },
      ]}
    />
  );
}
