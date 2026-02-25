import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { slotsApi, appointmentsApi } from "@/lib/api";
import type { Appointment } from "@shared/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Tooltip as RechartsTooltip,
} from "recharts";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart3, Users, Warehouse } from "lucide-react";

const DOCK_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#06b6d4"];
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function DashboardCharts({ currentDate }: { currentDate: Date }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const { data: weekData } = useQuery({
    queryKey: ["/api/slots/week", format(weekStart, "yyyy-MM-dd")],
    queryFn: () => slotsApi.getWeek(format(weekStart, "yyyy-MM-dd")),
  });

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
    queryFn: () => appointmentsApi.list(),
  });

  // Chart 1: Weekly occupancy data
  const occupancyData = useMemo(() => {
    if (!weekData) return [];
    return weekData.slice(0, 6).map((day, i) => {
      const totalMax = day.slots.reduce((sum, s) => sum + s.maxPoints, 0);
      const totalUsed = day.slots.reduce((sum, s) => sum + s.usedPoints, 0);
      return {
        name: DAY_LABELS[i] || day.dayName,
        usados: totalUsed,
        disponibles: Math.max(0, totalMax - totalUsed),
      };
    });
  }, [weekData]);

  // Chart 2: Top 5 providers
  const topProviders = useMemo(() => {
    const counts: Record<string, { count: number; lastDate: string }> = {};
    appointments.forEach((apt) => {
      if (!counts[apt.providerName]) {
        counts[apt.providerName] = { count: 0, lastDate: apt.startUtc };
      }
      counts[apt.providerName].count++;
      if (apt.startUtc > counts[apt.providerName].lastDate) {
        counts[apt.providerName].lastDate = apt.startUtc;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, count: data.count, lastDate: data.lastDate }));
  }, [appointments]);

  // Chart 3: Dock usage
  const dockUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach((apt) => {
      const code = apt.dockCode || "Sin muelle";
      counts[code] = (counts[code] || 0) + 1;
    });
    return Object.entries(counts).map(([code, count]) => ({
      name: code,
      value: count,
    }));
  }, [appointments]);

  if (!weekData || appointments.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fadeIn">
      {/* Chart 1: Weekly Occupancy */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold">Ocupación Semanal</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Puntos usados vs disponibles</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={occupancyData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <RechartsTooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Bar dataKey="usados" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} name="Usados" />
            <Bar dataKey="disponibles" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]} name="Disponibles" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Chart 2: Top Providers */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold">Top Proveedores</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Los 5 con más citas</p>
        <div className="space-y-2.5">
          {topProviders.map((provider, i) => (
            <div key={provider.name} className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{provider.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(provider.count / topProviders[0].count) * 100}%` }}
                    />
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    {provider.count}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
          {topProviders.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Sin datos</p>
          )}
        </div>
      </Card>

      {/* Chart 3: Dock Usage */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Warehouse className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold">Uso de Muelles</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Distribución de citas por muelle</p>
        {dockUsage.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={dockUsage}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
              >
                {dockUsage.map((_, i) => (
                  <Cell key={i} fill={DOCK_COLORS[i % DOCK_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">Sin datos</p>
        )}
      </Card>
    </div>
  );
}
