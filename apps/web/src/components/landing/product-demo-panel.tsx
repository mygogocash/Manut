"use client";

import React, { useRef, useState } from "react";

type DemoTab = "people" | "money" | "work";

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  location: string;
  status: "In Office" | "On Leave" | "Available";
  ptoRemaining: number;
  ptoTotal: number;
  recentRequest: {
    type: string;
    duration: string;
    dates: string;
    approver: string;
    status: "Approved" | "In Review";
  };
}

const EMPLOYEES: Employee[] = [
  {
    id: "emp-1",
    name: "Sarun Techaporn",
    role: "Senior Product Designer",
    department: "Design & Product",
    location: "Bangkok HQ",
    status: "On Leave",
    ptoRemaining: 11,
    ptoTotal: 15,
    recentRequest: {
      type: "Annual Leave",
      duration: "3 days",
      dates: "Sep 7 – Sep 9, 2026",
      approver: "Maya Lin (HR Lead)",
      status: "Approved",
    },
  },
  {
    id: "emp-2",
    name: "Alisa Vance",
    role: "VP of Finance",
    department: "Finance & Accounts",
    location: "Bangkok HQ",
    status: "In Office",
    ptoRemaining: 14,
    ptoTotal: 15,
    recentRequest: {
      type: "Conference Attendance",
      duration: "1 day",
      dates: "Aug 22, 2026",
      approver: "Executive Committee",
      status: "Approved",
    },
  },
  {
    id: "emp-3",
    name: "Danial Chen",
    role: "Lead Platform Engineer",
    department: "Engineering",
    location: "Singapore / Remote",
    status: "Available",
    ptoRemaining: 10,
    ptoTotal: 15,
    recentRequest: {
      type: "Sick Leave",
      duration: "1 day",
      dates: "Aug 14, 2026",
      approver: "Verified by Certificate",
      status: "Approved",
    },
  },
  {
    id: "emp-4",
    name: "Jessica Wong",
    role: "Legal & Compliance Counsel",
    department: "Legal",
    location: "Singapore Office",
    status: "In Office",
    ptoRemaining: 15,
    ptoTotal: 15,
    recentRequest: {
      type: "Annual Leave",
      duration: "5 days",
      dates: "Oct 12 – Oct 16, 2026",
      approver: "Maya Lin (HR Lead)",
      status: "In Review",
    },
  },
];

interface ExpenseItem {
  id: string;
  code: string;
  title: string;
  amount: string;
  department: string;
  submittedBy: string;
  currentStep: number;
  totalSteps: number;
  steps: {
    order: number;
    title: string;
    assignee: string;
    state: "done" | "active" | "pending";
    timestamp?: string;
    note?: string;
  }[];
}

