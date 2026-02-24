import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarPlus } from "lucide-react";
import { slotsApi } from "@/lib/api";

interface SlotAvailability {
  startTime: string;
  endTime: string;
  maxPoints: number;
  pointsUsed: number;
  pointsAvailable: number;
  isOverride: boolean;
  hasCapacity: boolean;
}

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: {
    id: string;
    providerId: string;
    providerName: string;
    startUtc: string;
    endUtc: string;
    workMinutesNeeded: number;
    forkliftsNeeded: number;
    goodsType?: string;
    units?: number;
    lines?: number;
    deliveryNotesCount?: number;
    estimatedFields?: string | null;
  };
  providers: Array<{ id: string; name: string }>;
  onSave: (data: any) => void;
}

interface FormErrors {
  providerId?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  dateRange?: string;
  workMinutesNeeded?: string;
  forkliftsNeeded?: string;
}

function getSizeBadge(workMinutes: number): { label: string; points: number; variant: "default" | "secondary" | "outline" } {
  if (workMinutes <= 30) return { label: "S", points: 1, variant: "outline" };
  if (workMinutes <= 90) return { label: "M", points: 2, variant: "secondary" };
  return { label: "L", points: 3, variant: "default" };
}

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  providers,
  onSave,
}: AppointmentDialogProps) {
  const isFieldEstimated = (field: string): boolean => {
    if (!appointment?.estimatedFields) return false;
    try {
      const fields = JSON.parse(appointment.estimatedFields);
      return Array.isArray(fields) && fields.includes(field);
    } catch { return false; }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [availableSlots, setAvailableSlots] = useState<SlotAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [formData, setFormData] = useState({
    providerId: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    workMinutesNeeded: "60",
    forkliftsNeeded: "1",
    goodsType: "",
    units: "",
    lines: "",
    deliveryNotesCount: "",
  });

  useEffect(() => {
    if (open) {
      setErrors({});
      setAvailableSlots([]);
      setSelectedSlot("");
      if (appointment) {
        setFormData({
          providerId: appointment.providerId,
          startDate: appointment.startUtc ? appointment.startUtc.split("T")[0] : "",
          startTime: appointment.startUtc ? appointment.startUtc.split("T")[1]?.substring(0, 5) : "",
          endDate: appointment.endUtc ? appointment.endUtc.split("T")[0] : "",
          endTime: appointment.endUtc ? appointment.endUtc.split("T")[1]?.substring(0, 5) : "",
          workMinutesNeeded: appointment.workMinutesNeeded?.toString() || "60",
          forkliftsNeeded: appointment.forkliftsNeeded?.toString() || "1",
          goodsType: appointment.goodsType || "",
          units: appointment.units?.toString() || "",
          lines: appointment.lines?.toString() || "",
          deliveryNotesCount: appointment.deliveryNotesCount?.toString() || "",
        });
      } else {
        const now = new Date();
        const today = now.toISOString().split("T")[0];
        setFormData({
          providerId: "",
          startDate: today,
          startTime: "09:00",
          endDate: today,
          endTime: "10:00",
          workMinutesNeeded: "60",
          forkliftsNeeded: "1",
          goodsType: "",
          units: "",
          lines: "",
          deliveryNotesCount: "",
        });
      }
    }
  }, [open, appointment]);

  // Fetch slot availability when date changes
  useEffect(() => {
    if (!open || !formData.startDate) return;

    const workMin = parseInt(formData.workMinutesNeeded, 10) || 60;
    const { points } = getSizeBadge(workMin);

    setLoadingSlots(true);
    slotsApi.getAvailability({ date: formData.startDate, points })
      .then((slots) => {
        setAvailableSlots(slots as SlotAvailability[]);
      })
      .catch(() => {
        setAvailableSlots([]);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [open, formData.startDate, formData.workMinutesNeeded]);

  const handleSlotSelect = (slotKey: string) => {
    setSelectedSlot(slotKey);
    const slot = availableSlots.find((s) => `${s.startTime}-${s.endTime}` === slotKey);
    if (slot) {
      setFormData((prev) => ({
        ...prev,
        startTime: slot.startTime,
        endTime: slot.endTime,
        endDate: prev.startDate,
      }));
      if (errors.startTime || errors.endTime || errors.dateRange) {
        setErrors((prev) => ({ ...prev, startTime: undefined, endTime: undefined, dateRange: undefined }));
      }
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.providerId) {
      newErrors.providerId = "Selecciona un proveedor";
    }

    if (!formData.startDate) {
      newErrors.startDate = "Fecha de inicio requerida";
    }

    if (!formData.startTime) {
      newErrors.startTime = "Hora de inicio requerida";
    }

    if (!formData.endDate) {
      newErrors.endDate = "Fecha de fin requerida";
    }

    if (!formData.endTime) {
      newErrors.endTime = "Hora de fin requerida";
    }

    if (formData.startDate && formData.startTime && formData.endDate && formData.endTime) {
      const startDate = new Date(`${formData.startDate}T${formData.startTime}:00`);
      const endDate = new Date(`${formData.endDate}T${formData.endTime}:00`);
      if (endDate <= startDate) {
        newErrors.dateRange = "La hora de fin debe ser posterior a la hora de inicio";
      }
    }

    const workMin = parseInt(formData.workMinutesNeeded, 10);
    if (isNaN(workMin) || workMin <= 0) {
      newErrors.workMinutesNeeded = "Los minutos de trabajo deben ser mayor que 0";
    }

    const forklifts = parseInt(formData.forkliftsNeeded, 10);
    if (isNaN(forklifts) || forklifts < 0) {
      newErrors.forkliftsNeeded = "Las carretillas no pueden ser negativas";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);

    const startDate = new Date(`${formData.startDate}T${formData.startTime}:00`);
    const endDate = new Date(`${formData.endDate}T${formData.endTime}:00`);

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    const selectedProvider = providers.find(p => p.id === formData.providerId);
    const providerName = selectedProvider?.name || "";

    const payload: any = {
      providerId: formData.providerId,
      providerName: providerName,
      start: startISO,
      end: endISO,
      workMinutesNeeded: parseInt(formData.workMinutesNeeded, 10) || 0,
      forkliftsNeeded: parseInt(formData.forkliftsNeeded, 10) || 0,
    };

    if (formData.goodsType && formData.goodsType.trim()) {
      payload.goodsType = formData.goodsType.trim();
    }
    if (formData.units && formData.units !== "") {
      payload.units = parseInt(formData.units, 10);
    }
    if (formData.lines && formData.lines !== "") {
      payload.lines = parseInt(formData.lines, 10);
    }
    if (formData.deliveryNotesCount && formData.deliveryNotesCount !== "") {
      payload.deliveryNotesCount = parseInt(formData.deliveryNotesCount, 10);
    }

    try {
      await onSave(payload);
      setIsSaving(false);
    } catch (error) {
      setIsSaving(false);
    }
  };

  const fieldError = (field: keyof FormErrors) => {
    if (!errors[field]) return null;
    return <p className="text-xs mt-1.5 px-2 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 inline-block" data-testid={`error-${field}`}>{errors[field]}</p>;
  };

  const workMin = parseInt(formData.workMinutesNeeded, 10) || 60;
  const sizeBadge = getSizeBadge(workMin);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-appointment">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="page-icon">
              <CalendarPlus />
            </div>
            <DialogTitle className="text-xl">{appointment ? "Editar Cita" : "Nueva Cita"}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Proveedor</div>
            <div>
              <Label htmlFor="provider">Proveedor *</Label>
              <Select
                value={formData.providerId}
                onValueChange={(value) => {
                  setFormData({ ...formData, providerId: value });
                  if (errors.providerId) setErrors({ ...errors, providerId: undefined });
                }}
              >
                <SelectTrigger id="provider" data-testid="select-provider" className={errors.providerId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("providerId")}
            </div>

            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-2">Horario</div>
            <div>
              <Label htmlFor="start-date">Fecha Inicio *</Label>
              <Input
                id="start-date"
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  setFormData({ ...formData, startDate: e.target.value, endDate: e.target.value });
                  setSelectedSlot("");
                  if (errors.startDate || errors.dateRange) setErrors({ ...errors, startDate: undefined, dateRange: undefined });
                }}
                className={errors.startDate ? "border-destructive" : ""}
                data-testid="input-start-date"
              />
              {fieldError("startDate")}
            </div>

            {/* Slot Picker */}
            {formData.startDate && (
              <div>
                <Label>Slot disponible</Label>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando slots...
                  </div>
                ) : availableSlots.length > 0 ? (
                  <Select value={selectedSlot} onValueChange={handleSlotSelect}>
                    <SelectTrigger data-testid="select-slot">
                      <SelectValue placeholder="Seleccionar slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSlots.map((slot) => {
                        const key = `${slot.startTime}-${slot.endTime}`;
                        return (
                          <SelectItem key={key} value={key} disabled={!slot.hasCapacity}>
                            {slot.startTime}-{slot.endTime} ({slot.pointsAvailable}/{slot.maxPoints} pts disponibles)
                            {!slot.hasCapacity && " - LLENO"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">No hay slots configurados para esta fecha</p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="start-time">Hora Inicio *</Label>
              <Input
                id="start-time"
                type="time"
                value={formData.startTime}
                onChange={(e) => {
                  setFormData({ ...formData, startTime: e.target.value });
                  if (errors.startTime || errors.dateRange) setErrors({ ...errors, startTime: undefined, dateRange: undefined });
                }}
                className={errors.startTime ? "border-destructive" : ""}
                data-testid="input-start-time"
              />
              {fieldError("startTime")}
            </div>

            <div>
              <Label htmlFor="end-date">Fecha Fin *</Label>
              <Input
                id="end-date"
                type="date"
                value={formData.endDate}
                onChange={(e) => {
                  setFormData({ ...formData, endDate: e.target.value });
                  if (errors.endDate || errors.dateRange) setErrors({ ...errors, endDate: undefined, dateRange: undefined });
                }}
                className={errors.endDate ? "border-destructive" : ""}
                data-testid="input-end-date"
              />
              {fieldError("endDate")}
            </div>

            <div>
              <Label htmlFor="end-time">Hora Fin *</Label>
              <Input
                id="end-time"
                type="time"
                value={formData.endTime}
                onChange={(e) => {
                  setFormData({ ...formData, endTime: e.target.value });
                  if (errors.endTime || errors.dateRange) setErrors({ ...errors, endTime: undefined, dateRange: undefined });
                }}
                className={errors.endTime ? "border-destructive" : ""}
                data-testid="input-end-time"
              />
              {fieldError("endTime")}
              {fieldError("dateRange")}
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recursos</div>
            <div>
              <Label htmlFor="work-minutes">Minutos de Trabajo Necesarios *</Label>
              <Input
                id="work-minutes"
                type="number"
                min="1"
                value={formData.workMinutesNeeded}
                onChange={(e) => {
                  setFormData({ ...formData, workMinutesNeeded: e.target.value });
                  setSelectedSlot("");
                  if (errors.workMinutesNeeded) setErrors({ ...errors, workMinutesNeeded: undefined });
                }}
                className={errors.workMinutesNeeded ? "border-destructive" : ""}
                data-testid="input-work-minutes"
              />
              {fieldError("workMinutesNeeded")}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={sizeBadge.variant}>
                  Tamaño: {sizeBadge.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Esta cita usará {sizeBadge.points} punto(s)
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="forklifts">Carretillas Necesarias *</Label>
              <Input
                id="forklifts"
                type="number"
                min="0"
                value={formData.forkliftsNeeded}
                onChange={(e) => {
                  setFormData({ ...formData, forkliftsNeeded: e.target.value });
                  if (errors.forkliftsNeeded) setErrors({ ...errors, forkliftsNeeded: undefined });
                }}
                className={errors.forkliftsNeeded ? "border-destructive" : ""}
                data-testid="input-forklifts"
              />
              {fieldError("forkliftsNeeded")}
            </div>

            <div>
              <Label htmlFor="goods-type">Tipo de Mercancía</Label>
              <Input
                id="goods-type"
                value={formData.goodsType}
                onChange={(e) => setFormData({ ...formData, goodsType: e.target.value })}
                placeholder="ej., Electrónica"
                data-testid="input-goods-type"
              />
            </div>

            <div>
              <Label htmlFor="units">Unidades</Label>
              <Input
                id="units"
                type="number"
                min="0"
                value={formData.units}
                onChange={(e) => setFormData({ ...formData, units: e.target.value })}
                data-testid="input-units"
              />
            </div>

            <div>
              <Label htmlFor="lines">Líneas</Label>
              <Input
                id="lines"
                type="number"
                min="0"
                value={formData.lines}
                onChange={(e) => setFormData({ ...formData, lines: e.target.value })}
                placeholder="Opcional — se estima auto."
                data-testid="input-lines"
              />
              {appointment?.estimatedFields && isFieldEstimated("lines") && formData.lines && (
                <span className="text-xs text-amber-600 dark:text-amber-400 mt-1 inline-block">~{formData.lines} (estimado)</span>
              )}
            </div>

            <div>
              <Label htmlFor="delivery-notes">Albaranes</Label>
              <Input
                id="delivery-notes"
                type="number"
                min="0"
                value={formData.deliveryNotesCount}
                onChange={(e) => setFormData({ ...formData, deliveryNotesCount: e.target.value })}
                placeholder="Opcional — se estima auto."
                data-testid="input-delivery-notes"
              />
              {appointment?.estimatedFields && isFieldEstimated("deliveryNotesCount") && formData.deliveryNotesCount && (
                <span className="text-xs text-amber-600 dark:text-amber-400 mt-1 inline-block">~{formData.deliveryNotesCount} (estimado)</span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button className="gradient-btn text-white border-0 no-default-hover-elevate no-default-active-elevate" onClick={handleSave} disabled={isSaving} data-testid="button-save">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
