import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ProviderProfile } from "@/lib/api";

interface ProviderTableProps {
  data: ProviderProfile[];
}

const reliabilityConfig = {
  fast: { label: "Rapido", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  normal: { label: "Normal", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  slow: { label: "Lento", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export function ProviderTable({ data }: ProviderTableProps) {
  if (data.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Sin perfiles de proveedor todavia. Se necesitan al menos 3 descargas por proveedor.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proveedor</TableHead>
            <TableHead className="text-right">Descargas</TableHead>
            <TableHead className="text-right">Duracion media</TableHead>
            <TableHead className="text-right">Uds. media</TableHead>
            <TableHead className="text-right">Error medio</TableHead>
            <TableHead className="text-right">Fiabilidad</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const rel = reliabilityConfig[row.reliability];
            return (
              <TableRow key={row.providerName}>
                <TableCell className="font-medium">{row.providerName}</TableCell>
                <TableCell className="text-right">{row.deliveryCount}</TableCell>
                <TableCell className="text-right">{row.avgDurationMin} min</TableCell>
                <TableCell className="text-right">{row.avgUnits}</TableCell>
                <TableCell className="text-right">
                  <span className={row.avgPredictionError > 15 ? "text-red-500" : row.avgPredictionError < -15 ? "text-blue-500" : ""}>
                    {row.avgPredictionError > 0 ? "+" : ""}{row.avgPredictionError} min
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge className={rel.className}>{rel.label}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