const EXPENSES: ExpenseItem[] = [
  {
    id: "exp-1",
    code: "EXP-2026-4102",
    title: "AWS Production Cloud & Edge Infrastructure",
    amount: "$3,850.00",
    department: "Engineering",
    submittedBy: "Danial Chen",
    currentStep: 2,
    totalSteps: 3,
    steps: [
      {
        order: 1,
        title: "Submission & Invoice Validation",
        assignee: "Danial Chen · Submitter",
        state: "done",
        timestamp: "Sep 2, 2026 · 09:14 AM",
        note: "Vendor quote attached · Line item 4.2",
      },
      {
        order: 2,
        title: "Department Head Approval",
        assignee: "Sarun Techaporn · Tech Director",
        state: "done",
        timestamp: "Sep 2, 2026 · 01:45 PM",
        note: "Confirmed within Q3 engineering cloud budget",
      },
      {
        order: 3,
        title: "Finance Disbursement Review",
        assignee: "Alisa Vance · VP Finance",
        state: "active",
        note: "Checking tax invoice withholding compliance",
      },
    ],
  },
  {
    id: "exp-2",
    code: "ADV-2026-1088",
    title: "Regional SME Summit Travel & Lodging",
    amount: "$1,250.00",
    department: "Sales & Growth",
    submittedBy: "Pim Karnchan",
    currentStep: 3,
    totalSteps: 3,
    steps: [
      {
        order: 1,
        title: "Travel Request Submitted",
        assignee: "Pim Karnchan · Account Lead",
        state: "done",
        timestamp: "Aug 28, 2026 · 11:20 AM",
      },
      {
        order: 2,
        title: "Manager Pre-Approval",
        assignee: "Maya Lin · Ops Lead",
        state: "done",
        timestamp: "Aug 29, 2026 · 02:10 PM",
      },
      {
        order: 3,
        title: "Cash Advance Disbursed",
        assignee: "Alisa Vance · VP Finance",
        state: "done",
        timestamp: "Aug 30, 2026 · 10:00 AM",
        note: "Funds wired to company card ending in 4109",
      },
    ],
  },
  {
    id: "exp-3",
    code: "EXP-2026-3991",
    title: "Design System & Figma Enterprise Annual",
    amount: "$2,400.00",
    department: "Product Design",
    submittedBy: "Sarun Techaporn",
    currentStep: 2,
    totalSteps: 2,
    steps: [
      {
        order: 1,
        title: "Subscription Renewal Notice",
        assignee: "Sarun Techaporn · Design Lead",
        state: "done",
        timestamp: "Aug 15, 2026 · 10:30 AM",
      },
      {
        order: 2,
        title: "Finance Reconciliation",
        assignee: "Alisa Vance · VP Finance",
        state: "done",
        timestamp: "Aug 16, 2026 · 04:15 PM",
        note: "Auto-charged and reconciled in ledger",
      },
    ],
  },
];

interface ProjectCard {
  id: string;
  title: string;
  stage: "Discovery" | "Active Sprint" | "Review & QA" | "Completed";
  owner: string;
  deadline: string;
  priority: "Urgent" | "High" | "Normal";
  department: string;
  details: string;
}

const PROJECTS: ProjectCard[] = [
  {
    id: "prj-1",
    title: "PWA Offline Mode & Fast Sync",
    stage: "Active Sprint",
    owner: "Danial Chen",
    deadline: "Sep 15, 2026",
    priority: "High",
    department: "Platform Eng",
    details:
      "Cache strategy configured with indexedDB persistence and optimistic updates.",
  },
  {
    id: "prj-2",
    title: "Automated Tax Invoice Withholding",
    stage: "Review & QA",
    owner: "Alisa Vance",
    deadline: "Sep 12, 2026",
    priority: "Urgent",
    department: "Finance Ops",
    details: "Generating Form 53 PDFs automatically on expense disbursement.",
  },
  {
    id: "prj-3",
    title: "Q3 Investor Board Dataroom",
    stage: "Completed",
    owner: "Jessica Wong",
    deadline: "Sep 1, 2026",
    priority: "Normal",
    department: "Legal & Exec",
    details:
      "All governance documents signed with cryptographic timestamp proof.",
  },
  {
    id: "prj-4",
    title: "Multi-Currency Expense Claims",
    stage: "Discovery",
    owner: "Sarun Techaporn",
    deadline: "Sep 28, 2026",
    priority: "Normal",
    department: "Product",
    details: "Live rate conversion for THB, USD, SGD, and JPY in receipts.",
  },
];

