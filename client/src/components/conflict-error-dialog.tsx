import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SlotConflictError {
  slotStartTime: string;
  slotEndTime: string;
  maxPoints: number;
  pointsUsed: number;
  pointsNeeded: number;
  message: string;
}

interface ConflictErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: SlotConflictError | null;
}

export function ConflictErrorDialog({ open, onOpenChange, error }: ConflictErrorDialogProps) {
  if (!error) {
    return null;
  }

  const usagePct = error.maxPoints > 0 ? (error.pointsUsed / error.maxPoints) * 100 : 100;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg" data-testid="dialog-conflict-error">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-red-100 to-red-200 dark:from-red-950/60 dark:to-red-900/40 flex items-center justify-center shrink-0">
              <AlertCircle className="h-7 w-7 text-destructive animate-pulse" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg">No se puede programar la cita</AlertDialogTitle>
              <AlertDialogDescription>
                {error.message}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4">
          {error.slotStartTime && error.slotEndTime && (
            <div className="rounded-xl bg-muted/50 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Slot {error.slotStartTime}-{error.slotEndTime}</span>
                <span className="text-sm font-mono">{error.pointsUsed}/{error.maxPoints} pts</span>
              </div>
              <Progress
                value={Math.min(usagePct, 100)}
                className="h-2.5 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-red-400 [&>div]:to-red-600"
              />
              <div className="text-xs text-muted-foreground">
                Se necesitan {error.pointsNeeded} punto(s), quedan {Math.max(0, error.maxPoints - error.pointsUsed)} disponible(s)
              </div>
            </div>
          )}

          <div className="rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/30 p-4">
            <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">Acciones Sugeridas</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>Selecciona un slot con capacidad disponible</li>
              <li>Reduce los minutos de trabajo para reducir el tamaño de la cita</li>
              <li>Mueve la cita a otro horario o fecha</li>
              <li>Contacta un administrador para ajustar la capacidad del slot</li>
            </ul>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction data-testid="button-dismiss-error">Entendido</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
