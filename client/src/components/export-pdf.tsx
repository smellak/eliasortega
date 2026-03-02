import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import type { Appointment } from "@shared/types";

const TIMEZONE = "Europe/Madrid";

interface ExportPDFProps {
  appointments: Appointment[];
  currentDate: Date;
  viewType: "week" | "month";
}

export function ExportPDFButton({ appointments, currentDate, viewType }: ExportPDFProps) {
  const handleExport = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

    const startStr = format(weekStart, "d 'de' MMMM", { locale: es });
    const endStr = format(weekEnd, "d 'de' MMMM yyyy", { locale: es });
    const title = `Resumen de citas — Semana del ${startStr} al ${endStr}`;

    // Filter appointments for the current week
    const weekAppointments = appointments.filter((apt) => {
      const d = new Date(apt.startUtc);
      return d >= weekStart && d <= weekEnd;
    }).sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());

    const rows = weekAppointments.map((apt) => `
      <tr>
        <td>${formatInTimeZone(new Date(apt.startUtc), TIMEZONE, "dd/MM")}</td>
        <td>${formatInTimeZone(new Date(apt.startUtc), TIMEZONE, "HH:mm")} - ${formatInTimeZone(new Date(apt.endUtc), TIMEZONE, "HH:mm")}</td>
        <td>${apt.providerName}</td>
        <td>${apt.goodsType || "-"}</td>
        <td style="text-align:center">${apt.units ?? "-"}</td>
        <td style="text-align:center">${apt.dockCode || "-"}</td>
        <td style="text-align:center">${apt.size || "-"}</td>
        <td>${apt.confirmationStatus === "confirmed" ? "Confirmada" : apt.confirmationStatus === "cancelled" ? "Cancelada" : "Pendiente"}</td>
      </tr>
    `).join("");

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 2cm; color: #333; }
          h1 { font-size: 18px; color: #1e3a5f; margin-bottom: 4px; }
          .subtitle { font-size: 12px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f0f4f8; color: #1e3a5f; padding: 8px 6px; text-align: left; border-bottom: 2px solid #d0d7de; }
          td { padding: 6px; border-bottom: 1px solid #e8ecf0; }
          tr:nth-child(even) { background: #fafbfc; }
          .footer { margin-top: 20px; font-size: 10px; color: #999; border-top: 1px solid #e8ecf0; padding-top: 8px; }
          @media print { body { margin: 1cm; } }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p class="subtitle">Centro Hogar Sánchez — Generado el ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Proveedor</th>
              <th>Mercancía</th>
              <th style="text-align:center">Uds.</th>
              <th style="text-align:center">Muelle</th>
              <th style="text-align:center">Talla</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="8" style="text-align:center;padding:20px">No hay citas en esta semana</td></tr>'}
          </tbody>
        </table>
        <p class="footer">Total: ${weekAppointments.length} cita(s) · Almacén CentroHogar Sánchez</p>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="gap-1.5 text-xs hero-btn-ghost border-0"
      data-testid="button-export-pdf"
    >
      <FileDown className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Exportar PDF</span>
      <span className="sm:hidden">PDF</span>
    </Button>
  );
}
