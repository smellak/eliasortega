import { Card } from "@/components/ui/card";
import { Package, Gauge, AlertTriangle, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CapacityIndicatorsProps {
  appointmentCount: number;
  capacityPercentage: number;
  workersPercentage: number;
  forkliftsPercentage: number;
  docksPercentage: number;
  peakDay: string | null;
  peakPercentage: number;
  daysUsingDefaults: number;
}

export function CapacityIndicators({
  appointmentCount,
  capacityPercentage,
  workersPercentage,
  forkliftsPercentage,
  docksPercentage,
  peakDay,
  peakPercentage,
  daysUsingDefaults,
}: CapacityIndicatorsProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getProgressClassName = (percentage: number) => {
    if (percentage >= 90) return "h-2 [&>div]:bg-destructive";
    if (percentage >= 75) return "h-2 [&>div]:bg-yellow-500";
    return "h-2 [&>div]:bg-primary";
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return "text-destructive";
    if (percentage >= 75) return "text-yellow-600 dark:text-yellow-500";
    return "text-primary";
  };

  const bottleneck = workersPercentage >= forkliftsPercentage && workersPercentage >= docksPercentage
    ? "Trabajadores"
    : forkliftsPercentage >= docksPercentage
    ? "Carretillas"
    : "Muelles";

  return (
    <div className="space-y-4">
      {/* Main Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Appointment Count */}
        <Card className="p-4" data-testid="card-appointment-count">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">Citas de Descarga</p>
              <p className="text-2xl font-bold" data-testid="text-appointment-count">
                {appointmentCount}
              </p>
            </div>
          </div>
        </Card>

        {/* Capacity Percentage */}
        <Card className="p-4" data-testid="card-capacity-percentage">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Gauge className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Capacidad del Almacén</p>
                {daysUsingDefaults > 0 && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-using-defaults">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {daysUsingDefaults}d estimados
                  </Badge>
                )}
              </div>
              <p 
                className={`text-2xl font-bold ${getPercentageColor(capacityPercentage)}`}
                data-testid="text-capacity-percentage"
              >
                {capacityPercentage.toFixed(1)}%
              </p>
              <Progress 
                value={Math.min(capacityPercentage, 100)} 
                className={`mt-2 ${getProgressClassName(capacityPercentage)}`} 
              />
              <p className="text-xs text-muted-foreground mt-1">
                Limitado por: {bottleneck}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Expandable Details */}
      <Card className="p-4">
        <Button
          variant="ghost"
          className="w-full justify-between hover-elevate"
          onClick={() => setShowDetails(!showDetails)}
          data-testid="button-toggle-details"
        >
          <span className="font-semibold">Detalles de Recursos</span>
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {showDetails && (
          <div className="mt-4 space-y-4" data-testid="container-capacity-details">
            {/* Peak Day Info */}
            {peakDay && (
              <div className="p-3 rounded-md bg-muted/50 flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Día Pico</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(peakDay), "EEEE, d 'de' MMMM", { locale: es })} - {peakPercentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            {/* Resource Breakdown */}
            <div className="space-y-3">
              {/* Workers */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Trabajadores</span>
                  <span className={`text-sm font-mono ${getPercentageColor(workersPercentage)}`}>
                    {workersPercentage.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={Math.min(workersPercentage, 100)} 
                  className={getProgressClassName(workersPercentage)} 
                />
              </div>

              {/* Forklifts */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Carretillas</span>
                  <span className={`text-sm font-mono ${getPercentageColor(forkliftsPercentage)}`}>
                    {forkliftsPercentage.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={Math.min(forkliftsPercentage, 100)} 
                  className={getProgressClassName(forkliftsPercentage)} 
                />
              </div>

              {/* Docks */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Muelles</span>
                  <span className={`text-sm font-mono ${getPercentageColor(docksPercentage)}`}>
                    {docksPercentage.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={Math.min(docksPercentage, 100)} 
                  className={getProgressClassName(docksPercentage)} 
                />
              </div>
            </div>

            {/* Default Capacity Warning */}
            {daysUsingDefaults > 0 && (
              <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                      Capacidad Estimada
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      {daysUsingDefaults} {daysUsingDefaults === 1 ? 'día' : 'días'} sin ventana de capacidad programada. 
                      Usando valores por defecto (08:00-19:00, 3 trabajadores, 2 carretillas, 3 muelles).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
