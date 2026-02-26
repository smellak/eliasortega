import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (actualUnits?: number) => void;
  expectedUnits: number | null;
  providerName: string;
}

export function CheckoutModal({ open, onClose, onConfirm, expectedUnits, providerName }: CheckoutModalProps) {
  const [differentUnits, setDifferentUnits] = useState(false);
  const [actualUnits, setActualUnits] = useState<string>("");

  const handleConfirmSame = () => {
    onConfirm(undefined);
    resetState();
  };

  const handleConfirmDifferent = () => {
    const units = parseInt(actualUnits, 10);
    if (!isNaN(units) && units >= 0) {
      onConfirm(units);
      resetState();
    }
  };

  const resetState = () => {
    setDifferentUnits(false);
    setActualUnits("");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Finalizar descarga</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{providerName}</span>
          </p>

          {expectedUnits != null && expectedUnits > 0 ? (
            <>
              <p className="text-sm">
                Unidades previstas: <span className="font-bold text-lg">{expectedUnits}</span>
              </p>

              {!differentUnits ? (
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleConfirmSame}
                    className="min-h-[56px] text-base font-bold bg-green-600 hover:bg-green-700 text-white"
                  >
                    Si, fueron {expectedUnits} unidades
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDifferentUnits(true)}
                    className="min-h-[56px] text-base"
                  >
                    No, fueron otras
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-medium">Unidades reales:</label>
                  <Input
                    type="number"
                    min={0}
                    value={actualUnits}
                    onChange={(e) => setActualUnits(e.target.value)}
                    placeholder="Ej: 35"
                    className="text-lg h-12"
                    autoFocus
                  />
                  <Button
                    onClick={handleConfirmDifferent}
                    disabled={!actualUnits || parseInt(actualUnits) < 0}
                    className="min-h-[56px] text-base font-bold bg-green-600 hover:bg-green-700 text-white"
                  >
                    Confirmar
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">No se registraron unidades previstas.</p>
              <Button
                onClick={handleConfirmSame}
                className="min-h-[56px] text-base font-bold bg-green-600 hover:bg-green-700 text-white"
              >
                Finalizar descarga
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="min-h-[48px]">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
