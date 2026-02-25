import { useQuery } from "@tanstack/react-query";
import { docksApi, appointmentsApi } from "@/lib/api";
import type { DockWithAvailabilities } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Truck, Clock } from "lucide-react";

interface DockStatus {
  dock: DockWithAvailabilities;
  status: "libre" | "ocupado" | "proximo" | "inactivo";
  currentProvider?: string;
  currentEnd?: string;
  nextProvider?: string;
  nextStart?: string;
  todayAppointments: Array<{
    providerName: string;
    start: string;
    end: string;
    goodsType: string | null;
    size: string | null;
  }>;
}

function getMadridTime(utc: string): string {
  return new Date(utc).toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDockStatuses(
  docks: DockWithAvailabilities[],
  appointments: any[]
): DockStatus[] {
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  return docks.map((dock) => {
    if (!dock.active) {
      return { dock, status: "inactivo" as const, todayAppointments: [] };
    }

    const dockApps = appointments
      .filter((a: any) => a.dockId === dock.id && !a.cancelledAt)
      .sort((a: any, b: any) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());

    const todayApps = dockApps.map((a: any) => ({
      providerName: a.providerName,
      start: getMadridTime(a.startUtc),
      end: getMadridTime(a.endUtc),
      goodsType: a.goodsType,
      size: a.size,
    }));

    const current = dockApps.find(
      (a: any) => new Date(a.startUtc) <= now && new Date(a.endUtc) > now
    );
    const next = dockApps.find((a: any) => new Date(a.startUtc) > now);

    if (current) {
      return {
        dock,
        status: "ocupado" as const,
        currentProvider: current.providerName,
        currentEnd: getMadridTime(current.endUtc),
        todayAppointments: todayApps,
      };
    }

    if (next) {
      const minutesUntil = (new Date(next.startUtc).getTime() - now.getTime()) / 60000;
      if (minutesUntil <= 30) {
        return {
          dock,
          status: "proximo" as const,
          nextProvider: next.providerName,
          nextStart: getMadridTime(next.startUtc),
          todayAppointments: todayApps,
        };
      }
    }

    return { dock, status: "libre" as const, todayAppointments: todayApps };
  });
}

const statusColors = {
  libre: { bg: "fill-emerald-500", ring: "stroke-emerald-400", pulse: false, label: "Libre", badge: "bg-emerald-500" },
  ocupado: { bg: "fill-blue-500", ring: "stroke-blue-400", pulse: true, label: "Ocupado", badge: "bg-blue-500" },
  proximo: { bg: "fill-amber-500", ring: "stroke-amber-400", pulse: true, label: "Proximo", badge: "bg-amber-500" },
  inactivo: { bg: "fill-red-500", ring: "stroke-red-400", pulse: false, label: "Inactivo", badge: "bg-red-500" },
};

function DockBay({ ds, index }: { ds: DockStatus; index: number }) {
  const sc = statusColors[ds.status];
  const yOffset = index * 120;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <g className="cursor-pointer" role="button" tabIndex={0}>
          {/* Bay rectangle */}
          <rect
            x={180}
            y={yOffset + 10}
            width={160}
            height={100}
            rx={8}
            className={`${sc.bg} opacity-20 transition-all duration-300`}
          />
          <rect
            x={180}
            y={yOffset + 10}
            width={160}
            height={100}
            rx={8}
            fill="none"
            strokeWidth={2.5}
            className={`${sc.ring} ${sc.pulse ? "animate-pulse" : ""}`}
          />

          {/* Dock code */}
          <text
            x={260}
            y={yOffset + 42}
            textAnchor="middle"
            className="fill-current text-foreground font-bold text-base"
            fontSize={16}
          >
            {ds.dock.code}
          </text>

          {/* Status badge */}
          <rect
            x={220}
            y={yOffset + 52}
            width={80}
            height={20}
            rx={10}
            className={sc.bg}
          />
          <text
            x={260}
            y={yOffset + 66}
            textAnchor="middle"
            fill="white"
            fontSize={10}
            fontWeight="bold"
          >
            {sc.label}
          </text>

          {/* Provider name if occupied/upcoming */}
          {(ds.status === "ocupado" || ds.status === "proximo") && (
            <text
              x={260}
              y={yOffset + 90}
              textAnchor="middle"
              className="fill-current text-muted-foreground"
              fontSize={10}
            >
              {ds.status === "ocupado"
                ? `${ds.currentProvider?.substring(0, 18)} → ${ds.currentEnd}`
                : `${ds.nextProvider?.substring(0, 18)} @ ${ds.nextStart}`}
            </text>
          )}

          {/* Loading bay door lines */}
          <rect x={170} y={yOffset + 30} width={10} height={60} rx={2} className="fill-muted-foreground/30" />
          <line x1={175} y1={yOffset + 40} x2={175} y2={yOffset + 80} className="stroke-muted-foreground/50" strokeWidth={1} strokeDasharray="4 4" />

          {/* Truck icon area */}
          {ds.status === "ocupado" && (
            <rect x={345} y={yOffset + 35} width={40} height={50} rx={4} className="fill-blue-500/20 stroke-blue-400" strokeWidth={1} />
          )}
        </g>
      </PopoverTrigger>
      <PopoverContent className="w-72" side="right">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">{ds.dock.name}</h4>
            <Badge className={`${sc.badge} text-white text-[10px]`}>{sc.label}</Badge>
          </div>

          {ds.status === "ocupado" && (
            <p className="text-sm text-muted-foreground">
              <Truck className="inline h-3 w-3 mr-1" />
              {ds.currentProvider} hasta las {ds.currentEnd}
            </p>
          )}
          {ds.status === "proximo" && (
            <p className="text-sm text-muted-foreground">
              <Clock className="inline h-3 w-3 mr-1" />
              {ds.nextProvider} a las {ds.nextStart}
            </p>
          )}

          {ds.todayAppointments.length > 0 ? (
            <div>
              <p className="text-xs font-medium mb-1">Citas hoy ({ds.todayAppointments.length}):</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {ds.todayAppointments.map((a, i) => (
                  <div key={i} className="text-xs bg-muted rounded px-2 py-1 flex justify-between">
                    <span className="truncate mr-2">{a.providerName}</span>
                    <span className="shrink-0 text-muted-foreground">{a.start}-{a.end}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin citas hoy</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DockMap() {
  const { data: docks } = useQuery({
    queryKey: ["/api/docks"],
    queryFn: docksApi.list,
    refetchInterval: 30000,
  });

  const { data: appointments } = useQuery({
    queryKey: ["/api/appointments", "today"],
    queryFn: () => {
      const today = new Date();
      const from = today.toISOString().split("T")[0];
      const to = from;
      return appointmentsApi.list({ from, to });
    },
    refetchInterval: 30000,
  });

  if (!docks || !appointments) return null;

  const sorted = [...docks].sort((a, b) => a.sortOrder - b.sortOrder);
  const statuses = getDockStatuses(sorted, appointments);
  const svgHeight = statuses.length * 120 + 10;

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
        Vista de planta
      </h3>
      <div className="bg-card border rounded-xl p-4 overflow-x-auto">
        {/* Desktop: horizontal layout */}
        <div className="hidden md:flex items-stretch gap-4 justify-center min-h-[140px]">
          {statuses.map((ds, i) => {
            const sc = statusColors[ds.status];
            return (
              <Popover key={ds.dock.id}>
                <PopoverTrigger asChild>
                  <button className={`relative flex flex-col items-center justify-center w-48 rounded-xl border-2 p-4 transition-all duration-300 hover:scale-105 cursor-pointer ${
                    ds.status === "libre" ? "border-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/5" :
                    ds.status === "ocupado" ? "border-blue-400 bg-blue-500/10 dark:bg-blue-500/5" :
                    ds.status === "proximo" ? "border-amber-400 bg-amber-500/10 dark:bg-amber-500/5" :
                    "border-red-400 bg-red-500/10 dark:bg-red-500/5"
                  }`}>
                    {sc.pulse && (
                      <span className={`absolute top-2 right-2 h-3 w-3 rounded-full animate-pulse ${sc.badge}`} />
                    )}
                    <span className="text-lg font-bold">{ds.dock.code}</span>
                    <Badge className={`${sc.badge} text-white text-[10px] mt-1`}>{sc.label}</Badge>
                    {ds.status === "ocupado" && (
                      <div className="mt-2 text-center">
                        <p className="text-xs font-medium truncate max-w-[160px]">{ds.currentProvider}</p>
                        <p className="text-[10px] text-muted-foreground">hasta {ds.currentEnd}</p>
                      </div>
                    )}
                    {ds.status === "proximo" && (
                      <div className="mt-2 text-center">
                        <p className="text-xs font-medium truncate max-w-[160px]">{ds.nextProvider}</p>
                        <p className="text-[10px] text-muted-foreground">a las {ds.nextStart}</p>
                      </div>
                    )}
                    {ds.status === "libre" && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {ds.todayAppointments.length} citas hoy
                      </p>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{ds.dock.name}</h4>
                      <Badge className={`${sc.badge} text-white text-[10px]`}>{sc.label}</Badge>
                    </div>
                    {ds.status === "ocupado" && (
                      <p className="text-sm text-muted-foreground">
                        <Truck className="inline h-3 w-3 mr-1" />
                        {ds.currentProvider} hasta las {ds.currentEnd}
                      </p>
                    )}
                    {ds.status === "proximo" && (
                      <p className="text-sm text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {ds.nextProvider} a las {ds.nextStart}
                      </p>
                    )}
                    {ds.todayAppointments.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium mb-1">Citas hoy ({ds.todayAppointments.length}):</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {ds.todayAppointments.map((a, j) => (
                            <div key={j} className="text-xs bg-muted rounded px-2 py-1 flex justify-between">
                              <span className="truncate mr-2">{a.providerName}</span>
                              <span className="shrink-0 text-muted-foreground">{a.start}-{a.end}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin citas hoy</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>

        {/* Mobile: vertical stacked */}
        <div className="flex flex-col gap-3 md:hidden">
          {statuses.map((ds) => {
            const sc = statusColors[ds.status];
            return (
              <Popover key={ds.dock.id}>
                <PopoverTrigger asChild>
                  <button className={`relative flex items-center gap-3 w-full rounded-xl border-2 p-3 transition-all ${
                    ds.status === "libre" ? "border-emerald-400 bg-emerald-500/10" :
                    ds.status === "ocupado" ? "border-blue-400 bg-blue-500/10" :
                    ds.status === "proximo" ? "border-amber-400 bg-amber-500/10" :
                    "border-red-400 bg-red-500/10"
                  }`}>
                    {sc.pulse && (
                      <span className={`absolute top-2 right-2 h-2.5 w-2.5 rounded-full animate-pulse ${sc.badge}`} />
                    )}
                    <span className="text-base font-bold w-8">{ds.dock.code}</span>
                    <Badge className={`${sc.badge} text-white text-[10px]`}>{sc.label}</Badge>
                    <span className="flex-1 text-xs text-left truncate text-muted-foreground">
                      {ds.status === "ocupado" && `${ds.currentProvider} → ${ds.currentEnd}`}
                      {ds.status === "proximo" && `${ds.nextProvider} @ ${ds.nextStart}`}
                      {ds.status === "libre" && `${ds.todayAppointments.length} citas hoy`}
                      {ds.status === "inactivo" && "Desactivado"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-2">
                    <h4 className="font-semibold">{ds.dock.name}</h4>
                    {ds.todayAppointments.length > 0 ? (
                      <div className="space-y-1">
                        {ds.todayAppointments.map((a, j) => (
                          <div key={j} className="text-xs bg-muted rounded px-2 py-1 flex justify-between">
                            <span className="truncate mr-2">{a.providerName}</span>
                            <span className="shrink-0">{a.start}-{a.end}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin citas hoy</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </div>
    </div>
  );
}
