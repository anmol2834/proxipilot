"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  IconCheck,
  IconMinus,
  IconPlus,
  IconGift,
  IconRefresh,
  IconLock,
  IconShieldCheck,
  IconFileSearch,
  IconMessageCircle,
  IconUserCheck,
  IconBrandGmail,
  IconAdjustments,
} from "@tabler/icons-react";
import {
  PLANS,
  COMPARISON,
  PRICING_FAQ,
  priceFor,
  priceNumber,
  type BillingCycle,
  type Plan,
} from "@/data/pricing-plans";
import p from "./pricing.module.css";

function Rich({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Link key={m.index} href={m[2]}>
        {m[1]}
      </Link>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p>{parts}</p>;
}

function billedNote(plan: Plan, cycle: BillingCycle) {
  const n = priceNumber(priceFor(plan, cycle));
  if (Number.isNaN(n)) return "Volume, security and billing tailored to you.";
  return cycle === "annual" ? `Billed $${(n * 12).toLocaleString("en-US")} once a year` : "Billed monthly";
}

function PlanCard({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  const custom = plan.id === "enterprise";
  const price = priceFor(plan, cycle);
  return (
    <article
      className={`${p.card} ${plan.highlight ? p.cardHighlight : ""} ${custom ? p.cardCustom : ""}`}
      aria-labelledby={`plan-${plan.id}`}
    >
      <div className={p.cardTop}>
        <h3 id={`plan-${plan.id}`} className={p.planName}>
          {plan.name}
        </h3>
        {plan.badge && <span className={p.popular}>{plan.badge}</span>}
      </div>
      <p className={p.tagline}>{plan.tagline}</p>

      <div className={p.priceRow}>
        {custom ? (
          <span className={p.price}>Let&rsquo;s talk.</span>
        ) : (
          <>
            <span className={p.price}>{price}</span>
            <span className={p.per}>/month</span>
          </>
        )}
      </div>
      <p className={p.billed}>{billedNote(plan, cycle)}</p>

      <hr className={p.rule} />
      <ul className={p.features}>
        {plan.features.map((f) => (
          <li key={f}>
            <IconCheck size={17} stroke={2.2} aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
      <hr className={p.rule} />

      <Link
        href={plan.ctaHref}
        className={`${p.cta} ${plan.highlight ? p.ctaPrimary : ""} ${custom ? p.ctaDark : ""}`}
        aria-label={`${plan.ctaText}: ${plan.name} plan`}
      >
        {plan.ctaText}
      </Link>
    </article>
  );
}

const INCLUDED = [
  {
    Icon: IconFileSearch,
    title: "Evidence-grounded drafts",
    text: "Every reply is built from facts in your own knowledge base, and gaps are flagged instead of guessed.",
  },
  {
    Icon: IconUserCheck,
    title: "Human review by default",
    text: "Drafts wait in your review queue. Nothing is sent until someone on your team approves it.",
  },
  {
    Icon: IconMessageCircle,
    title: "Isolated AI Reply Copilot",
    text: "Refine any draft inside its own thread, with no context leaking between customers.",
  },
  {
    Icon: IconAdjustments,
    title: "Tone presets",
    text: "Make it concise, add professional polish or warm it up in one click.",
  },
  {
    Icon: IconBrandGmail,
    title: "Gmail & Outlook",
    text: "Connect Google Workspace or Microsoft 365 through official OAuth, with no passwords or DNS changes.",
  },
  {
    Icon: IconLock,
    title: "Encryption & zero training",
    text: "AES-256 at rest, TLS 1.3 in transit, and your data is never used to train AI models.",
  },
];

const FIT: Record<Plan["id"], string> = {
  starter:
    "You run a single inbox, such as a founder's mailbox or a small support@ address, and want to see grounded AI drafts on real customer emails before rolling them out.",
  growth:
    "Your team handles hundreds of similar questions a week across a few shared inboxes and wants automation rules, intent tags and tone tuning to clear routine replies faster.",
  business:
    "You run several brands, regions or wholesale inboxes, need analytics and audit exports, and want a dedicated onboarding partner.",
  enterprise:
    "You need unlimited scale, a dedicated vector cluster, a custom DPA, ERP or CRM connectors, or procurement-friendly billing.",
};

function Cell({ v }: { v: string | boolean }) {
  if (v === true)
    return (
      <>
        <IconCheck size={18} stroke={2.4} className={p.yes} aria-hidden="true" />
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Included
        </span>
      </>
    );
  if (v === false)
    return (
      <>
        <IconMinus size={18} className={p.no} aria-hidden="true" />
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Not included</span>
      </>
    );
  return <>{v}</>;
}

export function PricingView() {
  const [cycle, setCycle] = useState<BillingCycle>("annual");
  const highlightCol = PLANS.findIndex((x) => x.highlight);

  return (
    <>
      <section className={p.hero} aria-labelledby="pricing-title">
        <div className={p.container}>
          <h1 id="pricing-title" className={p.title}>
            Choose the right plan for your inbox.
          </h1>
          <p className={p.subtitle}>
            Start small and scale as your inbox volume grows. Every plan includes evidence-grounded drafts, enterprise
            encryption and zero foundation model training.
          </p>

          <div className={p.switch} role="group" aria-label="Billing period">
            <button
              type="button"
              className={`${p.switchBtn} ${cycle === "monthly" ? p.switchOn : ""}`}
              aria-pressed={cycle === "monthly"}
              onClick={() => setCycle("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`${p.switchBtn} ${cycle === "annual" ? p.switchOn : ""}`}
              aria-pressed={cycle === "annual"}
              onClick={() => setCycle("annual")}
            >
              Annual <span className={p.save}>(save 20%)</span>
            </button>
          </div>

          <div className={p.plans}>
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} cycle={cycle} />
            ))}
          </div>

          <div className={p.trust}>
            <span>
              <IconGift size={17} stroke={1.8} aria-hidden="true" /> 14-day free trial, no card required
            </span>
            <span>
              <IconRefresh size={17} stroke={1.8} aria-hidden="true" /> Upgrade, downgrade or cancel anytime
            </span>
            <span>
              <IconShieldCheck size={17} stroke={1.8} aria-hidden="true" /> GDPR-ready with a signed DPA
            </span>
          </div>
        </div>
      </section>

      <section className={p.section} aria-labelledby="included-title">
        <div className={p.container}>
          <div className={p.sectionHead}>
            <h2 id="included-title" className={p.sectionTitle}>
              Included in every plan
            </h2>
            <p className={p.sectionText}>
              The core of ProxiPilot is the same on every tier. Plans differ in volume, automation and team features.
            </p>
          </div>
          <div className={p.includes}>
            {INCLUDED.map(({ Icon, title, text }) => (
              <div key={title} className={p.include}>
                <span className={p.includeIcon} aria-hidden="true">
                  <Icon size={21} stroke={1.8} />
                </span>
                <h3 className={p.includeTitle}>{title}</h3>
                <p className={p.includeText}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={p.section} aria-labelledby="compare-title">
        <div className={p.container}>
          <div className={p.sectionHead}>
            <h2 id="compare-title" className={p.sectionTitle}>
              Compare plans in detail
            </h2>
            <p className={p.sectionText}>Every limit and capability, side by side.</p>
          </div>
          <div className={p.tableWrap}>
            <table className={p.table}>
              <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                ProxiPilot plan comparison
              </caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  {PLANS.map((plan, i) => (
                    <th key={plan.id} scope="col" className={i === highlightCol ? p.colHighlight : undefined}>
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((g) => (
                  <React.Fragment key={g.group}>
                    <tr className={p.groupRow}>
                      <th scope="colgroup" colSpan={5}>
                        {g.group}
                      </th>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.label}>
                        <th scope="row">{r.label}</th>
                        {r.cells.map((c, i) => (
                          <td key={i} className={i === highlightCol ? p.colHighlight : undefined}>
                            <Cell v={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={p.section} aria-labelledby="fit-title">
        <div className={p.container}>
          <div className={p.sectionHead}>
            <h2 id="fit-title" className={p.sectionTitle}>
              Which plan is right for you?
            </h2>
            <p className={p.sectionText}>A quick guide based on how your team uses email today.</p>
          </div>
          <ul className={p.fitList}>
            {PLANS.map((plan) => (
              <li key={plan.id} className={p.fit}>
                <span className={p.fitName}>
                  {plan.name}
                  <span className={p.fitPrice}>
                    {plan.id === "enterprise"
                      ? "Custom pricing"
                      : `From ${plan.annualPrice}/month billed annually`}
                  </span>
                </span>
                <p className={p.fitText}>{FIT[plan.id]}</p>
                <Link href={plan.ctaHref} className={p.fitLink}>
                  {plan.id === "enterprise" ? "Talk to our team" : `Try ${plan.name} free`}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={p.section} aria-labelledby="pricing-faq-title">
        <div className={`${p.container} ${p.faqGrid}`}>
          <div className={p.faqIntro}>
            <h2 id="pricing-faq-title" className={p.sectionTitle}>
              Billing questions, answered
            </h2>
            <p className={p.sectionText}>
              Trials, annual savings, payments and plan changes. Need something else? Our team is happy to help.
            </p>
            <Link href="/faq/billing-plans" className={p.faqMore}>
              See all billing FAQs
            </Link>
          </div>
          <ul className={p.faqList}>
            {PRICING_FAQ.map((f, i) => (
              <li key={f.id}>
                <details id={f.id} className={p.faqItem} open={i === 0 || undefined}>
                  <summary>
                    <h3>{f.q}</h3>
                    <IconPlus size={19} stroke={1.8} className={p.faqPlus} aria-hidden="true" />
                  </summary>
                  <div className={p.faqAnswer}>
                    <Rich text={f.a} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={p.container}>
        <section className={p.band} aria-labelledby="band-title">
          <div>
            <h2 id="band-title" className={p.bandTitle}>
              Not sure which plan fits?
            </h2>
            <p className={p.bandText}>
              Start a free trial on any plan and switch at any time, or walk through your inbox with our team first.
            </p>
          </div>
          <div className={p.bandActions}>
            <Link href="/signup" className={`${p.cta} ${p.ctaPrimary}`}>
              Start free trial
            </Link>
            <Link href="/contact" className={p.cta}>
              Talk to sales
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