export function ProductDemoPanel() {
  const [activeTab, setActiveTab] = useState<DemoTab>("people");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("emp-1");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>("exp-1");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("prj-1");

  const tabListRef = useRef<HTMLDivElement>(null);

  const selectedEmployee =
    EMPLOYEES.find((e) => e.id === selectedEmployeeId) || EMPLOYEES[0];
  const selectedExpense =
    EXPENSES.find((e) => e.id === selectedExpenseId) || EXPENSES[0];
  const selectedProject =
    PROJECTS.find((p) => p.id === selectedProjectId) || PROJECTS[0];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const tabs: DemoTab[] = ["people", "money", "work"];
    const currentIndex = tabs.indexOf(activeTab);

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      setActiveTab(tabs[prevIndex]);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveTab(tabs[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveTab(tabs[tabs.length - 1]);
    }
  };

  return (
    <section
      id="product"
      className="ml-demo-section ml-container"
      aria-label="Interactive Product Demonstration"
    >
      <div className="ml-demo-intro">
        <div className="ml-demo-badge">
          <span className="ml-demo-badge-dot" />
          <span>Interactive demonstration · Fictional sample data</span>
        </div>
        <h2 className="ml-heading">
          One system across every operational layer.
        </h2>
        <p className="ml-body-lg">
          Switch between desks below to explore how Manut unifies employee
          records, expense approvals, and delivery boards into one synchronized
          environment.
        </p>
      </div>

      {/* Accessible Tabs */}
      <div
        className="ml-demo-tablist"
        role="tablist"
        aria-label="Manut operational modules"
        ref={tabListRef}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          role="tab"
          id="tab-people"
          aria-controls="panel-people"
          aria-selected={activeTab === "people"}
          tabIndex={activeTab === "people" ? 0 : -1}
          className={`
            ml-demo-tab
            ${activeTab === "people" ? `ml-demo-tab--active` : ""}
          `}
          onClick={() => setActiveTab("people")}
        >
          <span className="ml-tab-label">People</span>
          <span className="ml-tab-desc">Directory &amp; Leave</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-money"
          aria-controls="panel-money"
          aria-selected={activeTab === "money"}
          tabIndex={activeTab === "money" ? 0 : -1}
          className={`
            ml-demo-tab
            ${activeTab === "money" ? `ml-demo-tab--active` : ""}
          `}
          onClick={() => setActiveTab("money")}
        >
          <span className="ml-tab-label">Money</span>
          <span className="ml-tab-desc">Expenses &amp; Approvals</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-work"
          aria-controls="panel-work"
          aria-selected={activeTab === "work"}
          tabIndex={activeTab === "work" ? 0 : -1}
          className={`
            ml-demo-tab
            ${activeTab === "work" ? "ml-demo-tab--active" : ""}
          `}
          onClick={() => setActiveTab("work")}
        >
          <span className="ml-tab-label">Work</span>
          <span className="ml-tab-desc">Projects &amp; Stages</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="ml-demo-frame">
        {/* PEOPLE PANEL */}
        {activeTab === "people" ? (
          <div
            id="panel-people"
            role="tabpanel"
            aria-labelledby="tab-people"
            className="ml-demo-panel-grid"
          >
            {/* Left list */}
            <div className="ml-demo-pane ml-demo-pane--list">
              <div className="ml-pane-header">
                <div>
                  <h4 className="ml-pane-title">Team Directory</h4>
                  <span className="ml-pane-subtitle">
                    {EMPLOYEES.length} Active team members
                  </span>
                </div>
                <span className="ml-badge ml-badge--violet">HR Hub</span>
              </div>

              <div className="ml-item-list" role="list">
                {EMPLOYEES.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    className={`
                      ml-item-btn
                      ${
                        selectedEmployeeId === emp.id
                          ? `ml-item-btn--selected`
                          : ""
                      }
                    `}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                  >
                    <div className="ml-avatar ml-avatar--purple">
                      {emp.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="ml-item-text">
                      <div className="ml-item-row">
                        <span className="ml-item-title">{emp.name}</span>
                        <span
                          className={`
                            ml-badge
                            ${
                              emp.status === "On Leave"
                                ? "ml-badge--amber"
                                : "ml-badge--green"
                            }
                          `}
                        >
                          {emp.status}
                        </span>
                      </div>
                      <span className="ml-item-sub">
                        {emp.role} · {emp.location}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right detail view */}
            <div className="ml-demo-pane ml-demo-pane--detail">
              <div className="ml-pane-header">
                <div>
                  <span className="ml-kicker">Member Profile</span>
                  <h4 className="ml-pane-title">{selectedEmployee.name}</h4>
                </div>
                <span className="ml-status-pill ml-status-pill--green">
                  Active Profile
                </span>
              </div>

              <div className="ml-detail-body">
                <div className="ml-detail-stat-row">
                  <div className="ml-detail-stat-card">
                    <span className="ml-stat-lbl">Department</span>
                    <span className="ml-stat-val">
                      {selectedEmployee.department}
                    </span>
                  </div>
                  <div className="ml-detail-stat-card">
                    <span className="ml-stat-lbl">Office Location</span>
                    <span className="ml-stat-val">
                      {selectedEmployee.location}
                    </span>
                  </div>
                  <div className="ml-detail-stat-card">
                    <span className="ml-stat-lbl">Annual Leave Balance</span>
                    <span className="ml-stat-val">
                      {selectedEmployee.ptoRemaining} /{" "}
                      {selectedEmployee.ptoTotal} days left
                    </span>
                  </div>
                </div>

                <div className="ml-detail-card">
                  <div className="ml-card-inner-header">
                    <span className="ml-card-inner-title">
                      Latest Leave Decision
                    </span>
                    <span className="ml-badge ml-badge--green">
                      {selectedEmployee.recentRequest.status}
                    </span>
                  </div>
                  <div className="ml-card-inner-content">
                    <div className="ml-info-row">
                      <span className="ml-info-key">Leave Type:</span>
                      <span className="ml-info-value">
                        {selectedEmployee.recentRequest.type}
                      </span>
                    </div>
                    <div className="ml-info-row">
                      <span className="ml-info-key">Requested Dates:</span>
                      <span className="ml-info-value">
                        {selectedEmployee.recentRequest.dates} (
                        {selectedEmployee.recentRequest.duration})
                      </span>
                    </div>
                    <div className="ml-info-row">
                      <span className="ml-info-key">Reviewed By:</span>
                      <span className="ml-info-value">
                        {selectedEmployee.recentRequest.approver}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ml-detail-footnote">
                  <span>
                    ✦ Leave balances deduct automatically upon manager approval.
                    Zero manual calculations.
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* MONEY PANEL */}
        {activeTab === "money" ? (
          <div
            id="panel-money"
            role="tabpanel"
            aria-labelledby="tab-money"
            className="ml-demo-panel-grid"
          >
            {/* Left list */}
            <div className="ml-demo-pane ml-demo-pane--list">
              <div className="ml-pane-header">
                <div>
                  <h4 className="ml-pane-title">Spend Requests</h4>
                  <span className="ml-pane-subtitle">
                    Expenses, Advances &amp; Approvals
                  </span>
                </div>
                <span className="ml-badge ml-badge--violet">Audit Ready</span>
              </div>

              <div className="ml-item-list" role="list">
                {EXPENSES.map((exp) => (
                  <button
                    key={exp.id}
                    type="button"
                    className={`
                      ml-item-btn
                      ${
                        selectedExpenseId === exp.id
                          ? `ml-item-btn--selected`
                          : ""
                      }
                    `}
                    onClick={() => setSelectedExpenseId(exp.id)}
                  >
                    <div className="ml-exp-marker">$</div>
                    <div className="ml-item-text">
                      <div className="ml-item-row">
                        <span className="ml-item-title">{exp.code}</span>
                        <span className="ml-item-amount">{exp.amount}</span>
                      </div>
                      <span className="ml-item-sub">{exp.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right detail view */}
            <div className="ml-demo-pane ml-demo-pane--detail">
              <div className="ml-pane-header">
                <div>
                  <span className="ml-kicker">{selectedExpense.code}</span>
                  <h4 className="ml-pane-title">{selectedExpense.title}</h4>
                </div>
                <span className="ml-stat-amount-lg">
                  {selectedExpense.amount}
                </span>
              </div>

              <div className="ml-detail-body">
                <div className="ml-detail-stat-row">
                  <div className="ml-detail-stat-card">
                    <span className="ml-stat-lbl">Department</span>
                    <span className="ml-stat-val">
                      {selectedExpense.department}
                    </span>
                  </div>
                  <div className="ml-detail-stat-card">
                    <span className="ml-stat-lbl">Submitted By</span>
                    <span className="ml-stat-val">
                      {selectedExpense.submittedBy}
                    </span>
                  </div>
                  <div className="ml-detail-stat-card">
                    <span className="ml-stat-lbl">Chain Progress</span>
                    <span className="ml-stat-val">
                      Stage {selectedExpense.currentStep} of{" "}
                      {selectedExpense.totalSteps}
                    </span>
                  </div>
                </div>

                <div className="ml-detail-card">
                  <div className="ml-card-inner-header">
                    <span className="ml-card-inner-title">
                      Sequential Approval Stages
                    </span>
                    <span className="ml-tag">Multi-tier Policy</span>
                  </div>
                  <div className="ml-stepper">
                    {selectedExpense.steps.map((st) => (
                      <div
                        key={st.order}
                        className={`
                          ml-stepper-step
                          ml-stepper-step--${st.state}
                        `}
                      >
                        <div className="ml-stepper-icon">
                          {st.state === "done"
                            ? "✓"
                            : st.state === "active"
                              ? "●"
                              : "○"}
                        </div>
                        <div className="ml-stepper-content">
                          <div className="ml-stepper-row">
                            <span className="ml-stepper-title">{st.title}</span>
                            {st.timestamp ? (
                              <span className="ml-stepper-time">
                                {st.timestamp}
                              </span>
                            ) : null}
                          </div>
                          <span className="ml-stepper-assignee">
                            {st.assignee}
                          </span>
                          {st.note ? (
                            <p className="ml-stepper-note">{st.note}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ml-detail-footnote">
                  <span>
                    ✦ Every decision creates an immutable audit stamp with user
                    identity and timestamp.
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* WORK PANEL */}
        {activeTab === "work" ? (
          <div
            id="panel-work"
            role="tabpanel"
            aria-labelledby="tab-work"
            className="ml-demo-pane ml-demo-pane--work"
          >
            <div className="ml-pane-header">
              <div>
                <h4 className="ml-pane-title">
                  Configurable Project &amp; Operations Board
                </h4>
                <span className="ml-pane-subtitle">
                  Live stages, owners, deadlines, and deliverables
                </span>
              </div>
              <span className="ml-badge ml-badge--violet">Kanban Flow</span>
            </div>

            <div className="ml-kanban-board">
              {(
                [
                  "Discovery",
                  "Active Sprint",
                  "Review & QA",
                  "Completed",
                ] as const
              ).map((stage) => {
                const stageProjects = PROJECTS.filter((p) => p.stage === stage);
                return (
                  <div key={stage} className="ml-kanban-col">
                    <div className="ml-kanban-col-head">
                      <span className="ml-kanban-col-title">{stage}</span>
                      <span className="ml-kanban-count">
                        {stageProjects.length}
                      </span>
                    </div>

                    <div className="ml-kanban-cards">
                      {stageProjects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`
                            ml-kanban-card
                            ${
                              selectedProjectId === p.id
                                ? `ml-kanban-card--selected`
                                : ""
                            }
                          `}
                          onClick={() => setSelectedProjectId(p.id)}
                        >
                          <div className="ml-kanban-card-top">
                            <span
                              className={`
                                ml-badge
                                ${
                                  p.priority === "Urgent"
                                    ? "ml-badge--amber"
                                    : "ml-badge--slate"
                                }
                              `}
                            >
                              {p.priority}
                            </span>
                            <span className="ml-kanban-deadline">
                              {p.deadline}
                            </span>
                          </div>
                          <h5 className="ml-kanban-card-title">{p.title}</h5>
                          <div className="ml-kanban-card-meta">
                            <span className="ml-kanban-owner">
                              👤 {p.owner}
                            </span>
                            <span className="ml-kanban-dept">
                              {p.department}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="ml-work-detail-bar">
              <div className="ml-work-detail-info">
                <span className="ml-kicker">Selected Deliverable</span>
                <span className="ml-work-selected-title">
                  {selectedProject.title} ({selectedProject.stage})
                </span>
                <p className="ml-work-selected-desc">
                  {selectedProject.details}
                </p>
              </div>
              <div className="ml-work-detail-aside">
                <span className="ml-badge ml-badge--green">
                  Owner: {selectedProject.owner}
                </span>
                <span className="ml-badge ml-badge--slate">
                  Due: {selectedProject.deadline}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
