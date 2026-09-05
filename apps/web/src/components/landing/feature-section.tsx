import Link from "next/link";

const FEATURES = [
  {
    title: "People, without the HR maze",
    body: "Leave, attendance, payroll, and directories in one place — so growing teams keep a clean people record without hiring an ops army.",
    href: "/sign-in",
    cta: "Explore people →",
  },
  {
    title: "Money with a paper trail",
    body: "Expenses, advances, and approvals that leave an audit trail. Every spend lands with a decision history your accountant can trust.",
    href: "/sign-in",
    cta: "Explore finance →",
  },
  {
    title: "Work that already has a board",
    body: "Sales, projects, and partner work on boards with stages you control — not another spreadsheet masquerading as a CRM.",
    href: "/sign-in",
    cta: "Explore work →",
  },
] as const;

export function FeatureSection() {
  return (
    <section id="modules" className="ml-features ml-container">
      <div className="ml-features-intro">
        <h2 className="ml-heading" style={{ marginBottom: 12 }}>
          Three desks. One manuscript.
        </h2>
        <p className="ml-body-lg">
          Manut is built for SMEs that need structure without enterprise bloat —
          editorial calm on the surface, serious ops underneath.
        </p>
      </div>

      <div className="ml-feature-grid">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="ml-feature-card">
            <h3 className="ml-section-title">{feature.title}</h3>
            <p className="ml-body-muted">{feature.body}</p>
            <Link href={feature.href} className="ml-link-ghost">
              {feature.cta}
            </Link>
          </article>
        ))}
      </div>

      <div id="security" style={{ marginTop: 64, maxWidth: 640 }}>
        <h2 className="ml-section-title" style={{ marginBottom: 12 }}>
          Security that stays out of the way
        </h2>
        <p className="ml-body-muted">
          Role-based access, signed-in sessions, and approval chains that
          snapshot who decided what. Your team gets clarity; your books stay
          defensible.
        </p>
      </div>
    </section>
  );
}
