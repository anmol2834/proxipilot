import type { Metadata } from "next";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  IconArrowRight,
  IconArrowDown,
  IconPlayerPlayFilled,
  IconCircleCheckFilled,
  IconCheck,
  IconFileTypeCsv,
  IconFileSpreadsheet,
  IconPencil,
  IconFocus2,
  IconUsersGroup,
  IconCode,
  IconReportMoney,
} from "@tabler/icons-react";
import s from "./about.module.css";
import { JourneySection } from "./JourneySection";

export const metadata: Metadata = {
  title: "About Us — The Mission Behind ProxiPilot",
  description:
    "Learn why ProxiPilot was created: to eliminate inbox fatigue for modern commercial enterprises using grounded evidence, vector retrieval, and human-in-the-loop AI.",
  alternates: { canonical: "https://proxipilot.com/about" },
};

/** Marketing artwork is served near-lossless (see images.qualities in next.config). */
const Q = 95;

/* ------------------------------------------------------------------ */
/* Small brand marks + decorative strokes                              */
/* ------------------------------------------------------------------ */

function GoogleG({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Google" role="img">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 23 23" aria-label="Microsoft" role="img">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

function Swash({ color = "#7B5CFF" }: { color?: string }) {
  return (
    <svg className={s.swash} viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
      <path d="M3 13 C 50 5, 120 4, 197 9" stroke={color} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M30 17 C 80 12, 140 12, 180 14" stroke={color} strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function SparkMark() {
  return (
    <svg className={s.sparkMark} viewBox="0 0 30 30" aria-hidden="true">
      <path d="M6 14 L12 4" stroke="#7B8BFF" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M14 18 L24 10" stroke="#7B8BFF" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  // Art direction: wide composite on desktop, stacked portrait composite below 1100px.
  const common = {
    alt: "ProxiPilot inbox on a laptop: “Re: Product dimensions?” with “Evidence found — Product-Specs.pdf” and a draft marked “Ready for review”, surrounded by PDF, Word, Sheets, Gmail and Outlook icons",
    sizes: "100vw",
    quality: Q,
    loading: "eager" as const,
    fetchPriority: "high" as const,
  };
  const {
    props: { srcSet: desktopSet },
  } = getImageProps({ ...common, src: "/about/hero-bg-desktop.png", width: 2880, height: 1150 });
  const {
    props: { srcSet: mobileSet, ...imgProps },
  } = getImageProps({ ...common, src: "/about/hero-bg-mobile.png", width: 1200, height: 3000 });

  return (
    <section className={s.hero} aria-labelledby="about-hero-title">
      <picture className={s.heroBg}>
        <source media="(min-width: 1100px)" srcSet={desktopSet} sizes="100vw" />
        <source media="(max-width: 1099px)" srcSet={mobileSet} sizes="100vw" />
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img {...imgProps} />
      </picture>

      <div className={s.heroInner}>
        <div className={s.heroCopy}>
          <span className={s.pill}>About ProxiPilot / Our Mission</span>
          <h1 id="about-hero-title" className={s.heroTitle}>
            Great conversations start with <span className={s.highlight}>better intelligence.</span>
          </h1>
          <p className={s.heroSub}>Intelligent email automation, engineered with evidence and control.</p>
          <p className={s.heroText}>
            We believe email should not run your business. ProxiPilot connects your real corporate documentation to
            your inboxes, turning chaotic queues into accurate, pre-drafted workflows.
          </p>
          <div className={s.heroActions}>
            <Link href="#our-journey" className={s.btnPrimary}>
              Explore our story <IconArrowRight size={17} stroke={2.2} />
            </Link>
            <Link href="/how-it-works" className={s.btnGhost}>
              <span className={s.playDot}>
                <IconPlayerPlayFilled size={13} />
              </span>
              See how it works
            </Link>
          </div>
          <a href="#our-story" className={s.scrollHint}>
            <IconArrowDown size={20} stroke={1.8} /> Scroll to learn more
          </a>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section id="our-story" className={s.problem} aria-labelledby="about-problem-title">
      <div className={`${s.container} ${s.problemGrid}`}>
        <div className={s.problemMedia}>
          <Image
            src="/about/problem-inbox-questions.webp"
            alt="An agent at her laptop facing repeated customer questions: “What are the dimensions on this SKU?”, “Can you share volume pricing?”, “What’s your return policy?”"
            fill
            quality={Q}
            sizes="(max-width: 960px) 100vw, 680px"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div>
          <span className={s.pill}>The Problem</span>
          <h2 id="about-problem-title" className={s.h2}>
            <span className={s.titleWithMark}>
              The inbox became the bottleneck.
              <SparkMark />
            </span>
          </h2>
          <p className={s.lead}>
            Every day, support agents, account executives, and operations coordinators repeatedly answer questions
            about SKU dimensions, volume pricing and return policies, while the facts hide across PDFs, wikis and
            price matrices.
          </p>
          <p className={s.problemNote}>
            The inbox is modern business&rsquo;s biggest operational bottleneck. The same questions arrive hundreds of
            times &mdash; <em>What are the dimensions on this SKU? Can you send me volume pricing? How does your return
            policy work?</em> &mdash; while the answers already exist, locked away inside PDF spec sheets, Notion wikis,
            and pricing matrices. Agents waste hours copying, pasting, and searching across fragmented tools while
            customers wait hours for a reply.
          </p>
        </div>
      </div>
    </section>
  );
}

function Approach() {
  return (
    <section className={s.approach} aria-labelledby="about-approach-title">
      <div className={s.container}>
        <div className={s.centerHead}>
          <span className={s.pill}>The Approach</span>
          <h2 id="about-approach-title" className={s.h2}>
            Turn scattered knowledge into replies you can trust.
          </h2>
          <p className={s.subStrong}>Grounding AI in verifiable evidence.</p>
          <p className={s.approachIntro}>
            Instead of relying on generic chatbots that hallucinate plausible answers, ProxiPilot connects directly to
            your authorized Google Workspace or Microsoft 365 inbox.
          </p>
        </div>

        <div className={s.steps}>
          {/* 01 */}
          <article className={s.stepCard}>
            <div>
              <span className={s.numBadge}>01</span>
              <h3 className={s.cardTitle}>Connect your inbox</h3>
              <p className={s.cardText}>Link your Google Workspace or Microsoft 365 inbox.</p>
              <div className={s.brandRow}>
                <GoogleG size={24} />
                <MicrosoftMark size={22} />
              </div>
            </div>
            <div className={s.miniUi} aria-hidden="true">
              <div className={s.miniTitle}>Connect inbox</div>
              <div className={s.miniRow}>
                <GoogleG size={14} />
                <span className={s.grow}>Google Workspace</span>
                <IconCheck size={14} stroke={2.6} className={s.okDot} />
              </div>
              <div className={s.miniRow}>
                <MicrosoftMark size={13} />
                <span className={s.grow}>Microsoft 365</span>
                <IconCheck size={14} stroke={2.6} className={s.okDot} />
              </div>
            </div>
            <span className={s.stepConnector} aria-hidden="true" />
          </article>

          {/* 02 */}
          <article className={s.stepCard}>
            <div>
              <span className={s.numBadge}>02</span>
              <h3 className={s.cardTitle}>Ground every draft</h3>
              <p className={s.cardText}>
                Verify customer intent against approved company documents / Knowledge Base.
              </p>
            </div>
            <div className={s.miniUi} aria-hidden="true">
              <div className={s.miniTitle}>Knowledge Base</div>
              <div className={s.miniRow}>
                <IconFileSpreadsheet size={15} color="#1E8E3E" />
                <span className={s.grow}>Product Catalog.xlsx</span>
              </div>
              <div className={s.miniRow}>
                <IconFileTypeCsv size={15} color="#2F4FE8" />
                <span className={s.grow}>Return Policies.csv</span>
              </div>
              <div className={s.miniRow}>
                <IconFileSpreadsheet size={15} color="#1E8E3E" />
                <span className={s.grow}>Pricing Matrix.xlsx</span>
              </div>
            </div>
            <span className={s.stepConnector} aria-hidden="true" />
          </article>

          {/* 03 */}
          <article className={s.stepCard}>
            <div>
              <span className={s.numBadge}>03</span>
              <h3 className={s.cardTitle}>Human reviews &amp; sends</h3>
              <p className={s.cardText}>Review the AI draft, make any changes, and send with confidence.</p>
            </div>
            <div className={s.miniUi} aria-hidden="true">
              <div className={s.miniTitle}>Review Draft</div>
              <div className={s.skeleton} style={{ width: "92%" }} />
              <div className={s.skeleton} style={{ width: "78%" }} />
              <div className={s.skeleton} style={{ width: "86%" }} />
              <div className={s.skeleton} style={{ width: "54%" }} />
              <div className={s.miniActions}>
                <span className={s.miniApprove}>
                  <IconCheck size={12} stroke={3} /> Approve
                </span>
                <span className={s.miniEdit}>
                  <IconPencil size={12} stroke={2.2} /> Edit
                </span>
              </div>
            </div>
          </article>
        </div>

        <ul className={s.approachPoints}>
          <li>
            <IconCircleCheckFilled size={17} />
            Identifies customer intent and matches relevant catalog paragraphs with vector precision.
          </li>
          <li>
            <IconCircleCheckFilled size={17} />
            Pre-drafts contextual, brand-tailored replies in your agent&rsquo;s queue.
          </li>
          <li>
            <IconCircleCheckFilled size={17} />
            Keeps a human team member in sovereign control with one-click review and dispatch.
          </li>
        </ul>
      </div>
    </section>
  );
}

const PRINCIPLES = [
  {
    n: "01",
    title: "Evidence over generation",
    text: "AI facts, quotes and policy statements grounded in indexed documents.",
    detail:
      "We never let an AI model guess. Every fact, quote, and policy statement generated in a draft is anchored to an indexed document in your Knowledge Base.",
    img: "/about/principle-evidence.webp",
    alt: "Stack of documents under a magnifying glass",
  },
  {
    n: "02",
    title: "Human-in-the-loop velocity",
    text: "Reduce drafting time from 10 minutes to 5 seconds while humans stay in control.",
    detail:
      "Speed should never come at the cost of brand trust. We focus on cutting drafting time from 10 minutes to 5 seconds while keeping approval squarely in human hands.",
    img: "/about/principle-approve.webp",
    alt: "A hand pressing an Approve button on a draft",
  },
  {
    n: "03",
    title: "Non-training data sovereignty",
    text: "Emails are never used to train public models.",
    detail:
      "Customer communications are sacred. We enforce strict commercial non-training API contracts and isolated vector storage. Your emails are never used to train public models.",
    img: "/about/principle-shield-lock.webp",
    alt: "Shield with a padlock encircled by a ring",
  },
];

function Philosophy() {
  return (
    <section className={s.philosophy} aria-labelledby="about-philosophy-title">
      <div className={`${s.container} ${s.philoGrid}`}>
        <div className={s.philoHead}>
          <span className={s.pill}>Our Philosophy</span>
          <h2 id="about-philosophy-title" className={s.philoTitle}>
            Intelligence with <span className={s.swashWrap}>principles.<Swash /></span>
          </h2>
        </div>
        {PRINCIPLES.map((p) => (
          <article key={p.n} className={s.principle}>
            <div className={s.principleArt}>
              <Image src={p.img} alt={p.alt} fill quality={Q} sizes="(max-width: 960px) 45vw, 180px" />
            </div>
            <div className={s.principleBody}>
              <span className={s.numBadge}>{p.n}</span>
              <h3 className={s.cardTitle}>{p.title}</h3>
              <p className={s.cardText}>{p.text}</p>
            </div>
            <p className={s.principleDetail}>{p.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Mission() {
  return (
    <section className={s.mission} aria-labelledby="about-mission-title">
      <div className={s.container}>
        <div className={s.missionBanner}>
          <div className={s.missionPhoto}>
            <Image
              src="/about/mission-team-banner.webp"
              alt="The ProxiPilot team collaborating around a laptop"
              fill
              quality={Q}
              sizes="(max-width: 1280px) 100vw, 1200px"
            />
            <p className={s.missionQuote}>
              Technology should empower people, not replace their{" "}
              <span className={s.swashWrap}>
                judgment.
                <Swash color="#8F7BFF" />
              </span>
            </p>
          </div>
          <div className={s.missionCard}>
            <h2 id="about-mission-title" className={s.missionCardTitle}>
              <IconFocus2 size={18} stroke={2.2} /> Our Mission
            </h2>
            <p className={s.missionCardText}>
              Bring speed and trust to business communication with practical AI that&rsquo;s grounded in your real
              knowledge and always under human approval.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const TEAM = [
  { name: "Rishi Sinha", role: "Leadership", img: "/about/team-rishi-sinha.png", Icon: IconUsersGroup },
  { name: "Suryansh Pandey", role: "Finance", img: "/about/team-suryansh-pandey.png", Icon: IconReportMoney },
  { name: "Anmol Sinha", role: "Product & Engineering", img: "/about/team-anmol-sinha.png", Icon: IconCode },
];

function Team() {
  return (
    <section className={s.team} aria-labelledby="about-team-title">
      <div className={s.container}>
        <div className={s.centerHead}>
          <span className={s.pill}>Our Team</span>
          <h2 id="about-team-title" className={s.h2}>
            The people behind ProxiPilot.
          </h2>
          <p className={s.lead} style={{ marginTop: 8, fontSize: 14.5 }}>
            Built by people who believe better work is possible.
          </p>
        </div>
        <ul className={s.teamGrid}>
          {TEAM.map(({ name, role, img, Icon }) => (
            <li key={name} className={s.teamCard}>
              <div className={s.avatarRing}>
                <div className={s.avatar}>
                  <Image src={img} alt={`${name}, ${role} at ProxiPilot`} fill quality={Q} sizes="156px" />
                </div>
              </div>
              <h3 className={s.teamName}>{name}</h3>
              <span className={s.teamChip}>
                <Icon size={14} stroke={2.2} /> {role}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className={s.trust} aria-label="Company and security">
      <div className={s.container}>
        <div className={s.trustPanel}>
          <div className={`${s.trustCol} ${s.trustLead}`}>
            <div className={s.trustArt}>
              <Image
                src="/about/trust-cloud-shield.webp"
                alt="Cloud protected by a shield with a check mark"
                fill
                quality={Q}
                sizes="190px"
              />
            </div>
            <div>
              <span className={`${s.eyebrow} ${s.eyebrowBlue}`}>Building trust into every layer</span>
              <h2 className={s.trustTitle}>Security &amp; Compliance by Design</h2>
              <p className={s.trustText}>
                We combine strong security, clear data practices, and enterprise-grade operations so you can use
                ProxiPilot with confidence.
              </p>
            </div>
          </div>

          <div className={s.trustCol}>
            <span className={s.eyebrow}>Operated by</span>
            <h3 className={s.trustTitleSm}>Operated by Cheldain</h3>
            <p className={s.trustText}>
              ProxiPilot is engineered and operated globally by <strong>Cheldain</strong>, an enterprise software
              organization incorporated in India, serving customers worldwide.
            </p>
            <p className={s.trustNote}>
              Global payments and tax remittances handled by authorized Merchant of Record partners (Paddle &amp; Lemon
              Squeezy).
            </p>
          </div>

          <div className={s.trustCol}>
            <span className={s.eyebrow}>Security &amp; Compliance</span>
            <h3 className={s.trustTitleSm}>Transparent Standards</h3>
            <ul className={s.checks}>
              <li>
                <IconCheck size={17} stroke={2.6} /> Google API Limited Use &amp; OAuth Verification compliant
              </li>
              <li>
                <IconCheck size={17} stroke={2.6} /> GDPR Art. 28 Data Processing Agreement &amp; EU SCCs support
              </li>
              <li>
                <IconCheck size={17} stroke={2.6} /> AES-256 database encryption &amp; TLS 1.3 transit security
              </li>
              <li>
                <IconCheck size={17} stroke={2.6} /> 99.9% targeted uptime with enterprise SLA commitments
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className={s.cta} aria-labelledby="about-cta-title">
      <Image
        src="/about/cta-envelope-banner.webp"
        alt=""
        fill
        quality={Q}
        sizes="100vw"
        className={s.ctaBg}
      />
      <div className={s.ctaInner}>
        <h2 id="about-cta-title" className={s.ctaTitle}>
          Make space for the work that matters.
        </h2>
        <p className={s.ctaText}>
          Experience intelligent email triage today. Connect your Google or Microsoft inbox in 2 minutes &mdash; free
          trial included with zero card commitment.
        </p>
        <div className={s.ctaActions}>
          <Link href="/signup" className={s.btnWhite}>
            Start Free Trial <IconArrowRight size={16} stroke={2.2} />
          </Link>
          <Link href="/contact" className={s.btnOutlineLight}>
            Talk to Sales
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className={s.page}>
      <LandingNavbar />
      <main className={s.main}>
        <Hero />
        <Problem />
        <Approach />
        <Philosophy />
        <JourneySection />
        <Mission />
        <Team />
        <Trust />
        <Cta />
      </main>
      <LandingFooter />
    </div>
  );
}
