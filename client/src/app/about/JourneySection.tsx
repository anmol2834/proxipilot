import Link from "next/link";
import {
  IconBulb,
  IconFileSearch,
  IconPlugConnected,
  IconShieldCheck,
  IconRocket,
  IconArrowUpRight,
  IconPlaneTilt,
} from "@tabler/icons-react";
import j from "./journey.module.css";

/**
 * "Our story & journey" — a flight-path timeline on a light lavender panel.
 * Desktop: chapters alternate above/below a curved route ending in the ProxiPilot plane.
 * Below 1100px: a vertical route with the same chapters in order.
 *
 * Chapters are deliberately undated: add real years/milestones here when known.
 */

const CHAPTERS = [
  {
    n: "01",
    stage: "The spark",
    title: "Teams were drowning in repeat questions",
    text: "We watched support agents, account executives and operations coordinators answer the same SKU, pricing and policy questions hundreds of times, while the answers sat in PDFs, wikis and price matrices.",
    chips: ["Inbox fatigue", "Fragmented knowledge"],
    Icon: IconBulb,
  },
  {
    n: "02",
    stage: "The principle",
    title: "Evidence before eloquence",
    text: "An AI draft is only useful if every fact traces back to your own documents. When the evidence isn’t there, ProxiPilot asks for clarification instead of guessing.",
    chips: ["Grounded drafts", "No guessing"],
    Icon: IconFileSearch,
  },
  {
    n: "03",
    stage: "The build",
    title: "Inside the inboxes teams already use",
    text: "We built ProxiPilot as an intelligence layer on Gmail and Outlook, with vector retrieval over your Knowledge Base, so nobody changes addresses, clients or workflows.",
    chips: ["Google Workspace", "Microsoft 365", "Vector retrieval"],
    Icon: IconPlugConnected,
  },
  {
    n: "04",
    stage: "The trust layer",
    title: "Security as a feature, not a footnote",
    text: "Google API Limited Use & OAuth verification, GDPR Art. 28 DPA support, AES-256 encryption and a strict non-training commitment make it safe for real customer conversations.",
    chips: ["OAuth verified", "GDPR DPA", "AES-256"],
    Icon: IconShieldCheck,
  },
  {
    n: "05",
    stage: "Today & next",
    title: "Drafts in seconds, people in control",
    text: "Teams go from 10-minute drafts to 5-second, evidence-backed replies they review and send. Next: more ways to put your knowledge to work — always with a person in the loop.",
    chips: ["Human-in-the-loop"],
    Icon: IconRocket,
    next: true,
  },
] as const;

const STATS = [
  { value: "10m → 5s", label: "Drafting time per reply" },
  { value: "0", label: "Emails used to train public models" },
  { value: "AES-256", label: "Encryption, with TLS 1.3 in transit" },
  { value: "99.9%", label: "Targeted uptime with SLA commitments" },
];

/* Route geometry (viewBox 1200 x 160). Node i sits at the centre of grid column i. */
const VB_W = 1200;
const VB_H = 160;
const UP = 42;
const DOWN = 118;
const NODES = CHAPTERS.map((_, i) => ({ x: ((i + 0.5) / CHAPTERS.length) * VB_W, y: i % 2 === 0 ? UP : DOWN }));
const ROUTE_PTS = [{ x: -20, y: 92 }, ...NODES, { x: VB_W + 30, y: 6 }];

