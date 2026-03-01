import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { CategoryAccuracy } from "@/lib/api";

interface CategoryTableProps {
  data: CategoryAccuracy[];
}

function maeBadge(mae: number) {
  if (mae <= 15) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{mae} min</Badge>;
  if (mae <= 30) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">{mae} min</Badge>;
  return <Badge variant="destructive">{mae} min</Badge>;
}

function r2Badge(r2: number | null) {
  if (r2 === null) return <span className="text-muted-foreground">—</span>;
  const pct = (r2 * 100).toFixed(1);
  if (r2 >= 0.8) return <span className="text-green-600 dark:text-green-400 font-medium">{pct}%</span>;
  if (r2 >= 0.5) return <span className="text-yellow-600 dark:text-yellow-400 font-medium">{pct}%</span>;
  return <span className="text-red-600 dark:text-red-400 font-medium">{pct}%</span>;
}

export function CategoryTable({ data }: CategoryTableProps) {
  if (data.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Sin datos de precisión todavía. Registra tiempos reales en la página Almacén.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Muestras</TableHead>
            <TableHead className="text-right">Estimado</TableHead>
            <TableHead className="text-right">Real</TableHead>
            <TableHead className="text-right">MAE</TableHead>
            <TableHead className="text-right">MAPE</TableHead>
            <TableHead className="text-right">Sesgo</TableHead>
            <TableHead className="text-right">R²</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.category}>
              <TableCell className="font-medium">{row.category}</TableCell>
              <TableCell className="text-right">{row.sampleSize}</TableCell>
              <TableCell className="text-right">{row.avgEstimated} min</TableCell>
              <TableCell className="text-right">{row.avgActual} min</TableCell>
              <TableCell className="text-right">{maeBadge(row.mae)}</TableCell>
              <TableCell className="text-right">{row.mape.toFixed(1)}%</TableCell>
              <TableCell className="text-right">
                <span className={row.bias > 0 ? "text-red-500" : row.bias < -5 ? "text-blue-500" : ""}>
                  {row.bias > 0 ? "+" : ""}{row.bias} min
                </span>
              </TableCell>
              <TableCell className="text-right">{r2Badge(row.r2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
