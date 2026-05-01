import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ProgressPoint = {
  date: string;
  value: number;
};

export function ProgressChart({ points }: { points: ProgressPoint[] }) {
  return (
    <div className="progress-chart">
      <ResponsiveContainer>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="4 6" stroke="color-mix(in oklab, var(--accent) 28%, transparent)" />
          <XAxis dataKey="date" stroke="color-mix(in oklab, var(--muted) 72%, var(--text))" tickLine={false} axisLine={false} />
          <YAxis stroke="color-mix(in oklab, var(--muted) 72%, var(--text))" tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px" }} />
          <Line dataKey="value" type="monotone" stroke="var(--accent)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "var(--accent)" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
