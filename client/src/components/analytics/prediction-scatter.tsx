import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { CategoryAccuracy } from "@/lib/api";

interface PredictionScatterProps {
  data: CategoryAccuracy[];
}

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

export function PredictionScatter({ data }: PredictionScatterProps) {
  // Build scatter points: each category contributes one point (avgEstimated vs avgActual)
  const points = data.map((cat, i) => ({
    x: cat.avgEstimated,
    y: cat.avgActual,
    category: cat.category,
    color: COLORS[i % COLORS.length],
    sampleSize: cat.sampleSize,
  }));

  const max = Math.max(
    ...points.map((p) => Math.max(p.x, p.y)),
    60
  );

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            type="number"
            dataKey="x"
            name="Estimado"
            unit=" min"
            domain={[0, Math.ceil(max * 1.1)]}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Real"
            unit=" min"
            domain={[0, Math.ceil(max * 1.1)]}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-background border rounded-lg p-2 shadow-lg text-sm">
                  <p className="font-semibold">{d.category}</p>
                  <p>Estimado: {d.x} min</p>
                  <p>Real: {d.y} min</p>
                  <p className="text-muted-foreground">{d.sampleSize} muestras</p>
                </div>
              );
            }}
          />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: Math.ceil(max * 1.1), y: Math.ceil(max * 1.1) }]}
            stroke="#94a3b8"
            strokeDasharray="5 5"
            label={{ value: "Perfecto", position: "insideTopLeft", fontSize: 11, fill: "#94a3b8" }}
          />
          {points.map((point, i) => (
            <Scatter
              key={point.category}
              name={point.category}
              data={[point]}
              fill={point.color}
              shape="circle"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
