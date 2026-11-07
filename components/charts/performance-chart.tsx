"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PerformancePoint = {
  date: string;
  reach: number;
  engagement: number;
};

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="engagementFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} stroke="currentColor" className="text-muted-foreground" />
          <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="currentColor" className="text-muted-foreground" />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--foreground)",
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="reach" stroke="#4f46e5" strokeWidth={2} fill="url(#reachFill)" name="Reach" />
          <Area type="monotone" dataKey="engagement" stroke="#10b981" strokeWidth={2} fill="url(#engagementFill)" name="Engagement" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
