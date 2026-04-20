import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ProgressPoint = {
  date: string;
  volume: number;
};

export function ProgressChart({ points }: { points: ProgressPoint[] }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={points}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line dataKey="volume" type="monotone" stroke="var(--accent)" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
