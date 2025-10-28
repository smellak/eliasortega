import { Card } from "@/components/ui/card";
import { Users, Truck, Building2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CapacityIndicatorsProps {
  workUsed: number;
  workAvailable: number;
  forkliftsUsed: number;
  forkliftsAvailable: number;
  docksUsed?: number;
  docksAvailable?: number;
}

export function CapacityIndicators({
  workUsed,
  workAvailable,
  forkliftsUsed,
  forkliftsAvailable,
  docksUsed,
  docksAvailable,
}: CapacityIndicatorsProps) {
  const workPercentage = workAvailable > 0 ? (workUsed / workAvailable) * 100 : 0;
  const forkliftsPercentage = forkliftsAvailable > 0 ? (forkliftsUsed / forkliftsAvailable) * 100 : 0;
  const docksPercentage = docksAvailable && docksAvailable > 0 ? ((docksUsed || 0) / docksAvailable) * 100 : 0;

  const getProgressClassName = (percentage: number) => {
    if (percentage >= 90) return "h-2 [&>div]:bg-destructive";
    if (percentage >= 75) return "h-2 [&>div]:bg-yellow-500";
    return "h-2 [&>div]:bg-primary";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="p-4" data-testid="card-capacity-work">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">Work Minutes</p>
            <p className="text-lg font-mono font-semibold">
              {workUsed.toFixed(1)} / {workAvailable.toFixed(1)} min/min
            </p>
            <Progress value={workPercentage} className={`mt-2 ${getProgressClassName(workPercentage)}`} />
          </div>
        </div>
      </Card>

      <Card className="p-4" data-testid="card-capacity-forklifts">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">Forklifts</p>
            <p className="text-lg font-mono font-semibold">
              {forkliftsUsed} / {forkliftsAvailable}
            </p>
            <Progress value={forkliftsPercentage} className={`mt-2 ${getProgressClassName(forkliftsPercentage)}`} />
          </div>
        </div>
      </Card>

      {docksAvailable !== undefined && (
        <Card className="p-4" data-testid="card-capacity-docks">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">Docks</p>
              <p className="text-lg font-mono font-semibold">
                {docksUsed || 0} / {docksAvailable}
              </p>
              <Progress value={docksPercentage} className={`mt-2 ${getProgressClassName(docksPercentage)}`} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
