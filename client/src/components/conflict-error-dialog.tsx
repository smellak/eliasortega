import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle } from "lucide-react";

interface ConflictError {
  minute: string;
  minuteMadrid: string;
  workUsed: number;
  workAvailable: number;
  forkliftsUsed: number;
  forkliftsAvailable: number;
  docksUsed?: number;
  docksAvailable?: number;
  failedRule: "work" | "forklifts" | "docks";
}

interface ConflictErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: ConflictError | null;
}

export function ConflictErrorDialog({ open, onOpenChange, error }: ConflictErrorDialogProps) {
  if (!error) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl" data-testid="dialog-conflict-error">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-red-100 to-red-200 dark:from-red-950/60 dark:to-red-900/40 flex items-center justify-center shrink-0">
              <AlertCircle className="h-7 w-7 text-destructive animate-pulse" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg">No se puede programar la cita</AlertDialogTitle>
              <AlertDialogDescription>
                Capacidad excedida en {error.minuteMadrid} (Europe/Madrid)
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Desglose de Capacidad</h4>
            <div className="premium-table">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
                    <TableHead className="font-semibold text-blue-900 dark:text-blue-100">Recurso</TableHead>
                    <TableHead className="text-right font-semibold text-blue-900 dark:text-blue-100">Usado</TableHead>
                    <TableHead className="text-right font-semibold text-blue-900 dark:text-blue-100">Disponible</TableHead>
                    <TableHead className="text-right font-semibold text-blue-900 dark:text-blue-100">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className={error.failedRule === "work" ? "bg-red-100 dark:bg-red-950/50" : ""}>
                    <TableCell className="font-medium">Minutos de Trabajo (min/min)</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{error.workUsed.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{error.workAvailable.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      {error.workUsed > error.workAvailable ? (
                        <span className="text-destructive font-semibold">Excedido</span>
                      ) : (
                        <span className="text-muted-foreground">Bien</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow className={error.failedRule === "forklifts" ? "bg-red-100 dark:bg-red-950/50" : ""}>
                    <TableCell className="font-medium">Carretillas</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{error.forkliftsUsed}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{error.forkliftsAvailable}</TableCell>
                    <TableCell className="text-right">
                      {error.forkliftsUsed > error.forkliftsAvailable ? (
                        <span className="text-destructive font-semibold">Excedido</span>
                      ) : (
                        <span className="text-muted-foreground">Bien</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {error.docksAvailable !== undefined && (
                    <TableRow className={error.failedRule === "docks" ? "bg-red-100 dark:bg-red-950/50" : ""}>
                      <TableCell className="font-medium">Muelles</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{error.docksUsed || 0}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{error.docksAvailable}</TableCell>
                      <TableCell className="text-right">
                        {(error.docksUsed || 0) > error.docksAvailable ? (
                          <span className="text-destructive font-semibold">Excedido</span>
                        ) : (
                          <span className="text-muted-foreground">Bien</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/30 p-4">
            <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">Acciones Sugeridas</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>Ajusta la duración de la cita o el horario</li>
              <li>Reduce los minutos de trabajo o requisitos de carretillas</li>
              <li>Edita las ventanas de capacidad para aumentar recursos disponibles</li>
              <li>Mueve la cita a un periodo menos ocupado</li>
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
