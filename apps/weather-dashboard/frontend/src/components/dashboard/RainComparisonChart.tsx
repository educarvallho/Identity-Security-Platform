"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DataPoint {
  city_id: number;
  city_name: string;
  rain_probability: number;
  rain_volume_mm: number;
}

export function RainComparisonChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 70 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="city_name"
          tick={{ fontSize: 10 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fontSize: 11 }} unit="%" />
        <Tooltip
          formatter={(v: number) => [`${v}%`, "Prob. Chuva"]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar dataKey="rain_probability" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
