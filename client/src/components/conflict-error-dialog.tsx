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
  error: ConflictError;
}

export function ConflictErrorDialog({ open, onOpenChange, error }: ConflictErrorDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl" data-testid="dialog-conflict-error">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle>Appointment Cannot Be Scheduled</AlertDialogTitle>
              <AlertDialogDescription>
                Capacity exceeded at {error.minuteMadrid} (Europe/Madrid)
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Capacity Breakdown</h4>
            <div className="border border-border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className={error.failedRule === "work" ? "bg-destructive/10" : ""}>
                    <TableCell className="font-medium">Work Minutes (min/min)</TableCell>
                    <TableCell className="text-right font-mono">{error.workUsed.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-mono">{error.workAvailable.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      {error.workUsed > error.workAvailable ? (
                        <span className="text-destructive font-semibold">Exceeded</span>
                      ) : (
                        <span className="text-muted-foreground">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow className={error.failedRule === "forklifts" ? "bg-destructive/10" : ""}>
                    <TableCell className="font-medium">Forklifts</TableCell>
                    <TableCell className="text-right font-mono">{error.forkliftsUsed}</TableCell>
                    <TableCell className="text-right font-mono">{error.forkliftsAvailable}</TableCell>
                    <TableCell className="text-right">
                      {error.forkliftsUsed > error.forkliftsAvailable ? (
                        <span className="text-destructive font-semibold">Exceeded</span>
                      ) : (
                        <span className="text-muted-foreground">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {error.docksAvailable !== undefined && (
                    <TableRow className={error.failedRule === "docks" ? "bg-destructive/10" : ""}>
                      <TableCell className="font-medium">Docks</TableCell>
                      <TableCell className="text-right font-mono">{error.docksUsed || 0}</TableCell>
                      <TableCell className="text-right font-mono">{error.docksAvailable}</TableCell>
                      <TableCell className="text-right">
                        {(error.docksUsed || 0) > error.docksAvailable ? (
                          <span className="text-destructive font-semibold">Exceeded</span>
                        ) : (
                          <span className="text-muted-foreground">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Suggested Actions</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Adjust the appointment duration or time slot</li>
              <li>Reduce work minutes or forklift requirements</li>
              <li>Edit capacity windows to increase available resources</li>
              <li>Move appointment to a less busy time period</li>
            </ul>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction data-testid="button-dismiss-error">OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
