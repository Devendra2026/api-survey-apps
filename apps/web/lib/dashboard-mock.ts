export interface DashboardKpi {
  id: string
  label: string
  value: number
  subtext: string
  icon: "clipboard" | "fileText" | "clock" | "calendar" | "checkCircle"
  tone: "slate" | "gray" | "amber" | "blue" | "emerald"
}

export interface QcOpsCard {
  id: string
  label: string
  value: number | string
  subtext: string
  accent: "amber" | "emerald" | "rose" | "neutral"
  badge?: string
  actionLabel?: string
  actionHref?: string
}

export interface OrgMiniCard {
  id: string
  label: string
  value: number
  subtext: string
  icon: "users" | "shieldCheck" | "mapPin" | "landmark"
}

export interface TrendPoint {
  date: string
  created: number
  approved: number
  rejected: number
}

export interface SurveyorProductivity {
  name: string
  submitted: number
  approved: number
}

export interface QcSupervisor {
  name: string
  approved: number
  rejected: number
  status?: "High Throughput"
}

export interface MunicipalityPerf {
  name: string
  approved: number
  target: number
  percent: number
  accent: "slate" | "amber" | "muted"
}

export interface ActivityItem {
  id: string
  title: string
  actor: string
  timestamp: string
}

export interface ProMaxDashboardMock {
  welcomeName: string
  kpis: DashboardKpi[]
  qcOps: QcOpsCard[]
  orgOverview: OrgMiniCard[]
  dailyTrend: TrendPoint[]
  surveyors: SurveyorProductivity[]
  qcSupervisors: QcSupervisor[]
  municipalities: MunicipalityPerf[]
  recentActivity: ActivityItem[]
}

/** Synthetic 30-day curve matching the Pro Max brief (late-June peak → early-July dip → mid-July rebound). */
function buildDailyTrend(): TrendPoint[] {
  const points: TrendPoint[] = []
  const start = new Date(Date.UTC(2026, 5, 14)) // 14 Jun 2026

  for (let i = 0; i < 31; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

    // Created: ramp through late June (~550), crash near Jul 4, rebound to ~400 mid-July
    let created = 80 + Math.round(40 * Math.sin(i / 3))
    if (i >= 8 && i <= 16) created = 420 + Math.round((i - 8) * 22) // peak ~600
    if (i === 14 || i === 15) created = 580
    if (i >= 17 && i <= 20) created = Math.max(8, 520 - (i - 17) * 160) // crash near Jul 4
    if (i === 20) created = 12
    if (i > 20) created = Math.min(400, 40 + (i - 20) * 32)

    // Approved: flat ~5 through June/early July, rises after Jul 8 (~i=24)
    let approved = i < 24 ? 2 + (i % 3) : 40 + (i - 24) * 18
    if (i >= 28) approved = Math.min(150, 90 + (i - 28) * 25)

    points.push({ date: label, created, approved, rejected: 0 })
  }

  return points
}

