import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { format } from "date-fns";
import type { CapacityShift } from "@shared/types";

interface CapacityWindowsTableProps {
  windows: CapacityShift[];
  onAdd: (window: { start: string; end: string; workers: number; forklifts: number; docks?: number }) => void;
  onEdit: (id: string, window: { start?: string; end?: string; workers?: number; forklifts?: number; docks?: number }) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

export function CapacityWindowsTable({
  windows,
  onAdd,
  onEdit,
  onDelete,
  readOnly = false,
}: CapacityWindowsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<{
    startUtc: string;
    endUtc: string;
    workers: number;
    forklifts: number;
    docks: number;
  }>({
    startUtc: "",
    endUtc: "",
    workers: 3,
    forklifts: 2,
    docks: 3,
  });

  const handleSave = () => {
    const payload = {
      start: formData.startUtc,
      end: formData.endUtc,
      workers: formData.workers,
      forklifts: formData.forklifts,
      docks: formData.docks,
    };
    if (editingId) {
      onEdit(editingId, payload);
      setEditingId(null);
    } else {
      onAdd(payload);
      setIsAdding(false);
    }
    resetForm();
  };

  const handleEdit = (window: CapacityShift) => {
    setEditingId(window.id);
    setFormData({
      startUtc: window.startUtc,
      endUtc: window.endUtc,
      workers: window.workers,
      forklifts: window.forklifts,
      docks: window.docks || 3,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      startUtc: "",
      endUtc: "",
      workers: 3,
      forklifts: 2,
      docks: 3,
    });
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={() => setIsAdding(true)} disabled={isAdding} data-testid="button-add-window">
            <Plus className="h-4 w-4 mr-2" />
            Add Window
          </Button>
        </div>
      )}

      <div className="border border-border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Start Time</TableHead>
              <TableHead>End Time</TableHead>
              <TableHead className="text-center">Workers</TableHead>
              <TableHead className="text-center">Forklifts</TableHead>
              <TableHead className="text-center">Docks</TableHead>
              {!readOnly && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAdding && (
              <TableRow>
                <TableCell>
                  <Input
                    type="datetime-local"
                    value={formData.startUtc}
                    onChange={(e) => setFormData({ ...formData, startUtc: e.target.value })}
                    data-testid="input-new-start"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="datetime-local"
                    value={formData.endUtc}
                    onChange={(e) => setFormData({ ...formData, endUtc: e.target.value })}
                    data-testid="input-new-end"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    value={formData.workers}
                    onChange={(e) => setFormData({ ...formData, workers: parseInt(e.target.value) })}
                    data-testid="input-new-workers"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    value={formData.forklifts}
                    onChange={(e) => setFormData({ ...formData, forklifts: parseInt(e.target.value) })}
                    data-testid="input-new-forklifts"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    max="3"
                    value={formData.docks || 0}
                    onChange={(e) => setFormData({ ...formData, docks: parseInt(e.target.value) })}
                    data-testid="input-new-docks"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={handleSave} data-testid="button-save-new">
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={handleCancel} data-testid="button-cancel-new">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {windows.map((window) => (
              <TableRow key={window.id}>
                {editingId === window.id ? (
                  <>
                    <TableCell>
                      <Input
                        type="datetime-local"
                        value={formData.startUtc}
                        onChange={(e) => setFormData({ ...formData, startUtc: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="datetime-local"
                        value={formData.endUtc}
                        onChange={(e) => setFormData({ ...formData, endUtc: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={formData.workers}
                        onChange={(e) => setFormData({ ...formData, workers: parseInt(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={formData.forklifts}
                        onChange={(e) => setFormData({ ...formData, forklifts: parseInt(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max="3"
                        value={formData.docks || 0}
                        onChange={(e) => setFormData({ ...formData, docks: parseInt(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={handleSave}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={handleCancel}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(window.startUtc), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(window.endUtc), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold">
                      {window.workers}
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold">
                      {window.forklifts}
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold">
                      {window.docks ?? "-"}
                    </TableCell>
                    {!readOnly && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(window)}
                            data-testid={`button-edit-${window.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onDelete(window.id)}
                            data-testid={`button-delete-${window.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </>
                )}
              </TableRow>
            ))}

            {windows.length === 0 && !isAdding && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No capacity windows defined. Click "Add Window" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