/** Catmull-Rom → cubic Bézier: a smooth curve through every node. */
function smoothPath(pts: { x: number; y: number }[]) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x} ${p2.y}`;
  }
  return d;
}
const ROUTE = smoothPath(ROUTE_PTS);

function FlightRoute() {
  // Static artwork only (no filters, no continuous animation) to keep scrolling smooth.
  const last = NODES[NODES.length - 1];
  const exit = ROUTE_PTS[ROUTE_PTS.length - 1];
  const angle = (Math.atan2(exit.y - last.y, exit.x - last.x) * 180) / Math.PI;
  const plane = { x: last.x + (exit.x - last.x) * 0.55, y: last.y + (exit.y - last.y) * 0.55 - 4 };
  return (
    <svg className={j.route} viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="jr-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3D63FF" />
          <stop offset="55%" stopColor="#7B5CFF" />
          <stop offset="100%" stopColor="#B57BFF" />
        </linearGradient>
      </defs>

      {/* stems joining each node to its card */}
      {NODES.map((p, i) => (
        <line key={`stem-${i}`} className={j.stem} x1={p.x} x2={p.x} y1={p.y} y2={i % 2 === 0 ? 0 : VB_H} />
      ))}

      {/* the route: soft wide underlay + crisp line + dotted overlay */}
      <path d={ROUTE} className={j.routeHalo} />
      <path d={ROUTE} className={j.routeBase} stroke="url(#jr-line)" />
      <path d={ROUTE} className={j.routeDots} />

      {NODES.map((p, i) => (
        <g key={`node-${i}`}>
          <circle cx={p.x} cy={p.y} r="15" fill="#E9E8FF" />
          <circle cx={p.x} cy={p.y} r="10" fill="#FFFFFF" stroke="url(#jr-line)" strokeWidth="2.5" />
          <circle cx={p.x} cy={p.y} r="4" fill="#4C5BFF" />
        </g>
      ))}

      {/* the ProxiPilot plane heading off the route */}
      <g transform={`translate(${plane.x} ${plane.y}) rotate(${angle.toFixed(1)})`}>
        <path d="M-13 -9 L15 0 L-13 9 L-6 0 Z" fill="#3D63FF" />
        <path d="M-6 0 L15 0 L-13 9 Z" fill="#7B5CFF" />
      </g>
    </svg>
  );
}

export function JourneySection() {
  return (
    <section id="our-journey" className={j.section} aria-labelledby="about-journey-title">
      <div className={j.container}>
        <div className={j.panel}>
          <div className={j.aurora} aria-hidden="true" />
          <div className={j.dots} aria-hidden="true" />

          <header className={j.head}>
            <div>
              <span className={j.pill}>
                <IconPlaneTilt size={13} stroke={2.2} /> Our Story &amp; Journey
              </span>
              <h2 id="about-journey-title" className={j.title}>
                From inbox fatigue to <span className={j.titleGlow}>evidence-grounded</span> replies.
              </h2>
            </div>
            <div className={j.headAside}>
              <p className={j.lead}>
                ProxiPilot didn&rsquo;t start with a model. It started with a simple observation: the answers already
                existed, but the people answering emails couldn&rsquo;t reach them fast enough.
              </p>
              <p className={j.signature}>
                Engineered and operated by <strong>Cheldain</strong>
              </p>
            </div>
          </header>

          <ol className={j.board}>
            {CHAPTERS.map(({ n, stage, title, text, chips, Icon, ...rest }, i) => {
              const isNext = "next" in rest && rest.next;
              return (
                <li
                  key={n}
                  className={`${j.card} ${i % 2 === 0 ? j.cardUp : j.cardDown} ${isNext ? j.cardNext : ""}`}
                  data-i={i}
                >
                  <span className={j.ghostNum} aria-hidden="true">
                    {n}
                  </span>
                  <div className={j.cardTop}>
                    <span className={j.iconTile}>
                      <Icon size={20} stroke={1.9} />
                    </span>
                    <span className={j.stage}>
                      <span className={j.srOnly}>Chapter {n}: </span>
                      {stage}
                    </span>
                  </div>
                  <h3 className={j.cardTitle}>{title}</h3>
                  <p className={j.cardText}>{text}</p>
                  <div className={j.chips}>
                    {chips.map((c) => (
                      <span key={c} className={j.chip}>
                        {c}
                      </span>
                    ))}
                    {isNext && (
                      <Link href="/features#roadmap" className={`${j.chip} ${j.chipLink}`}>
                        Product roadmap <IconArrowUpRight size={12} stroke={2.4} />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
            <li className={j.routeRow} aria-hidden="true">
              <FlightRoute />
            </li>
          </ol>

          <dl className={j.stats}>
            {STATS.map((s) => (
              <div key={s.label} className={j.stat}>
                <dt className={j.statLabel}>{s.label}</dt>
                <dd className={j.statValue}>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