export const proMaxDashboardMock: ProMaxDashboardMock = {
  welcomeName: "Tarun",
  kpis: [
    {
      id: "total",
      label: "Total Surveys",
      value: 7871,
      subtext: "All-time recorded",
      icon: "clipboard",
      tone: "slate",
    },
    {
      id: "draft",
      label: "Draft",
      value: 889,
      subtext: "Not yet submitted",
      icon: "fileText",
      tone: "gray",
    },
    {
      id: "pending-qc",
      label: "Pending QC",
      value: 5336,
      subtext: "Awaiting review",
      icon: "clock",
      tone: "amber",
    },
    {
      id: "created-today",
      label: "Created Today",
      value: 181,
      subtext: "145 submitted today",
      icon: "calendar",
      tone: "blue",
    },
    {
      id: "approved-qc",
      label: "Approved QC",
      value: 1646,
      subtext: "QC passed successfully",
      icon: "checkCircle",
      tone: "emerald",
    },
  ],
  qcOps: [
    {
      id: "pending",
      label: "Pending Workload",
      value: 5336,
      subtext: "Awaiting QC review",
      accent: "amber",
    },
    {
      id: "approvals",
      label: "Approvals",
      value: 1646,
      subtext: "Total approved",
      accent: "emerald",
    },
    {
      id: "rejections",
      label: "Rejections",
      value: 0,
      subtext: "Rejection rate: 0%",
      accent: "rose",
    },
    {
      id: "queue-health",
      label: "Queue Health",
      value: "Backlogged",
      subtext: "5,336 pending / 1,646 approved",
      accent: "amber",
      badge: "Backlogged",
      actionLabel: "Open QC Queue",
      actionHref: "/qc/registry",
    },
  ],
  orgOverview: [
    { id: "surveyors", label: "Active Surveyors", value: 46, subtext: "Field workforce", icon: "users" },
    {
      id: "qc-supervisors",
      label: "Active QC Supervisors",
      value: 5,
      subtext: "Review workforce",
      icon: "shieldCheck",
    },
    { id: "districts", label: "Districts", value: 4, subtext: "Geographic scope", icon: "mapPin" },
    { id: "municipalities", label: "Municipalities", value: 4, subtext: "ULBs in scope", icon: "landmark" },
  ],
  dailyTrend: buildDailyTrend(),
  surveyors: [
    { name: "Vishal", submitted: 85, approved: 0 },
    { name: "Pradeep", submitted: 72, approved: 0 },
    { name: "Yogesh singhh", submitted: 68, approved: 0 },
    { name: "Raj", submitted: 67, approved: 0 },
    { name: "Sanjay Babu", submitted: 61, approved: 0 },
    { name: "Hirdesh yadav", submitted: 55, approved: 0 },
    { name: "Prince srivastav", submitted: 53, approved: 117 },
    { name: "Deepak", submitted: 51, approved: 0 },
  ],
  qcSupervisors: [
    { name: "ishas4927@gmail.com", approved: 238, rejected: 0, status: "High Throughput" },
    { name: "sonamdhall28@gmail.com", approved: 145, rejected: 0 },
    { name: "Pradeep kumar", approved: 0, rejected: 0 },
    { name: "Sonam dhall", approved: 0, rejected: 0 },
    { name: "schandraedu01@gmail.com", approved: 0, rejected: 0 },
  ],
  municipalities: [
    {
      name: "Municipal Council Etah",
      approved: 1006,
      target: 6270,
      percent: 16,
      accent: "slate",
    },
    {
      name: "Town Panchayat Aminagar Sarai",
      approved: 640,
      target: 1500,
      percent: 43,
      accent: "amber",
    },
    {
      name: "Town Panchayat Bhargain",
      approved: 0,
      target: 0,
      percent: 0,
      accent: "muted",
    },
    {
      name: "Town Panchayat Kurawali",
      approved: 0,
      target: 3,
      percent: 0,
      accent: "muted",
    },
  ],
  recentActivity: [
    {
      id: "1",
      title: "801262-003-01096-001-P submitted for QC",
      actor: "Hirdesh yadav",
      timestamp: "14 Jul 2026, 12:34 pm",
    },
    {
      id: "2",
      title: "801262-003-01095-001-R submitted for QC",
      actor: "Sanjay Babu",
      timestamp: "14 Jul 2026, 12:34 pm",
    },
    {
      id: "3",
      title: "801262-004-00174-001-C submitted for QC",
      actor: "Yogesh singhh",
      timestamp: "14 Jul 2026, 12:31 pm",
    },
    {
      id: "4",
      title: "801262-003-01087-011-R submitted for QC",
      actor: "Sanjay Babu",
      timestamp: "14 Jul 2026, 12:16 pm",
    },
    {
      id: "5",
      title: "801262-003-01085-001-P submitted for QC",
      actor: "LALITESH KUMAR",
      timestamp: "14 Jul 2026, 12:13 pm",
    },
    {
      id: "6",
      title: "801262-003-01085-001-R submitted for QC",
      actor: "Hirdesh yadav",
      timestamp: "14 Jul 2026, 12:13 pm",
    },
  ],
}

export function formatDashboardNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value)
}

/** Merge live Pro Max summary stats into the static dashboard sections. */
export function applySummaryToProMaxDashboard(
  summary: {
    totalSurveys: number
    draft: number
    pendingQc: number
    createdToday: number
    createdTodaySubmitted: number
    approvedQc: number
    rejections: number
    rejectionRate: number
    queueHealth: string
  },
  base: ProMaxDashboardMock = proMaxDashboardMock
): ProMaxDashboardMock {
  const pendingFmt = formatDashboardNumber(summary.pendingQc)
  const approvedFmt = formatDashboardNumber(summary.approvedQc)

  return {
    ...base,
    kpis: [
      {
        id: "total",
        label: "Total Surveys",
        value: summary.totalSurveys,
        subtext: "All-time recorded",
        icon: "clipboard",
        tone: "slate",
      },
      {
        id: "draft",
        label: "Draft",
        value: summary.draft,
        subtext: "Not yet submitted",
        icon: "fileText",
        tone: "gray",
      },
      {
        id: "pending-qc",
        label: "Pending QC",
        value: summary.pendingQc,
        subtext: "Awaiting review",
        icon: "clock",
        tone: "amber",
      },
      {
        id: "created-today",
        label: "Created Today",
        value: summary.createdToday,
        subtext: `${formatDashboardNumber(summary.createdTodaySubmitted)} submitted today`,
        icon: "calendar",
        tone: "blue",
      },
      {
        id: "approved-qc",
        label: "Approved QC",
        value: summary.approvedQc,
        subtext: "QC passed successfully",
        icon: "checkCircle",
        tone: "emerald",
      },
    ],
    qcOps: [
      {
        id: "pending",
        label: "Pending Workload",
        value: summary.pendingQc,
        subtext: "Awaiting QC review",
        accent: "amber",
      },
      {
        id: "approvals",
        label: "Approvals",
        value: summary.approvedQc,
        subtext: "Total approved",
        accent: "emerald",
      },
      {
        id: "rejections",
        label: "Rejections",
        value: summary.rejections,
        subtext: `Rejection rate: ${summary.rejectionRate}%`,
        accent: "rose",
      },
      {
        id: "queue-health",
        label: "Queue Health",
        value: summary.queueHealth,
        subtext: `${pendingFmt} pending / ${approvedFmt} approved`,
        accent: summary.queueHealth === "Healthy" ? "emerald" : "amber",
        badge: summary.queueHealth,
        actionLabel: "Open QC Queue",
        actionHref: "/qc/registry",
      },
    ],
  }
}
