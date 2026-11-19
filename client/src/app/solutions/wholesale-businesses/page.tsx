import type { Metadata } from "next";
import { SolutionPageShell } from "@/components/solutions/SolutionPageShell";
import {
  IconPackage,
  IconBarcode,
  IconTruck,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "AI Email Assistant for Wholesale & Distributors — ProxiPilot",
  description:
    "Automate wholesale catalog inquiries, SKU price checks, and bulk order requests. Eliminate manual PDF catalog searches and detect missing PO attachments automatically.",
  alternates: { canonical: "https://proxipilot.com/solutions/wholesale-businesses" },
};

export default function WholesaleBusinessesSolutionPage() {
  return (
    <SolutionPageShell
      badge="Wholesale & Distribution"
      title="Turn high-volume SKU inquiries and purchase orders into instant, grounded quotes."
      subtitle="Wholesale buyers send emails with partial SKU numbers, missing purchase orders, and urgent volume requests. ProxiPilot indexes your 10,000+ item product catalogs, verifies MOQs, and drafts accurate commercial quotes in seconds."
      highlightStats={[
        { value: "10k+", label: "Product SKUs indexed in Qdrant" },
        { value: "< 3 sec", label: "Catalog & specification lookup speed" },
        { value: "0", label: "Fictional prices or nonexistent SKUs" },
        { value: "100%", label: "Missing PO & attachment detection" },
      ]}
      painPointsTitle="Daily friction points in wholesale and distributor inboxes"
      painPoints={[
        {
          title: "Hunting through 200-page PDF catalogs for SKUs",
          desc: "Inside sales reps spend 10 minutes per inquiry opening massive PDF catalogs or Excel spreadsheets to confirm technical specs, finishes, and carton quantities.",
          icon: <IconBarcode size={20} />,
        },
        {
          title: "Buyers emailing about 'attached POs' with no attachment",
          desc: "Customers claim 'Please find attached PO' but forget the file, forcing reps to waste time crafting back-and-forth clarification emails.",
          icon: <IconPackage size={20} />,
        },
        {
          title: "Complex tiered pricing & minimum order quantities (MOQ)",
          desc: "Mistakes in quoting pallet-tier pricing versus single-case pricing erode wholesale distributor margins and cause invoice disputes.",
          icon: <IconTruck size={20} />,
        },
      ]}
      workflowTitle="How ProxiPilot automates wholesale catalog emails"
      workflowSubtitle="From messy buyer inquiry to clean commercial quotation in under 60 seconds."
      workflowSteps={[
        {
          step: "01",
          title: "Upload SKU Catalogs & Price Lists",
          desc: "Import your master inventory spreadsheets, product specifications, and MOQ tiers (CSV or Excel) into ProxiPilot vector memory.",
        },
        {
          step: "02",
          title: "Inbound RFQ & SKU Parsing",
          desc: "ProxiPilot matches product codes, model numbers, and finish descriptions against your indexed inventory.",
        },
        {
          step: "03",
          title: "Attachment & Evidence Verification",
          desc: "The system checks for attached purchase orders. If an attachment is missing or a code doesn't exist, it flags it immediately.",
        },
        {
          step: "04",
          title: "Sales Rep 1-Click Dispatch",
          desc: "The rep reviews the prepared quote, verifies stock allocation, and hits send—cutting quote turnaround from 4 hours to 2 minutes.",
        },
      ]}
      scenario={{
        title: "Typical Scenario: SKU Price Request & Missing PO Check",
        sender: "Suttter Feat <featsuttter@gmail.com>",
        subject: "I want the price od DSDR0099",
        inquiry:
          "Here i have attached the PO kindly find the attachment and share me the product details and specifications",
        evidenceFound: "No attachment detected in incoming email MIME structure. Product code 'DSDR0099' searched in master catalog: 0 exact matches found (closest matches: DSD-0090 Soap Dispenser, DSD-0100 Touchless).",
        generatedDraft:
          "Hi Suttter,\n\nThank you for reaching out to Dolphy India!\n\nI noticed that the PO mentioned in your email wasn't attached. Could you please re-attach or forward the document so we can review your exact item list and delivery location?\n\nAdditionally, I checked our master catalog and could not locate product code DSDR0099. We do have similar commercial models available such as our DSD-0090 Automatic Soap Dispenser and DSD-0100 Touchless Dispenser. If you have the product name, finish, or photo, share it with us and we will promptly send the spec sheet and tiered wholesale pricing.\n\nRegards,\nDolphy India Commercial Desk",
      }}
      capabilities={[
        {
          tag: "Catalog Grounding",
          title: "Zero-Hallucination SKU Lookup",
          desc: "If a buyer enters an incorrect or obsolete part number, ProxiPilot will never invent a fake price—it flags the mismatch and suggests catalog alternatives.",
        },
        {
          tag: "Attachment Smart",
          title: "Missing Attachment Warning",
          desc: "Automatically verifies incoming email headers to confirm whether buyers actually attached their RFQs, drawings, or purchase orders.",
        },
        {
          tag: "Wholesale Tiers",
          title: "MOQ & Pallet Rule Enforcement",
          desc: "Applies volume thresholds (e.g. 50+ units for tier 2 discount, master carton pack rules) directly into drafted quotes.",
        },
      ]}
      faqs={[
        {
          question: "How does ProxiPilot handle large product catalogs with thousands of SKUs?",
          answer:
            "ProxiPilot utilizes high-performance Qdrant vector retrieval with hybrid keyword matching. It handles catalogs with over 50,000 SKUs with sub-second retrieval latency.",
        },
        {
          question: "Can we update prices when manufacturers adjust their wholesale price sheets?",
          answer:
            "Yes! Simply upload your new CSV or Excel price sheet into the Knowledge Base. The old prices are replaced immediately in all future draft replies.",
        },
        {
          question: "Does ProxiPilot generate PDF quotes or invoices?",
          answer:
            "ProxiPilot drafts the email response and can provide structured tables or links to your ERP/quote generator for human review before sending.",
        },
      ]}
      relatedSolutions={[
        { title: "B2B Businesses", href: "/solutions/b2b-businesses", desc: "For contract negotiation and procurement" },
        { title: "E-commerce", href: "/solutions/ecommerce", desc: "For direct-to-consumer store operations" },
        { title: "Operations Teams", href: "/solutions/operations-teams", desc: "For warehouse and freight coordination" },
      ]}
    />
  );
}
