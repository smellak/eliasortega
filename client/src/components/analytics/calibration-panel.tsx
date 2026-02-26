import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { calibrationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const CATEGORIES = ["Asientos", "Baño", "Cocina", "Colchonería", "Electro", "Mobiliario", "PAE", "Tapicería"];

interface CalibrationResult {
  id: string;
  category: string;
  sampleSize: number;
  newTD: number; newTA: number; newTL: number; newTU: number;
  oldTD: number; oldTA: number; oldTL: number; oldTU: number;
  maeOld: number;
  maeNew: number;
  status: string;
}

export function CalibrationPanel() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [calcResult, setCalcResult] = useState<CalibrationResult | null>(null);
  const [applyConfirm, setApplyConfirm] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: history = [] } = useQuery({
    queryKey: ["calibration-history"],
    queryFn: () => calibrationApi.getHistory(),
  });

  const calculateMutation = useMutation({
    mutationFn: (category: string) => calibrationApi.calculate(category),
    onSuccess: (data) => {
      setCalcResult(data);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "No se pudo calcular", variant: "destructive" });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => calibrationApi.apply(id),
    onSuccess: () => {
      toast({ title: "Calibracion aplicada" });
      setCalcResult(null);
      setApplyConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["calibration-history"] });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "No se pudo aplicar", variant: "destructive" });
    },
  });

  const maeImprovement = calcResult ? ((calcResult.maeOld - calcResult.maeNew) / calcResult.maeOld * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Calculate section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recalibrar coeficientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Categoria</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => selectedCategory && calculateMutation.mutate(selectedCategory)}
              disabled={!selectedCategory || calculateMutation.isPending}
            >
              {calculateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Calcular
            </Button>
          </div>

          {/* Result */}
          {calcResult && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{calcResult.category}</h4>
                <Badge variant="secondary">{calcResult.sampleSize} muestras</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Coeficientes actuales</p>
                  <p>TD={calcResult.oldTD} TA={calcResult.oldTA}</p>
                  <p>TL={calcResult.oldTL} TU={calcResult.oldTU}</p>
                  <p className="mt-1">MAE: <span className="font-bold">{calcResult.maeOld.toFixed(1)} min</span></p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Coeficientes nuevos</p>
                  <p>TD={calcResult.newTD} TA={calcResult.newTA}</p>
                  <p>TL={calcResult.newTL} TU={calcResult.newTU}</p>
                  <p className="mt-1">MAE: <span className="font-bold">{calcResult.maeNew.toFixed(1)} min</span></p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm">
                  Mejora: <span className={maeImprovement > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    {maeImprovement > 0 ? "-" : "+"}{Math.abs(maeImprovement).toFixed(1)}% MAE
                  </span>
                </span>
                <Button
                  onClick={() => setApplyConfirm(calcResult.id)}
                  disabled={applyMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de calibraciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Muestras</TableHead>
                    <TableHead className="text-right">MAE ant.</TableHead>
                    <TableHead className="text-right">MAE nuevo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.slice(0, 20).map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm">
                        {new Date(h.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </TableCell>
                      <TableCell>{h.category}</TableCell>
                      <TableCell className="text-right">{h.sampleSize}</TableCell>
                      <TableCell className="text-right">{h.maeOld.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{h.maeNew.toFixed(1)}</TableCell>
                      <TableCell>
                        <Badge variant={h.status === "applied" ? "default" : "secondary"}>
                          {h.status === "applied" ? "Aplicado" : "Pendiente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!applyConfirm}
        onOpenChange={(v) => !v && setApplyConfirm(null)}
        onConfirm={() => applyConfirm && applyMutation.mutate(applyConfirm)}
        title="Aplicar calibracion"
        description="Los nuevos coeficientes se usaran para todas las estimaciones futuras de esta categoria. Esta accion no se puede deshacer facilmente."
        confirmLabel="Aplicar"
        variant="default"
      />
    </div>
  );
}
