"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type DualTrendDatum = {
  date: string
  created: number
  approved: number
  rejected: number
}

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

type NamedDatum = { name: string; value: number }

export function StatusBarChart({ data }: { data: NamedDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--chart-1)" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TrendAreaChart({ data }: { data: NamedDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="value" stroke="var(--chart-1)" fill="url(#trendFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function DistributionPieChart({ data }: { data: NamedDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function DualTrendAreaChart({ data }: { data: DualTrendDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="createdFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="approvedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
          formatter={(value) => {
            if (value === "created") return "Created"
            if (value === "approved") return "Approved"
            if (value === "rejected") return "Rejected"
            return value
          }}
        />
        <Area
          type="monotone"
          dataKey="created"
          name="created"
          stroke="#6366F1"
          fill="url(#createdFill)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="approved"
          name="approved"
          stroke="#10B981"
          fill="url(#approvedFill)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="rejected"
          name="rejected"
          stroke="#EF4444"
          fill="transparent"
          strokeWidth={1.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
