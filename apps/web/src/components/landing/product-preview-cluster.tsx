import React from "react";

function WindowControls({ title }: { title: string }) {
  return (
    <div className="ml-card-chrome">
      <div className="ml-card-dots" aria-hidden="true">
        <span className="ml-dot" />
        <span className="ml-dot" />
        <span className="ml-dot" />
      </div>
      <span className="ml-card-title">{title}</span>
    </div>
  );
}

export function ProductPreviewCluster() {
  return (
    <div
      className="ml-hero-cluster"
      aria-label="Manut workspace interface demonstration"
    >
      {/* Left Card: People & Availability */}
      <div className="ml-cluster-card ml-cluster-card--left">
        <WindowControls title="Team Availability" />
        <div className="ml-cluster-body">
          <div className="ml-cluster-subhead">
            <span className="ml-subhead-label">People & Presence</span>
            <span className="ml-status-pill ml-status-pill--green">
              18 Active
            </span>
          </div>

          <div className="ml-people-list">
            <div className="ml-person-row">
              <div className="ml-avatar ml-avatar--purple">ST</div>
              <div className="ml-person-info">
                <span className="ml-person-name">Sarun Techaporn</span>
                <span className="ml-person-role">Design Lead · Bangkok</span>
              </div>
              <span className="ml-badge ml-badge--amber">PTO (3d)</span>
            </div>

            <div className="ml-person-row">
              <div className="ml-avatar ml-avatar--slate">AV</div>
              <div className="ml-person-info">
                <span className="ml-person-name">Alisa Vance</span>
                <span className="ml-person-role">VP Finance · Bangkok</span>
              </div>
              <span className="ml-badge ml-badge--green">In Office</span>
            </div>

            <div className="ml-person-row">
              <div className="ml-avatar ml-avatar--violet">DC</div>
              <div className="ml-person-info">
                <span className="ml-person-name">Danial Chen</span>
                <span className="ml-person-role">Lead Engineer · Remote</span>
              </div>
              <span className="ml-badge ml-badge--green">Available</span>
            </div>
          </div>

          <div className="ml-card-footer-note">
            <span>PTO balances update automatically on approval</span>
          </div>
        </div>
      </div>

      {/* Center Card: Unified Operations Central */}
      <div className="ml-cluster-card ml-cluster-card--center">
        <WindowControls title="Operations Central · Manut" />
        <div className="ml-cluster-body">
          <div className="ml-workspace-topbar">
            <div>
              <span className="ml-workspace-kicker">
                Today&apos;s Operations
              </span>
              <h3 className="ml-workspace-heading">Cross-team summary</h3>
            </div>
            <span className="ml-tag ml-tag--accent">Real-time sync</span>
          </div>

          <div className="ml-metrics-strip">
            <div className="ml-metric-cell">
              <span className="ml-metric-val">3</span>
              <span className="ml-metric-lbl">Pending sign-offs</span>
            </div>
            <div className="ml-metric-cell">
              <span className="ml-metric-val">$14.2k</span>
              <span className="ml-metric-lbl">Spend reviewed</span>
            </div>
            <div className="ml-metric-cell">
              <span className="ml-metric-val">12</span>
              <span className="ml-metric-lbl">Sprint tasks done</span>
            </div>
          </div>

          <div
            className="ml-activity-stream"
            aria-label="Recent activity across departments"
          >
            <div className="ml-activity-item">
              <div className="ml-act-icon ml-act-icon--violet">✦</div>
              <div className="ml-act-main">
                <div className="ml-act-row">
                  <span className="ml-act-subject">Leave approved</span>
                  <span className="ml-act-time">8m ago</span>
                </div>
                <p className="ml-act-desc">
                  Maya Lin (HR) approved 3 days Annual Leave for Sarun T.
                </p>
              </div>
            </div>

            <div className="ml-activity-item">
              <div className="ml-act-icon ml-act-icon--amber">$</div>
              <div className="ml-act-main">
                <div className="ml-act-row">
                  <span className="ml-act-subject">Expense advance review</span>
                  <span className="ml-act-time">24m ago</span>
                </div>
                <p className="ml-act-desc">
                  Cloud Infrastructure Renewal ($3,450) reached Finance stage
                </p>
              </div>
            </div>

            <div className="ml-activity-item">
              <div className="ml-act-icon ml-act-icon--slate">✓</div>
              <div className="ml-act-main">
                <div className="ml-act-row">
                  <span className="ml-act-subject">Board stage updated</span>
                  <span className="ml-act-time">1h ago</span>
                </div>
                <p className="ml-act-desc">
                  Q3 Investor Dataroom moved from In Review to Shipped
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Card: Approvals & Audit Trail */}
      <div className="ml-cluster-card ml-cluster-card--right">
        <WindowControls title="Approval Chain · EXP-2041" />
        <div className="ml-cluster-body">
          <div className="ml-cluster-subhead">
            <span className="ml-subhead-label">Spend &amp; Decisions</span>
            <span className="ml-badge ml-badge--violet">Stage 2 of 3</span>
          </div>

          <div className="ml-spend-hero">
            <span className="ml-spend-amount">$3,450.00</span>
            <span className="ml-spend-desc">
              Q3 Core Infra Capacity Expansion
            </span>
          </div>

          <div className="ml-approval-steps">
            <div className="ml-step ml-step--done">
              <div className="ml-step-marker">✓</div>
              <div className="ml-step-text">
                <span className="ml-step-name">1. Submitted</span>
                <span className="ml-step-meta">Danial Chen · Lead Eng</span>
              </div>
            </div>

            <div className="ml-step ml-step--done">
              <div className="ml-step-marker">✓</div>
              <div className="ml-step-text">
                <span className="ml-step-name">2. Manager approval</span>
                <span className="ml-step-meta">Sarun Techaporn · Approved</span>
              </div>
            </div>

            <div className="ml-step ml-step--active">
              <div className="ml-step-marker">●</div>
              <div className="ml-step-text">
                <span className="ml-step-name">3. Finance review</span>
                <span className="ml-step-meta">Alisa Vance · In review</span>
              </div>
            </div>
          </div>

          <div className="ml-card-footer-note">
            <span>Audit trail snapshot preserved on final approval</span>
          </div>
        </div>
      </div>
    </div>
  );
}
