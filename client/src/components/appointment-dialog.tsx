import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

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
  };
  providers: Array<{ id: string; name: string }>;
  onSave: (data: any) => void;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  providers,
  onSave,
}: AppointmentDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
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

  // Reset form when dialog opens/closes or appointment changes
  useEffect(() => {
    if (open) {
      if (appointment) {
        // Editing existing appointment
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
        // New appointment - reset to defaults
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

  const handleSave = async () => {
    setIsSaving(true);

    console.log("Form data before save:", formData);

    // Combine date and time into ISO strings for Europe/Madrid timezone
    const startDateTime = `${formData.startDate}T${formData.startTime}:00`;
    const endDateTime = `${formData.endDate}T${formData.endTime}:00`;

    // Find the provider name from the ID
    const selectedProvider = providers.find(p => p.id === formData.providerId);
    const providerName = selectedProvider?.name || "";

    // Build the payload in the format the API expects
    const payload: any = {
      providerId: formData.providerId,
      providerName: providerName,  // API requires this field
      start: startDateTime,
      end: endDateTime,
      workMinutesNeeded: parseInt(formData.workMinutesNeeded, 10) || 0,
      forkliftsNeeded: parseInt(formData.forkliftsNeeded, 10) || 0,
    };

    // Add optional fields only if they have values
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

    console.log("Saving appointment with payload:", payload);
    
    try {
      await onSave(payload);
      setIsSaving(false);
    } catch (error) {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-appointment">
        <DialogHeader>
          <DialogTitle>{appointment ? "Edit Appointment" : "New Appointment"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={formData.providerId}
                onValueChange={(value) => setFormData({ ...formData, providerId: value })}
              >
                <SelectTrigger id="provider" data-testid="select-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                data-testid="input-start-date"
              />
            </div>

            <div>
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                data-testid="input-start-time"
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                data-testid="input-end-date"
              />
            </div>

            <div>
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                data-testid="input-end-time"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="work-minutes">Work Minutes Needed</Label>
              <Input
                id="work-minutes"
                type="number"
                min="0"
                value={formData.workMinutesNeeded}
                onChange={(e) => setFormData({ ...formData, workMinutesNeeded: e.target.value })}
                data-testid="input-work-minutes"
              />
            </div>

            <div>
              <Label htmlFor="forklifts">Forklifts Needed</Label>
              <Input
                id="forklifts"
                type="number"
                min="0"
                value={formData.forkliftsNeeded}
                onChange={(e) => setFormData({ ...formData, forkliftsNeeded: e.target.value })}
                data-testid="input-forklifts"
              />
            </div>

            <div>
              <Label htmlFor="goods-type">Goods Type (Optional)</Label>
              <Input
                id="goods-type"
                value={formData.goodsType}
                onChange={(e) => setFormData({ ...formData, goodsType: e.target.value })}
                placeholder="e.g., Electronics"
                data-testid="input-goods-type"
              />
            </div>

            <div>
              <Label htmlFor="units">Units (Optional)</Label>
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
              <Label htmlFor="lines">Lines (Optional)</Label>
              <Input
                id="lines"
                type="number"
                min="0"
                value={formData.lines}
                onChange={(e) => setFormData({ ...formData, lines: e.target.value })}
                data-testid="input-lines"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
