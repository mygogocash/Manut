import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../../.env") });

import { PrismaClient, Prisma } from "../src/generated/prisma";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const uuid = () => randomUUID();
const dec = (n: number) => new Prisma.Decimal(n);

function pastDate(daysAgo: number): Date {
  const dt = new Date();
  dt.setDate(dt.getDate() - daysAgo);
  return dt;
}

function futureDate(daysAhead: number): Date {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysAhead);
  return dt;
}

async function main() {
  console.log("🔄 Re-seeding Projects & Tasks only...\n");

  // Get existing users & partners for references
  const users = await prisma.user.findMany({ select: { id: true }, take: 25 });
  const partners = await prisma.partner.findMany({ select: { id: true }, take: 22 });
  const USER_IDS = users.map((u) => u.id);
  const PARTNER_IDS = partners.map((p) => p.id);

  if (USER_IDS.length === 0) {
    console.error("❌ No users found. Run full seed first.");
    return;
  }
  console.log(`  Found ${USER_IDS.length} users, ${PARTNER_IDS.length} partners`);

  // Delete existing tasks first (FK), then columns, members, then projects
  const deletedTasks = await prisma.projectTask.deleteMany({});
  const deletedColumns = await prisma.projectColumn.deleteMany({});
  const deletedMembers = await prisma.projectMember.deleteMany({});
  const deletedProjects = await prisma.project.deleteMany({});
  console.log(`  Deleted ${deletedProjects.count} projects, ${deletedTasks.count} tasks, ${deletedColumns.count} columns, ${deletedMembers.count} members\n`);

  // ─── Projects ─────────────────────────────
  const PROJECT_NAMES = [
    "BNRY Token Launch",
    "Intranet ERP Development",
    "Mobile App v2",
    "DeFi Integration",
    "Exchange Listing Campaign",
    "Website Redesign",
    "API Gateway Migration",
    "KYC/AML System",
    "Staking Platform",
    "Analytics Dashboard",
    "NFT Marketplace",
    "Cross-chain Bridge",
    "Governance Portal",
    "Community Platform",
    "Developer SDK",
    "Documentation Portal",
    "Smart Contract Audit",
    "Performance Optimization",
    "Security Hardening",
    "Data Pipeline",
    "Mobile Wallet",
    "Token Vesting",
  ];

  const PROJECT_DESCRIPTIONS = [
    "Launch the BNRY utility token across multiple exchanges with marketing & community campaigns",
    "Build the internal ERP platform (Intranet) covering HR, Finance, Projects, and Operations",
    "Redesign and rebuild the mobile app for iOS and Android with React Native",
    "Integrate DeFi protocols (lending, staking, yield) into the BNRY ecosystem",
    "Coordinate listings on Tier 1/2 exchanges with required compliance and market making",
    "Redesign the corporate website with new branding, blog, and investor portal",
    "Migrate legacy REST API gateway to a new cloud-native architecture on AWS",
    "Implement KYC/AML verification system compliant with FATF guidelines",
    "Build a non-custodial staking platform with flexible lock periods and rewards",
    "Create real-time analytics dashboard for token metrics, TVL, and user activity",
    "Develop an NFT marketplace for community-created digital collectibles",
    "Build a cross-chain bridge supporting Ethereum, Polygon, and BSC",
    "Implement on-chain governance portal for BNRY token holders",
    "Launch community platform with forums, rewards, and ambassador program",
    "Create developer SDK and tooling for third-party integrations",
    "Build comprehensive developer documentation portal with interactive examples",
    "Commission and manage third-party smart contract security audit",
    "Optimize platform performance: reduce load times, improve caching, CDN setup",
    "Harden security posture: penetration testing, bug bounty, SOC 2 prep",
    "Build data pipeline for real-time analytics from on-chain and off-chain sources",
    "Develop self-custody mobile wallet with WalletConnect and biometrics",
    "Implement token vesting smart contracts with cliff and linear release schedules",
  ];

  const PROJ_STATUSES = ["planning", "active", "active", "active", "on_hold", "completed"];

  const TASK_TEMPLATES: { title: string; desc: string; status: string; priority: string; dueOffset: number }[][] = [
    [
      { title: "Define project scope and requirements", desc: "Gather business requirements and document PRD with stakeholders", status: "done", priority: "P0", dueOffset: -14 },
      { title: "Create technical architecture document", desc: "Design system architecture, data models, and API contracts", status: "done", priority: "P0", dueOffset: -7 },
      { title: "Set up project infrastructure", desc: "Configure CI/CD pipelines, staging/production environments, monitoring", status: "done", priority: "P1", dueOffset: 0 },
      { title: "Implement core API endpoints", desc: "Build REST endpoints with authentication, validation, and error handling", status: "in_progress", priority: "P0", dueOffset: 14 },
      { title: "Build frontend UI components", desc: "Implement reusable React components following the design system", status: "in_progress", priority: "P0", dueOffset: 21 },
      { title: "Integrate third-party services", desc: "Connect payment gateway, email service, and analytics SDKs", status: "todo", priority: "P1", dueOffset: 28 },
      { title: "Write unit and integration tests", desc: "Achieve 80%+ code coverage with Jest and Playwright E2E tests", status: "todo", priority: "P1", dueOffset: 35 },
      { title: "Perform security review", desc: "Run OWASP checks, dependency audit, and penetration testing", status: "backlog", priority: "P0", dueOffset: 42 },
      { title: "User acceptance testing", desc: "Coordinate UAT sessions with stakeholders and fix reported issues", status: "backlog", priority: "P1", dueOffset: 49 },
      { title: "Prepare deployment and rollback plan", desc: "Document deployment steps, feature flags, and rollback procedures", status: "backlog", priority: "P2", dueOffset: 56 },
    ],
    [
      { title: "Research and competitive analysis", desc: "Analyze competitor products and identify differentiation opportunities", status: "done", priority: "P1", dueOffset: -21 },
      { title: "Create wireframes and user flows", desc: "Design low-fidelity wireframes and map out user journeys in Figma", status: "done", priority: "P0", dueOffset: -14 },
      { title: "Design high-fidelity mockups", desc: "Create pixel-perfect designs with dark/light mode variants", status: "in_progress", priority: "P0", dueOffset: 7 },
      { title: "Build design system tokens", desc: "Export colors, typography, spacing tokens to Tailwind CSS config", status: "in_progress", priority: "P1", dueOffset: 14 },
      { title: "Implement responsive layouts", desc: "Build mobile-first responsive layouts matching Figma designs", status: "todo", priority: "P0", dueOffset: 21 },
      { title: "Add micro-interactions and animations", desc: "Implement smooth transitions, hover states, and loading animations", status: "todo", priority: "P2", dueOffset: 28 },
      { title: "Accessibility audit (WCAG 2.1 AA)", desc: "Test with screen readers, keyboard nav, and color contrast checks", status: "backlog", priority: "P1", dueOffset: 35 },
      { title: "Performance optimization", desc: "Optimize images, lazy loading, code splitting, and Core Web Vitals", status: "backlog", priority: "P1", dueOffset: 42 },
    ],
    [
      { title: "Database schema design", desc: "Design normalized schema with proper indexes and constraints", status: "done", priority: "P0", dueOffset: -14 },
      { title: "API contract definition (OpenAPI)", desc: "Write OpenAPI 3.1 specs for all endpoints with examples and schemas", status: "done", priority: "P0", dueOffset: -7 },
      { title: "Implement data access layer", desc: "Build repository pattern with Prisma ORM and connection pooling", status: "in_progress", priority: "P0", dueOffset: 7 },
      { title: "Set up message queue", desc: "Configure RabbitMQ/Redis for async job processing and event-driven tasks", status: "in_progress", priority: "P1", dueOffset: 14 },
      { title: "Build worker services", desc: "Implement background workers for email, notifications, and data sync", status: "todo", priority: "P1", dueOffset: 21 },
      { title: "Implement caching strategy", desc: "Add Redis caching layer for frequently accessed data and API responses", status: "todo", priority: "P1", dueOffset: 28 },
      { title: "Set up monitoring and alerting", desc: "Configure Datadog/Grafana dashboards with PagerDuty alerts", status: "backlog", priority: "P0", dueOffset: 35 },
      { title: "Load testing and capacity planning", desc: "Run k6 load tests and document capacity requirements for scaling", status: "backlog", priority: "P2", dueOffset: 42 },
      { title: "Write runbooks and documentation", desc: "Document operational procedures, troubleshooting guides, and FAQs", status: "backlog", priority: "P2", dueOffset: 49 },
    ],
    [
      { title: "Smart contract development", desc: "Write Solidity contracts with OpenZeppelin standards and upgradeability", status: "in_progress", priority: "P0", dueOffset: 14 },
      { title: "Contract unit tests (Hardhat)", desc: "Write comprehensive test suite covering all edge cases and failure modes", status: "in_progress", priority: "P0", dueOffset: 21 },
      { title: "Deploy to testnet", desc: "Deploy contracts to Sepolia/Mumbai testnet with verification on Etherscan", status: "todo", priority: "P0", dueOffset: 28 },
      { title: "Build frontend dApp interface", desc: "Create React dApp with WalletConnect, ethers.js, and transaction UX", status: "todo", priority: "P0", dueOffset: 35 },
      { title: "Integrate subgraph indexer", desc: "Build and deploy The Graph subgraph for on-chain event indexing", status: "todo", priority: "P1", dueOffset: 42 },
      { title: "External security audit", desc: "Engage CertiK/OpenZeppelin for formal audit and fix findings", status: "backlog", priority: "P0", dueOffset: 56 },
      { title: "Mainnet deployment plan", desc: "Prepare multisig deployment, timelock, and emergency pause procedures", status: "backlog", priority: "P0", dueOffset: 63 },
    ],
  ];

  const projectsData: Prisma.ProjectUncheckedCreateInput[] = [];
  const tasksData: Prisma.ProjectTaskUncheckedCreateInput[] = [];

  for (let i = 0; i < PROJECT_NAMES.length; i++) {
    const projId = uuid();
    projectsData.push({
      id: projId,
      name: PROJECT_NAMES[i]!,
      description: PROJECT_DESCRIPTIONS[i]!,
      status: PROJ_STATUSES[i % PROJ_STATUSES.length]!,
      ownerId: USER_IDS[i % Math.min(10, USER_IDS.length)]!,
      partnerId: i < PARTNER_IDS.length / 2 ? PARTNER_IDS[(i * 2) % PARTNER_IDS.length] : undefined,
      startDate: pastDate(90 + Math.floor(Math.random() * 180)),
      endDate: futureDate(30 + Math.floor(Math.random() * 180)),
      budget: dec(50000 + Math.floor(Math.random() * 500000)),
    });

    const template = TASK_TEMPLATES[i % TASK_TEMPLATES.length]!;
    for (let t = 0; t < template.length; t++) {
      const task = template[t]!;
      tasksData.push({
        projectId: projId,
        title: task.title,
        description: task.desc,
        status: task.status,
        priority: task.priority,
        ownerId: USER_IDS[(i + t) % Math.min(15, USER_IDS.length)]!,
        dueDate: task.dueOffset >= 0 ? futureDate(task.dueOffset) : pastDate(Math.abs(task.dueOffset)),
        sortOrder: t,
      });
    }
  }

  await prisma.project.createMany({ data: projectsData });
  await prisma.projectTask.createMany({ data: tasksData });

  // Seed default columns for each project
  const DEFAULT_COLUMNS = [
    { key: "backlog", label: "Backlog", color: "bg-zinc-500", sortOrder: 0 },
    { key: "todo", label: "To Do", color: "bg-blue-500", sortOrder: 1 },
    { key: "in_progress", label: "In Progress", color: "bg-amber-500", sortOrder: 2 },
    { key: "in_review", label: "In Review", color: "bg-purple-500", sortOrder: 3 },
    { key: "done", label: "Done", color: "bg-emerald-500", sortOrder: 4 },
  ];

  const columnsData = projectsData.flatMap((p) =>
    DEFAULT_COLUMNS.map((col) => ({
      projectId: p.id!,
      key: col.key,
      label: col.label,
      color: col.color,
      sortOrder: col.sortOrder,
    })),
  );
  await prisma.projectColumn.createMany({ data: columnsData });

  // Seed members (owner + 2-3 random users per project)
  const membersData: { projectId: string; userId: string }[] = [];
  for (const p of projectsData) {
    const memberSet = new Set<string>();
    memberSet.add(p.ownerId);
    const extraCount = 2 + Math.floor(Math.random() * 3);
    for (let m = 0; m < extraCount; m++) {
      const randomUser = USER_IDS[Math.floor(Math.random() * USER_IDS.length)]!;
      memberSet.add(randomUser);
    }
    for (const userId of memberSet) {
      membersData.push({ projectId: p.id!, userId });
    }
  }
  await prisma.projectMember.createMany({ data: membersData, skipDuplicates: true });

  console.log(`✅ Created ${projectsData.length} projects, ${tasksData.length} tasks, ${columnsData.length} columns, ${membersData.length} members`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
