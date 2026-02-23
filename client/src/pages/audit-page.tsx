import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import type { AuditLog } from "@shared/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Shield,
  Bot,
  User,
  Plug,
  Settings,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

interface AuditPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

const ENTITY_TYPES = [
  { value: "all", label: "Todos" },
  { value: "Appointment", label: "Appointment" },
  { value: "Provider", label: "Provider" },
  { value: "SlotTemplate", label: "SlotTemplate" },
  { value: "SlotOverride", label: "SlotOverride" },
  { value: "User", label: "User" },
  { value: "EmailRecipient", label: "EmailRecipient" },
];

const ACTIONS = [
  { value: "all", label: "Todos" },
  { value: "CREATE", label: "CREATE" },
  { value: "UPDATE", label: "UPDATE" },
  { value: "DELETE", label: "DELETE" },
];

const ACTOR_TYPES = [
  { value: "all", label: "Todos" },
  { value: "USER", label: "USER" },
  { value: "CHAT_AGENT", label: "CHAT_AGENT" },
  { value: "INTEGRATION", label: "INTEGRATION" },
  { value: "SYSTEM", label: "SYSTEM" },
];

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ActionBadge({ action }: { action: string }) {
  const variant =
    action === "CREATE"
      ? "default"
      : action === "DELETE"
        ? "destructive"
        : "secondary";
  const className =
    action === "CREATE"
      ? "bg-green-600 hover:bg-green-700 text-white no-default-hover-elevate"
      : action === "UPDATE"
        ? "bg-yellow-500 hover:bg-yellow-600 text-black no-default-hover-elevate"
        : "";

  return (
    <Badge
      variant={variant}
      className={className}
      data-testid={`badge-action-${action}`}
    >
      {action}
    </Badge>
  );
}

function ActorIcon({ actorType }: { actorType: string }) {
  const iconClass = "h-4 w-4";
  switch (actorType) {
    case "CHAT_AGENT":
      return <Bot className={iconClass} />;
    case "USER":
      return <User className={iconClass} />;
    case "INTEGRATION":
      return <Plug className={iconClass} />;
    case "SYSTEM":
      return <Settings className={iconClass} />;
    default:
      return <User className={iconClass} />;
  }
}

function ChangesViewer({ changes }: { changes: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);

  if (!changes || Object.keys(changes).length === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const before = (changes.before ?? {}) as Record<string, unknown>;
  const after = (changes.after ?? {}) as Record<string, unknown>;
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-toggle-changes"
          className="gap-1"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {allKeys.length} campo{allKeys.length !== 1 ? "s" : ""}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1 text-xs font-mono">
          {allKeys.map((key) => (
            <div key={key} className="flex flex-col gap-0.5 py-1 border-b last:border-b-0">
              <span className="font-semibold text-foreground">{key}</span>
              <div className="flex flex-wrap gap-2">
                <span className="text-red-500 dark:text-red-400">
                  - {JSON.stringify(before[key] ?? null)}
                </span>
                <span className="text-green-600 dark:text-green-400">
                  + {JSON.stringify(after[key] ?? null)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function AuditPage({ userRole }: AuditPageProps) {
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [actorType, setActorType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [appliedFilters, setAppliedFilters] = useState({
    entityType: "all",
    action: "all",
    actorType: "all",
    from: "",
    to: "",
  });

  const filters = {
    entityType: appliedFilters.entityType !== "all" ? appliedFilters.entityType : undefined,
    action: appliedFilters.action !== "all" ? appliedFilters.action : undefined,
    actorType: appliedFilters.actorType !== "all" ? appliedFilters.actorType : undefined,
    from: appliedFilters.from || undefined,
    to: appliedFilters.to || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, error } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/audit-log", filters],
    queryFn: () => auditApi.list(filters),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters({
      entityType,
      action,
      actorType,
      from: fromDate,
      to: toDate,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="page-icon">
            <Shield />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Registro de Auditoría</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Historial de cambios del sistema
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="space-y-3">
                <div className="h-5 rounded w-1/3 skeleton-shimmer" />
                <div className="h-4 rounded w-2/3 skeleton-shimmer" />
                <div className="h-4 rounded w-1/2 skeleton-shimmer" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="page-icon">
            <Shield />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Registro de Auditoría</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Historial de cambios del sistema
            </p>
          </div>
        </div>
        <Card className="p-8 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="text-destructive font-medium">
              Error al cargar el registro de auditoría
            </div>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="page-icon">
          <Shield />
        </div>
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Registro de Auditoría
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-subtitle">
            Historial de cambios del sistema
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Entidad</label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger data-testid="select-entity-type" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} data-testid={`option-entity-${t.value}`}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Acción</label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger data-testid="select-action" className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value} data-testid={`option-action-${a.value}`}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Actor</label>
            <Select value={actorType} onValueChange={setActorType}>
              <SelectTrigger data-testid="select-actor-type" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTOR_TYPES.map((a) => (
                  <SelectItem key={a.value} value={a.value} data-testid={`option-actor-${a.value}`}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Desde</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              data-testid="input-from-date"
              className="w-[150px]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Hasta</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              data-testid="input-to-date"
              className="w-[150px]"
            />
          </div>

          <Button onClick={handleApplyFilters} data-testid="button-apply-filters">
            Aplicar filtros
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Cambios</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No se encontraron registros
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                  <TableCell className="text-sm whitespace-nowrap" data-testid={`text-date-${log.id}`}>
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell data-testid={`text-entity-${log.id}`}>
                    <span className="font-medium">{log.entityType}</span>
                    <span className="text-muted-foreground ml-1 text-xs">#{log.entityId}</span>
                  </TableCell>
                  <TableCell>
                    <ActionBadge action={log.action} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5" data-testid={`text-actor-${log.id}`}>
                      <ActorIcon actorType={log.actorType} />
                      <span className="text-sm">{log.actorType}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChangesViewer changes={log.changes} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            data-testid="button-prev-page"
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground" data-testid="text-page-info">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            data-testid="button-next-page"
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
