import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import type { Provider } from "@shared/types";

interface ProvidersTableProps {
  providers: Provider[];
  onAdd: (provider: { name: string; notes?: string }) => void;
  onEdit: (id: string, provider: { name?: string; notes?: string }) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

export function ProvidersTable({
  providers,
  onAdd,
  onEdit,
  onDelete,
  readOnly = false,
}: ProvidersTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<{ name: string; notes: string }>({
    name: "",
    notes: "",
  });

  const handleSave = () => {
    if (editingId) {
      onEdit(editingId, formData);
      setEditingId(null);
    } else {
      onAdd(formData);
      setIsAdding(false);
    }
    resetForm();
  };

  const handleEdit = (provider: Provider) => {
    setEditingId(provider.id);
    setFormData({
      name: provider.name,
      notes: provider.notes || "",
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      notes: "",
    });
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={() => setIsAdding(true)} disabled={isAdding} data-testid="button-add-provider">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Proveedor
          </Button>
        </div>
      )}

      <div className="border border-border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Notas</TableHead>
              {!readOnly && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAdding && (
              <TableRow>
                <TableCell>
                  <Input
                    placeholder="Nombre del proveedor"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-new-provider-name"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Notas opcionales"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    data-testid="input-new-provider-notes"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={handleSave} data-testid="button-save-new-provider">
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={handleCancel} data-testid="button-cancel-new-provider">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {providers.map((provider) => (
              <TableRow key={provider.id}>
                {editingId === provider.id ? (
                  <>
                    <TableCell>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell className="text-muted-foreground">{provider.notes || "-"}</TableCell>
                    {!readOnly && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(provider)}
                            data-testid={`button-edit-provider-${provider.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onDelete(provider.id)}
                            data-testid={`button-delete-provider-${provider.id}`}
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

            {providers.length === 0 && !isAdding && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No hay proveedores aún. Haz clic en "Agregar Proveedor" para crear uno.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
