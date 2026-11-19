import type { Metadata } from "next";
import Link from "next/link";
import {
  IconBrandGoogle,
  IconBrandWindows,
  IconCpu,
  IconDatabase,
  IconChecklist,
  IconShieldLock,
  IconChevronRight,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import { DocsFrame, InlineToc, Pager, OVERVIEW_SECTIONS } from "@/components/docs/DocArticleView";
import d from "@/components/docs/docs.module.css";

export const metadata: Metadata = {
  title: "Documentation — ProxiPilot",
  description:
    "Official developer and user documentation for ProxiPilot. Setup guides for Gmail, Microsoft 365, Qdrant vector retrieval, and AI reply automation.",
  alternates: { canonical: "https://proxipilot.com/docs" },
};

const START_PATH = [
  {
    title: "Connect your inbox",
    text: "Authorize Gmail or Outlook with secure OAuth.",
    href: "/docs/getting-started#connect-inbox",
  },
  {
    title: "Upload business knowledge",
    text: "Add FAQs, catalogs and policies for grounded replies.",
    href: "/docs/getting-started#knowledge-base",
  },
  {
    title: "Review your first draft",
    text: "Edit, tune the tone and send from your own mailbox.",
    href: "/docs/getting-started#first-draft",
  },
];

function GuideRows({ rows }: { rows: { title: string; text: string; href: string; Icon: TablerIcon }[] }) {
  return (
    <ul className={d.guideRows}>
      {rows.map(({ title, text, href, Icon }) => (
        <li key={href}>
          <Link href={href} className={d.guideRow}>
            <span className={d.guideIcon} aria-hidden="true">
              <Icon size={20} stroke={1.8} />
            </span>
            <span>
              <span className={d.guideName}>{title}</span>
              <span className={d.guideText}>{text}</span>
            </span>
            <IconChevronRight size={18} className={d.guideChevron} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DocsOverviewPage() {
  return (
    <DocsFrame activeSlug="docs" toc={OVERVIEW_SECTIONS}>
      <main className={d.article} id="main-content">
        <p className={d.eyebrow}>Overview &amp; Setup</p>
        <h1 className={d.title}>ProxiPilot Platform Documentation</h1>
        <p className={d.description}>
          Comprehensive technical guides, mailbox setup instructions, and vector knowledge workflows for the ProxiPilot
          platform.
        </p>

        <ol className={d.startPath} aria-label="Get set up in three steps">
          {START_PATH.map((s, i) => (
            <li key={s.href} className={d.startStep}>
              <Link href={s.href}>
                <span className={d.startNum} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={d.startTitle}>{s.title}</span>
                <span className={d.startText}>{s.text}</span>
              </Link>
            </li>
          ))}
        </ol>

        <InlineToc toc={OVERVIEW_SECTIONS} />

        <section id="getting-started" className={d.homeSection}>
          <div className={d.prose}>
            <h2>1. Quick Start Walkthrough</h2>
            <p>
              ProxiPilot is an enterprise AI email copilot and automation engine. It integrates directly with your existing
              corporate mailboxes (Google Workspace and Microsoft 365) to index incoming client inquiries, query your
              internal knowledge documents in vector memory, and generate context-aware draft replies for human review.
            </p>
          </div>
          <div className={d.inlineCta}>
            <div>
              <p className={d.inlineCtaTitle}>Ready to onboard your first mailbox?</p>
              <p className={d.inlineCtaText}>Follow our 5-minute step-by-step onboarding walkthrough.</p>
            </div>
            <Link href="/docs/getting-started" className={d.btnPrimary} style={{ display: "inline-flex" }}>
              Start Setup
            </Link>
          </div>
        </section>

        <section id="integrations" className={d.homeSection}>
          <div className={d.prose}>
            <h2>2. Mailbox Integrations</h2>
            <p>
              ProxiPilot uses official, granular OAuth 2.0 protocols to synchronize emails. We never require your account
              password or modify DNS records.
            </p>
          </div>
          <GuideRows
            rows={[
              {
                title: "Google Workspace & Gmail",
                text: "Authorize gmail.readonly and gmail.compose with automatic webhook push notifications.",
                href: "/docs/connect-gmail",
                Icon: IconBrandGoogle,
              },
              {
                title: "Microsoft 365 & Exchange",
                text: "Connect via Microsoft Graph API for single accounts or tenant-wide shared support mailboxes.",
                href: "/docs/connect-outlook",
                Icon: IconBrandWindows,
              },
            ]}
          />
        </section>

        <section id="copilot-rag" className={d.homeSection}>
          <div className={d.prose}>
            <h2>3. Vector Grounding &amp; AI Copilot</h2>
            <p>
              ProxiPilot avoids hallucinations by enforcing evidence retrieval before LLM generation. When a customer asks
              about a product code or warranty term, the system searches your uploaded knowledge base.
            </p>
          </div>
          <GuideRows
            rows={[
              {
                title: "Business Knowledge Base",
                text: "Import CSV and Excel catalogs, price lists and FAQ sheets, organized into nine knowledge categories.",
                href: "/docs/business-knowledge",
                Icon: IconDatabase,
              },
              {
                title: "AI Automation & Prompts",
                text: "Configure company tone guidelines, prompt rules, and thread-isolated refinement.",
                href: "/docs/ai-automation",
                Icon: IconCpu,
              },
            ]}
          />
        </section>

        <section id="draft-management" className={d.homeSection}>
          <div className={d.prose}>
            <h2>4. Review &amp; Approval Modes</h2>
            <p>
              Learn how to approve drafts, fine-tune responses with one-click tone presets, and safely enable autonomous
              sending for routine inquiries.
            </p>
          </div>
          <GuideRows
            rows={[
              {
                title: "Read the Draft Management Guide",
                text: "Approve, edit and send drafts, and decide which routine replies may send on their own.",
                href: "/docs/manage-drafts",
                Icon: IconChecklist,
              },
            ]}
          />
        </section>

        <section id="architecture" className={d.homeSection}>
          <div className={d.prose}>
            <h2>5. Security &amp; Multi-Tenant Isolation</h2>
            <p>ProxiPilot is engineered with defense-in-depth security:</p>
            <ul>
              <li>
                <strong>Zero Model Training:</strong> Your business emails and customer data are never used to train
                public LLMs.
              </li>
              <li>
                <strong>Tenant Isolation:</strong> Qdrant vector memory is partitioned in isolated logical namespaces.
              </li>
              <li>
                <strong>Token Vaulting:</strong> OAuth refresh tokens are encrypted at rest with AES-256 and unsealed only
                in volatile memory.
              </li>
            </ul>
          </div>
          <GuideRows
            rows={[
              {
                title: "Visit the Security & Trust Center",
                text: "Data handling, encryption, subprocessors and compliance commitments.",
                href: "/security",
                Icon: IconShieldLock,
              },
            ]}
          />
        </section>

        <div style={{ marginTop: 48 }}>
          <Pager nextSlug="getting-started" />
        </div>
      </main>
    </DocsFrame>
  );
}
