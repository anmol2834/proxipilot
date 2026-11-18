import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "AI Transparency & Data Use Policy — ProxiPilot",
  description:
    "Discover how ProxiPilot leverages AI models, our strict non-training commitment, RAG architecture, vector search isolation, and human-in-the-loop safeguards.",
  alternates: { canonical: "https://proxipilot.com/ai-transparency" },
};

const TOC_ITEMS = [
  { id: "overview", title: "1. AI Architecture Overview" },
  { id: "models", title: "2. Foundation Model Providers" },
  { id: "non-training", title: "3. Strict Zero-Training Guarantee" },
  { id: "rag-architecture", title: "4. Retrieval-Augmented Generation (RAG)" },
  { id: "tenant-isolation", title: "5. Tenant Isolation in Vector Search" },
  { id: "human-in-loop", title: "6. Human-in-the-Loop Philosophy" },
  { id: "safety-guardrails", title: "7. Prompt Injection & Safety Guardrails" },
  { id: "disclaimers", title: "8. Hallucination Disclaimers & Verification" },
];

export default function AiTransparencyPage() {
  return (
    <LegalPageShell policyKey="ai-transparency" tocItems={TOC_ITEMS}>
      <section id="overview" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          1. AI Architecture Overview
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot is an enterprise AI email copilot built to assist modern commercial teams in understanding incoming inquiries, surfacing relevant company knowledge, and drafting professional email replies. This policy provides complete transparency into our artificial intelligence pipeline, data boundaries, and governance safeguards.
        </p>
      </section>

      <section id="models" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          2. Foundation Model Providers
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot integrates with leading enterprise AI foundation model providers:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}><strong>OpenAI (GPT-4o / GPT-4o-mini):</strong> Utilized for conversational intent classification, complex context analysis, and structured extraction.</li>
          <li style={{ marginBottom: 4 }}><strong>Anthropic (Claude 3.5 Sonnet):</strong> Utilized for high-fidelity tone synthesis, long-context corporate email drafting, and nuanced customer inquiries.</li>
        </ul>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          All AI inference occurs over secured, encrypted HTTPS connections directly with provider enterprise API gateways.
        </p>
      </section>

      <section id="non-training" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          3. Strict Zero-Training Guarantee
        </h2>
        <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "12px 14px", margin: "12px 0", color: "#166534", fontSize: 13 }}>
          <strong>Non-Negotiable Zero-Training Principle:</strong>
          <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
            We explicitly contract with our AI providers under commercial enterprise terms prohibiting the use of customer data for model training. <strong>Your emails, prompts, business documents, and AI-generated drafts are never used to train, fine-tune, or optimize any foundation AI models</strong> (neither OpenAI&rsquo;s, Anthropic&rsquo;s, nor ProxiPilot&rsquo;s).
          </p>
        </div>
      </section>

      <section id="rag-architecture" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          4. Retrieval-Augmented Generation (RAG)
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          To provide accurate replies rooted in your company&rsquo;s products, pricing, and FAQs, ProxiPilot uses a Retrieval-Augmented Generation (RAG) architecture:
        </p>
        <ol style={{ paddingLeft: 20, margin: "0 0 10px", fontSize: 14, color: "#334155" }}>
          <li style={{ marginBottom: 4 }}><strong>Chunking &amp; Embedding:</strong> Knowledge base documents uploaded by your organization are chunked and transformed into high-dimensional vector embeddings.</li>
          <li style={{ marginBottom: 4 }}><strong>Vector Indexing:</strong> Embeddings are stored in our managed <strong>Qdrant</strong> vector database.</li>
          <li style={{ marginBottom: 4 }}><strong>Context Injection:</strong> When an email inquiry is received, only the top-matching relevant paragraphs are retrieved and injected into the temporary inference prompt as grounding context.</li>
        </ol>
      </section>

      <section id="tenant-isolation" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          5. Tenant Isolation in Vector Search
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Security and customer isolation are built into our vector database architecture. Every vector search query enforces a cryptographically signed tenant filter (<code>workspace_id</code>). It is technically impossible for one company&rsquo;s vector search to retrieve documents, knowledge snippets, or past email drafts belonging to another organization.
        </p>
      </section>

      <section id="human-in-loop" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          6. Human-in-the-Loop Philosophy
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          ProxiPilot is designed as an assistant, not an autonomous agent. Drafts created by ProxiPilot appear in your inbox as pending suggestions. A human team member reviews, edits, and explicitly clicks &ldquo;Send&rdquo;. Where automated sending rules are configured by enterprise administrators, strict conditional triggers, confidence score thresholds, and kill switches are enforced.
        </p>
      </section>

      <section id="safety-guardrails" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          7. Prompt Injection &amp; Safety Guardrails
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Incoming emails often contain adversarial formatting or malicious attempts to alter AI behavior (&ldquo;prompt injection&rdquo;). ProxiPilot isolates user input text within strict system prompt encapsulation tags, sanitizes control tokens, and deploys pre-inference validation layers to prevent adversarial jailbreaks.
        </p>
      </section>

      <section id="disclaimers" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
          8. Hallucination Disclaimers &amp; Verification
        </h2>
        <p style={{ fontSize: 14, color: "#334155", margin: "0 0 10px", lineHeight: 1.62 }}>
          Large language models can occasionally generate factually inaccurate statements or hallucinations. Customers are solely responsible for verifying critical details (such as commercial quotes, contractual commitments, and product specifications) before dispatching any AI-drafted email to external recipients.
        </p>
      </section>
    </LegalPageShell>
  );
}
