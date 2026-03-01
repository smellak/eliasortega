import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Save, X, Search, Building2, Truck, Users } from "lucide-react";
import type { Provider } from "@shared/types";

interface ProvidersTableProps {
  providers: Provider[];
  onAdd: (provider: { name: string; notes?: string }) => void;
  onEditClick: (provider: Provider) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

function getTypeBadge(type: string | undefined | null) {
  switch (type) {
    case "AGENCY":
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800">Agencia</Badge>;
    case "DIRECT_SUPPLIER":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">Proveedor directo</Badge>;
    case "LOCAL_DISTRIBUTOR":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800">Distribuidor local</Badge>;
    case "IMPORT_PROCESS":
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800">Importación</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground">—</Badge>;
  }
}

function getTransportBadge(transport: string | undefined | null) {
  switch (transport) {
    case "OWN_TRUCK":
      return <span className="text-xs text-emerald-700 dark:text-emerald-400">Camión propio</span>;
    case "VIA_AGENCY":
      return <span className="text-xs text-purple-700 dark:text-purple-400">Vía agencia</span>;
    case "MIXED":
      return <span className="text-xs text-amber-700 dark:text-amber-400">Mixto</span>;
    case "IS_AGENCY":
      return <span className="text-xs text-indigo-700 dark:text-indigo-400">Es agencia</span>;
    case "COURIER":
      return <span className="text-xs text-cyan-700 dark:text-cyan-400">Mensajería</span>;
    default:
      return <span className="text-xs text-muted-foreground">—</span>;
  }
}

export function ProvidersTable({
  providers,
  onAdd,
  onEditClick,
  onDelete,
  readOnly = false,
}: ProvidersTableProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<{ name: string; notes: string }>({
    name: "",
    notes: "",
  });

  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return providers;
    const q = searchQuery.toLowerCase();
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.officialName && p.officialName.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.type && p.type.toLowerCase().includes(q))
    );
  }, [providers, searchQuery]);

  const handleSaveNew = () => {
    onAdd(formData);
    setIsAdding(false);
    setFormData({ name: "", notes: "" });
  };

  const handleCancelNew = () => {
    setIsAdding(false);
    setFormData({ name: "", notes: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>{providers.length} proveedores</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar proveedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[220px]"
            />
          </div>
          {!readOnly && (
            <Button onClick={() => setIsAdding(true)} disabled={isAdding} data-testid="button-add-provider" className="gradient-btn text-white border-0 no-default-hover-elevate no-default-active-elevate">
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          )}
        </div>
      </div>

      <div className="premium-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
              <TableHead className="font-semibold text-blue-900 dark:text-blue-100">Nombre</TableHead>
              <TableHead className="font-semibold text-blue-900 dark:text-blue-100">Tipo</TableHead>
              <TableHead className="font-semibold text-blue-900 dark:text-blue-100 hidden md:table-cell">Categoría</TableHead>
              <TableHead className="font-semibold text-blue-900 dark:text-blue-100 hidden lg:table-cell">Transporte</TableHead>
              <TableHead className="font-semibold text-blue-900 dark:text-blue-100 hidden lg:table-cell text-center">Contactos</TableHead>
              <TableHead className="font-semibold text-blue-900 dark:text-blue-100 hidden xl:table-cell">Notas</TableHead>
              {!readOnly && <TableHead className="text-right font-semibold text-blue-900 dark:text-blue-100">Acciones</TableHead>}
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
                <TableCell colSpan={4}>
                  <Input
                    placeholder="Notas opcionales"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    data-testid="input-new-provider-notes"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={handleSaveNew} data-testid="button-save-new-provider">
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={handleCancelNew} data-testid="button-cancel-new-provider">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {filteredProviders.map((provider) => (
              <TableRow
                key={provider.id}
                className="hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                onClick={() => onEditClick(provider)}
                data-testid={`row-provider-${provider.id}`}
              >
                <TableCell>
                  <div>
                    <div className="font-medium">{provider.name}</div>
                    {provider.officialName && provider.officialName !== provider.name && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{provider.officialName}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getTypeBadge(provider.type)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm">{provider.category || "—"}</span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    {getTransportBadge(provider.transportType)}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{provider._count?.contacts ?? 0}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{provider.notes || "—"}</span>
                </TableCell>
                {!readOnly && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); onEditClick(provider); }}
                        data-testid={`button-edit-provider-${provider.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); onDelete(provider.id); }}
                        data-testid={`button-delete-provider-${provider.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {filteredProviders.length === 0 && !isAdding && (
              <TableRow>
                <TableCell colSpan={readOnly ? 6 : 7} className="text-center text-muted-foreground py-8">
                  {searchQuery ? "No se encontraron proveedores con ese criterio." : "No hay proveedores aún. Haz clic en \"Agregar\" para crear uno."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
