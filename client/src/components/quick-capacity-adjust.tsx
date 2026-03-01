import { useQuery, useMutation } from "@tanstack/react-query";
import { capacityApi, type TodayStatusResponse } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

type AdjustLevel = "slightly_less" | "much_less" | "minimum" | "slightly_more" | "reset";
type StatusLevel = TodayStatusResponse["quickAdjustLevel"];

interface QuickCapacityAdjustProps {
  date: Date;
}

const LEVEL_CONFIG: Record<StatusLevel, { label: string; color: string; badgeClass: string; buttonClass: string }> = {
  normal: {
    label: "Capacidad normal",
    color: "bg-green-500",
    badgeClass: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-700",
    buttonClass: "",
  },
  slightly_less: {
    label: "Reducida (-25%)",
    color: "bg-yellow-500",
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-700",
    buttonClass: "bg-yellow-50 border-yellow-300 hover:bg-yellow-100 dark:bg-yellow-950/50 dark:border-yellow-700 dark:hover:bg-yellow-950/70",
  },
  much_less: {
    label: "Reducida (-50%)",
    color: "bg-orange-500",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700",
    buttonClass: "bg-orange-50 border-orange-300 hover:bg-orange-100 dark:bg-orange-950/50 dark:border-orange-700 dark:hover:bg-orange-950/70",
  },
  minimum: {
    label: "Mínimos (-75%)",
    color: "bg-red-500",
    badgeClass: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700",
    buttonClass: "bg-red-50 border-red-300 hover:bg-red-100 dark:bg-red-950/50 dark:border-red-700 dark:hover:bg-red-950/70",
  },
  slightly_more: {
    label: "Ampliada (+25%)",
    color: "bg-blue-500",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700",
    buttonClass: "bg-blue-50 border-blue-300 hover:bg-blue-100 dark:bg-blue-950/50 dark:border-blue-700 dark:hover:bg-blue-950/70",
  },
};

const ADJUST_OPTIONS: Array<{ level: AdjustLevel; icon: string; label: string; desc: string }> = [
  { level: "reset", icon: "🟢", label: "Capacidad normal", desc: "Restaurar valores originales" },
  { level: "slightly_less", icon: "🟡", label: "Un poco menos (-25%)", desc: "Falta algún operario" },
  { level: "much_less", icon: "🟠", label: "Bastante menos (-50%)", desc: "Media plantilla" },
  { level: "minimum", icon: "🔴", label: "Mínimos (-75%)", desc: "Solo emergencias" },
  { level: "slightly_more", icon: "🔵", label: "Un poco más (+25%)", desc: "Refuerzo extra" },
];

export function QuickCapacityAdjust({ date }: QuickCapacityAdjustProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const dateStr = formatInTimeZone(date, "Europe/Madrid", "yyyy-MM-dd");

  const { data: status, isLoading } = useQuery<TodayStatusResponse>({
    queryKey: ["/api/capacity/today-status", dateStr],
    queryFn: () => capacityApi.getTodayStatus(dateStr),
  });

  const mutation = useMutation({
    mutationFn: (level: AdjustLevel) =>
      capacityApi.quickAdjust({ date: dateStr, level }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/today-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/utilization"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/slots/week"] });
      setOpen(false);

      const levelLabel = data.level === "reset"
        ? "Capacidad normal"
        : ADJUST_OPTIONS.find((o) => o.level === data.level)?.label || data.level;

      const slotCount = data.adjustedSlots?.length || 0;

      toast({
        title: "Capacidad de hoy ajustada",
        description: `${levelLabel}. Afecta a ${slotCount} franjas.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo ajustar la capacidad",
        variant: "destructive",
      });
    },
  });

  const currentLevel = status?.quickAdjustLevel || "normal";
  const config = LEVEL_CONFIG[currentLevel];

  // Compute day summary from status slots
  const daySummary = (() => {
    if (!status?.slots || status.slots.length === 0) return null;
    const totalUsed = status.slots.reduce((sum, s) => sum + s.usedPoints, 0);
    const totalMax = status.slots.reduce((sum, s) => sum + s.maxPoints, 0);
    return { used: totalUsed, max: totalMax, slotCount: status.slots.length };
  })();

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`gap-2 ${config.buttonClass}`}
            data-testid="button-quick-adjust"
          >
            <Zap className="h-3.5 w-3.5" />
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Badge variant="outline" className={`text-xs ${config.badgeClass}`}>
                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${config.color}`} />
                {config.label}
                {daySummary && (
                  <span className="ml-1.5 hidden lg:inline text-[10px] opacity-70">
                    {daySummary.used}/{daySummary.max} pts
                  </span>
                )}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="end" data-testid="popover-quick-adjust">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">
              Ajuste rápido — {dateStr}
            </p>
            {ADJUST_OPTIONS.map((option) => {
              const isActive =
                (option.level === "reset" && currentLevel === "normal") ||
                option.level === currentLevel;
              return (
                <button
                  key={option.level}
                  className={`w-full flex items-start gap-2.5 px-2 py-2 rounded-md text-left text-sm transition-colors hover:bg-muted ${
                    isActive ? "bg-muted/80 font-medium" : ""
                  }`}
                  onClick={() => mutation.mutate(option.level)}
                  disabled={mutation.isPending}
                  data-testid={`option-${option.level}`}
                >
                  <span className="text-base leading-none mt-0.5">{option.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.desc}</div>
                  </div>
                  {mutation.isPending && mutation.variables === option.level && (
                    <Loader2 className="h-4 w-4 animate-spin mt-0.5 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {daySummary && (
        <p className="text-[10px] text-muted-foreground hidden lg:block" data-testid="text-day-summary">
          {daySummary.slotCount} franjas
        </p>
      )}
    </div>
  );
}
