import Link from "next/link";
import React from "react";

export function FeatureSection() {
  return (
    <div id="modules" className="ml-storytelling-wrapper">
      {/* ── Story 1: People ── */}
      <section
        className="ml-story-section ml-story-section--white"
        aria-labelledby="story-people-title"
      >
        <div className="ml-container ml-story-grid">
          <div className="ml-story-copy">
            <span className="ml-story-kicker">
              01 · People &amp; Attendance
            </span>
            <h2 id="story-people-title" className="ml-heading ml-story-heading">
              People, without the HR maze.
            </h2>
            <p className="ml-body-lg ml-story-lead">
              A clean employee record that stays accurate as your team
              expands—without hiring an operations army or wrestling with
              fragmented spreadsheets.
            </p>
            <ul className="ml-story-points" role="list">
              <li className="ml-story-point">
                <span className="ml-point-icon">✓</span>
                <div>
                  <strong>Automated leave accruals</strong>
                  <p>
                    PTO and sick leave balances update the instant a manager
                    approves a request.
                  </p>
                </div>
              </li>
              <li className="ml-story-point">
                <span className="ml-point-icon">✓</span>
                <div>
                  <strong>Multi-office holiday calendars</strong>
                  <p>
                    Pre-loaded public holidays across regional hubs with custom
                    company non-working dates.
                  </p>
                </div>
              </li>
              <li className="ml-story-point">
                <span className="ml-point-icon">✓</span>
                <div>
                  <strong>Clear team directory</strong>
                  <p>
                    Quick lookup for roles, departments, office locations, and
                    real-time presence.
                  </p>
                </div>
              </li>
            </ul>
            <div className="ml-story-cta">
              <Link href="/sign-in" className="ml-btn-secondary">
                Explore people in Manut →
              </Link>
            </div>
          </div>

          <div className="ml-story-visual">
            <div className="ml-mock-window">
              <div className="ml-card-chrome">
                <div className="ml-card-dots" aria-hidden="true">
                  <span className="ml-dot" />
                  <span className="ml-dot" />
                  <span className="ml-dot" />
                </div>
                <span className="ml-card-title">
                  Employee Portal · Leave &amp; Accrual
                </span>
              </div>
              <div className="ml-mock-content">
                <div className="ml-scene-profile">
                  <div className="ml-avatar ml-avatar--purple ml-avatar--lg">
                    ST
                  </div>
                  <div className="ml-scene-user">
                    <span className="ml-scene-name">Sarun Techaporn</span>
                    <span className="ml-scene-role">
                      Senior Product Designer · Design &amp; UX
                    </span>
                  </div>
                  <span className="ml-badge ml-badge--green">Full-time</span>
                </div>

                <div className="ml-scene-balances">
                  <div className="ml-balance-box">
                    <span className="ml-bal-type">Annual Leave</span>
                    <div className="ml-bal-nums">
                      <span className="ml-bal-current">11</span>
                      <span className="ml-bal-total">/ 15 days</span>
                    </div>
                    <div className="ml-progress-bar">
                      <div
                        className="ml-progress-fill"
                        style={{ width: "73%" }}
                      />
                    </div>
                  </div>

                  <div className="ml-balance-box">
                    <span className="ml-bal-type">Sick Leave</span>
                    <div className="ml-bal-nums">
                      <span className="ml-bal-current">28</span>
                      <span className="ml-bal-total">/ 30 days</span>
                    </div>
                    <div className="ml-progress-bar">
                      <div
                        className="ml-progress-fill"
                        style={{ width: "93%" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="ml-scene-record">
                  <div className="ml-record-top">
                    <span className="ml-record-badge">Approved Request</span>
                    <span className="ml-record-date">
                      Sep 7 – Sep 9, 2026 (3 days)
                    </span>
                  </div>
                  <p className="ml-record-note">
                    Annual leave for family relocation. Covered by Pim K. for
                    pending sprint handoffs.
                  </p>
                  <span className="ml-record-audit">
                    Decided by Maya Lin (HR Lead) · Auto-deducted
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Story 2: Money ── */}
      <section
        className="ml-story-section ml-story-section--gray"
        aria-labelledby="story-money-title"
      >
        <div className="ml-container ml-story-grid ml-story-grid--reverse">
          <div className="ml-story-visual">
            <div className="ml-mock-window">
              <div className="ml-card-chrome">
                <div className="ml-card-dots" aria-hidden="true">
                  <span className="ml-dot" />
                  <span className="ml-dot" />
                  <span className="ml-dot" />
                </div>
                <span className="ml-card-title">
                  Expense Approval · Chain #EXP-4102
                </span>
              </div>
              <div className="ml-mock-content">
                <div className="ml-scene-spend-header">
                  <div>
                    <span className="ml-kicker">Department: Engineering</span>
                    <h4 className="ml-spend-title">
                      Cloud Infrastructure Renewal
                    </h4>
                  </div>
                  <span className="ml-spend-figure">$3,850.00</span>
                </div>

                <div className="ml-chain-list">
                  <div className="ml-chain-item ml-chain-item--passed">
                    <div className="ml-chain-badge">✓</div>
                    <div className="ml-chain-details">
                      <div className="ml-chain-row">
                        <span className="ml-chain-step">
                          Step 1: Department Manager
                        </span>
                        <span className="ml-chain-status">Approved</span>
                      </div>
                      <span className="ml-chain-meta">
                        Sarun Techaporn · Sep 2, 2026, 09:14 AM
                      </span>
                      <p className="ml-chain-note">
                        &ldquo;Validated against quarterly infrastructure budget
                        limit.&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="ml-chain-item ml-chain-item--current">
                    <div className="ml-chain-badge">●</div>
                    <div className="ml-chain-details">
                      <div className="ml-chain-row">
                        <span className="ml-chain-step">
                          Step 2: Finance Controller
                        </span>
                        <span
                          className={`ml-chain-status ml-chain-status--active`}
                        >
                          In Review
                        </span>
                      </div>
                      <span className="ml-chain-meta">
                        Alisa Vance · Assigned Sep 2, 2026
                      </span>
                      <p className="ml-chain-note">
                        Withholding tax document verification in progress.
                      </p>
                    </div>
                  </div>

                  <div className="ml-chain-item ml-chain-item--future">
                    <div className="ml-chain-badge">○</div>
                    <div className="ml-chain-details">
                      <div className="ml-chain-row">
                        <span className="ml-chain-step">
                          Step 3: Executive Sign-off
                        </span>
                        <span className="ml-chain-status">
                          Threshold &gt; $3,000
                        </span>
                      </div>
                      <span className="ml-chain-meta">
                        Automatic trigger on step 2 completion
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ml-audit-seal">
                  <span className="ml-seal-icon">🔒</span>
                  <span>
                    Cryptographic decision trail sealed on completion ·
                    Non-repudiable
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="ml-story-copy">
            <span className="ml-story-kicker">02 · Spend &amp; Approvals</span>
            <h2 id="story-money-title" className="ml-heading ml-story-heading">
              Money with a paper trail.
            </h2>
            <p className="ml-body-lg ml-story-lead">
              Every spend request, cash advance, and vendor payout leaves an
              audit trail your accountant and leadership can trust.
            </p>
            <ul className="ml-story-points" role="list">
              <li className="ml-story-point">
                <span className="ml-point-icon">✓</span>
                <div>
                  <strong>Configurable approval stages</strong>
                  <p>
                    Set custom threshold rules that escalate large purchases to
                    directors automatically.
                  </p>
                </div>
              </li>
              <li className="ml-story-point">
                <span className="ml-point-icon">✓</span>
                <div>
                  <strong>Decision history snapshots</strong>
                  <p>
                    Every approval records who agreed, when they acted, and
                    their written rationale.
                  </p>
                </div>
              </li>
              <li className="ml-story-point">
                <span className="ml-point-icon">✓</span>
                <div>
                  <strong>No lost receipts</strong>
                  <p>
                    Receipt attachments remain pinned directly to the approved
                    expense record forever.
                  </p>
                </div>
              </li>
            </ul>
            <div className="ml-story-cta">
              <Link href="/sign-in" className="ml-btn-secondary">
                Explore finance in Manut →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Story 3: Work ── */}
      <section
        className="ml-story-section ml-story-section--white"
        aria-labelledby="story-work-title"
      >
        <div className="ml-container ml-story-grid">
          <div className="ml-story-copy">
            <span className="ml-story-kicker">
              03 · Projects &amp; Delivery
            </span>
            <h2 id="story-work-title" className="ml-heading ml-story-heading">
              Work that already has a board.
            </h2>
            <p className="ml-body-lg ml-story-lead">
              Sales leads, team projects, and client deliverables on boards with
              stages you control—not another unwieldy spreadsheet masquerading
              as a project tool.
            </p>
            <ul className="ml-story-points" role="list">
              <li className="ml-story-point">
                <span className="ml-point-icon">✓</span>
                <div>
                  <strong>Configurable pipeline stages</strong>
                  <p>
                    Define stage names, ordering, and completion criteria suited
                    to your business model.
                  </p>
                </div>
              </li>
              <li className="ml-story-point">
                <span className="ml-point-icon">✓</span>
                <div>
                  <strong>Explicit owners &amp; deadlines</strong>
                  <p>
                    Every card carries single-owner accountability, priority
                    indicators, and SLA targets.
                  </p>
                </div>
              </li>
              <li className="ml-story-point">
                <span className="ml-point-icon">✓</span>
                <div>
                  <strong>Server-side roll-ups</strong>
                  <p>
                    Instant pipeline valuations and progress totals calculated
                    across all active pages.
                  </p>
                </div>
              </li>
            </ul>
            <div className="ml-story-cta">
              <Link href="/sign-in" className="ml-btn-secondary">
                Explore boards in Manut →
              </Link>
            </div>
          </div>

          <div className="ml-story-visual">
            <div className="ml-mock-window">
              <div className="ml-card-chrome">
                <div className="ml-card-dots" aria-hidden="true">
                  <span className="ml-dot" />
                  <span className="ml-dot" />
                  <span className="ml-dot" />
                </div>
                <span className="ml-card-title">
                  Project Board · Q3 Deliverables
                </span>
              </div>
              <div className="ml-mock-content">
                <div className="ml-board-summary">
                  <div>
                    <span className="ml-kicker">Active Workspace</span>
                    <h4 className="ml-board-name">Core Operations Sprint</h4>
                  </div>
                  <div className="ml-board-stats">
                    <span className="ml-badge ml-badge--violet">
                      8 Active Tasks
                    </span>
                    <span className="ml-badge ml-badge--green">
                      94% On Schedule
                    </span>
                  </div>
                </div>

                <div className="ml-board-mini-grid">
                  <div className="ml-mini-col">
                    <span className="ml-mini-col-title">In Review (2)</span>
                    <div className="ml-mini-card">
                      <span className="ml-badge ml-badge--amber">Urgent</span>
                      <span className="ml-mini-card-text">
                        Tax Invoice Withholding Generator
                      </span>
                      <span className="ml-mini-owner">👤 Alisa V.</span>
                    </div>
                  </div>

                  <div className="ml-mini-col">
                    <span className="ml-mini-col-title">Completed (3)</span>
                    <div className="ml-mini-card">
                      <span className="ml-badge ml-badge--slate">Shipped</span>
                      <span className="ml-mini-card-text">
                        Q3 Investor Board Dataroom
                      </span>
                      <span className="ml-mini-owner">👤 Jessica W.</span>
                    </div>
                    <div className="ml-mini-card">
                      <span className="ml-badge ml-badge--slate">Shipped</span>
                      <span className="ml-mini-card-text">
                        PWA Push Notification Triggers
                      </span>
                      <span className="ml-mini-owner">👤 Danial C.</span>
                    </div>
                  </div>
                </div>

                <div className="ml-scene-note">
                  <span>
                    ✦ Real-time stage updates prevent delivery blockers across
                    teams.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Security & Governance ── */}
      <section
        id="security"
        className="ml-security-section ml-container"
        aria-labelledby="security-title"
      >
        <div className="ml-security-intro">
          <span className="ml-tag">Trust &amp; Architecture</span>
          <h2 id="security-title" className="ml-heading ml-security-heading">
            Security that stays out of your way.
          </h2>
          <p className="ml-body-lg ml-security-lead">
            Manut pairs consumer-grade simplicity with enterprise-grade access
            boundaries. Your team gets clarity; your operations remain
            completely defensible.
          </p>
        </div>

        <div className="ml-security-cards">
          <div className="ml-sec-card">
            <div className="ml-sec-icon">🛡️</div>
            <h3 className="ml-sec-title">Role-based access (RBAC)</h3>
            <p className="ml-sec-body">
              Every staff member sees only what their role permits. Built-in
              permission gates isolate confidential payroll, performance
              evaluations, and financial ledgers.
            </p>
          </div>

          <div className="ml-sec-card">
            <div className="ml-sec-icon">📜</div>
            <h3 className="ml-sec-title">Immutable decision records</h3>
            <p className="ml-sec-body">
              Approvals capture the decider&apos;s identity, assigned role, and
              exact timestamp. Past decisions cannot be backdated or edited
              after submission.
            </p>
          </div>

          <div className="ml-sec-card">
            <div className="ml-sec-icon">🔐</div>
            <h3 className="ml-sec-title">Encrypted session auth</h3>
            <p className="ml-sec-body">
              Cryptographically signed tokens, httpOnly cookie transport, CSRF
              protection, and safe same-origin redirects defend against
              unauthorized access.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
