import type { Metadata } from "next";
import { SolutionPageShell } from "@/components/solutions/SolutionPageShell";
import {
  IconShoppingCart,
  IconTruckDelivery,
  IconReceipt2,
} from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "AI Email Automation for E-commerce & Retail — ProxiPilot",
  description:
    "Automate e-commerce customer service emails with precision. Handle order status questions, return policy inquiries, and product questions grounded in your verified catalog.",
  alternates: { canonical: "https://proxipilot.com/solutions/ecommerce" },
};

export default function EcommerceSolutionPage() {
  return (
    <SolutionPageShell
      badge="E-commerce & Retail"
      title="Turn high-volume customer inquiries into instant, grounded answers."
      subtitle="From order tracking and delivery estimates to return policies and product sizing: ProxiPilot reads customer emails, checks your official store policies, and drafts accurate, brand-aligned replies."
      highlightStats={[
        { value: "70%", label: "Faster response during peak sales" },
        { value: "0", label: "Contradictory policy explanations" },
        { value: "100%", label: "Brand tone consistency" },
        { value: "24/7", label: "Draft readiness for morning reviews" },
      ]}
      painPointsTitle="Common email headaches for online merchants"
      painPoints={[
        {
          title: "Holiday & promotional order spikes",
          desc: "During Black Friday, cyber week, or flash sales, customer inboxes overflow with 'Where is my order?' emails that overwhelm staff.",
          icon: <IconTruckDelivery size={20} />,
        },
        {
          title: "Customers forgetting order numbers",
          desc: "Buyers ask complex questions about returns or exchanges without mentioning their order ID, requiring back-and-forth emails.",
          icon: <IconReceipt2 size={20} />,
        },
        {
          title: "Confusing return & warranty policies",
          desc: "Different products have different return windows, restocking fees, and condition requirements that customer reps struggle to keep straight.",
          icon: <IconShoppingCart size={20} />,
        },
      ]}
      workflowTitle="How ProxiPilot powers e-commerce inboxes"
      workflowSubtitle="Precision guidance that protects merchant revenue and customer loyalty."
      workflowSteps={[
        {
          step: "01",
          title: "Upload Store Policies & Catalog",
          desc: "Sync your store return rules, warranty terms, shipping carriers, and product specification sheets.",
        },
        {
          step: "02",
          title: "Inbound Email Ingestion",
          desc: "Customer questions received at help@yourstore.com are parsed for intent, order context, and urgency.",
        },
        {
          step: "03",
          title: "Policy-Grounded Draft Creation",
          desc: "ProxiPilot checks warranty rules and drafts an empathetic reply with exact return instructions.",
        },
        {
          step: "04",
          title: "Review or Auto-Approve",
          desc: "Your team can review drafts with 1-click or enable auto-pilot for standardized tracking queries.",
        },
      ]}
      scenario={{
        title: "Typical Scenario: Return Window & Exchange Inquiry",
        sender: "David Chen <dchen.arch@gmail.com>",
        subject: "Order #84920 — Return request for unopened wireless headphones",
        inquiry:
          "Hi,\n\nI purchased the Pro Acoustics X9 headphones 12 days ago under Order #84920. The packaging is unopened and still factory sealed, but I was gifted another pair. Can I return this for a full refund, and do you provide a prepaid label?\n\nDavid",
        evidenceFound: "Policy Doc Section 3: 30-day unopened electronics eligible for 100% refund; Prepaid returns provided for original packaging items within Continental US.",
        generatedDraft:
          "Hi David,\n\nThank you for contacting customer care! Yes, because your Pro Acoustics X9 headphones are unopened and within our 30-day return window, your order (#84920) is fully eligible for a 100% refund.\n\nTo initiate your return:\n1. We have generated your prepaid return shipping label via USPS.\n2. Please pack the headphones securely in their original shipping box.\n3. Drop the package off at any authorized USPS location within 7 days.\n\nOnce our warehouse inspects the sealed package, your original payment method will be credited within 3-5 business days. Let us know if you need anything else!\n\nBest regards,\nCustomer Care Team",
      }}
      capabilities={[
        {
          tag: "Policy Strictness",
          title: "Restocking & Warranty Safeguards",
          desc: "Ensures agents never accidentally promise refunds outside the return window or waive restocking fees without authorization.",
        },
        {
          tag: "Clarifying Questions",
          title: "Missing Order ID Detection",
          desc: "Politely asks customers for their order number, billing zip code, or photo of damage before generating final solutions.",
        },
        {
          tag: "Catalog Specs",
          title: "Material & Sizing Answering",
          desc: "Pulls exact dimensions, battery capacities, and fabric compositions from your uploaded technical specs.",
        },
      ]}
      faqs={[
        {
          question: "Can ProxiPilot look up real-time live tracking numbers from Shopify or carrier APIs?",
          answer:
            "ProxiPilot grounds drafts in your uploaded policies and email thread context. For custom ERP or Shopify shipping API integrations, we provide webhook endpoints.",
        },
        {
          question: "What if a customer sends a hostile or angry email?",
          answer:
            "ProxiPilot detects escalated customer sentiment and prepares a calming, de-escalating draft that prioritizes empathy and resolution while flagging the thread for senior review.",
        },
        {
          question: "Can multiple support agents use ProxiPilot simultaneously?",
          answer:
            "Yes. ProxiPilot supports multi-seat teams with role-based permissions and shared workspace knowledge bases.",
        },
      ]}
      relatedSolutions={[
        { title: "Wholesale Businesses", href: "/solutions/wholesale-businesses", desc: "For bulk SKU and B2B orders" },
        { title: "Customer Support", href: "/solutions/customer-support", desc: "For dedicated service teams" },
        { title: "Small Business", href: "/solutions/small-business", desc: "For boutique store owners" },
      ]}
    />
  );
}
