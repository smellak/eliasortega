interface DailySummaryData {
  date: string;
  totalAppointments: number;
  appointments: Array<{
    providerName: string;
    startTime: string;
    endTime: string;
    size?: string | null;
    pointsUsed?: number | null;
    slotStartTime?: string | null;
    goodsType?: string | null;
    workMinutesNeeded: number;
  }>;
  slotUsage?: Array<{
    startTime: string;
    endTime: string;
    usedPoints: number;
    maxPoints: number;
  }>;
}

interface AlertData {
  type: "new_appointment" | "updated_appointment" | "deleted_appointment" | "capacity_warning";
  appointment?: {
    providerName: string;
    startTime: string;
    endTime: string;
    size?: string | null;
    pointsUsed?: number | null;
    goodsType?: string | null;
    workMinutesNeeded: number;
  };
  message?: string;
}

export function buildDailySummaryHtml(data: DailySummaryData): string {
  const appointmentRows = data.appointments
    .map(
      (a) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${a.providerName}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${a.startTime} - ${a.endTime}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${a.size || "-"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${a.pointsUsed ?? "-"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${a.goodsType || "-"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${a.workMinutesNeeded} min</td>
      </tr>`
    )
    .join("");

  const slotRows = (data.slotUsage || [])
    .map((s) => {
      const pct = s.maxPoints > 0 ? Math.round((s.usedPoints / s.maxPoints) * 100) : 0;
      const color = pct >= 90 ? "#dc2626" : pct >= 70 ? "#f59e0b" : "#22c55e";
      return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${s.startTime} - ${s.endTime}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${s.usedPoints} / ${s.maxPoints}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <span style="color:${color};font-weight:bold;">${pct}%</span>
        </td>
      </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;">
  <div style="background:#1e40af;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:20px;">Centro Hogar Sanchez - Resumen Diario</h1>
    <p style="margin:8px 0 0;opacity:0.9;">${data.date}</p>
  </div>
  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;">
    <p style="margin:0 0 12px;color:#64748b;font-size:14px;">Este es el resumen de citas programadas para mañana.</p>
    <h2 style="margin:0 0 12px;font-size:16px;color:#334155;">
      ${data.totalAppointments} cita${data.totalAppointments !== 1 ? "s" : ""} programada${data.totalAppointments !== 1 ? "s" : ""}
    </h2>
    ${
      data.appointments.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#e2e8f0;">
                <th style="padding:8px;text-align:left;">Proveedor</th>
                <th style="padding:8px;text-align:left;">Horario</th>
                <th style="padding:8px;text-align:left;">Talla</th>
                <th style="padding:8px;text-align:left;">Puntos</th>
                <th style="padding:8px;text-align:left;">Tipo</th>
                <th style="padding:8px;text-align:left;">Duración</th>
              </tr>
            </thead>
            <tbody>${appointmentRows}</tbody>
          </table>`
        : `<p style="color:#64748b;">No hay citas programadas para este día.</p>`
    }
    ${
      slotRows
        ? `<h3 style="margin:20px 0 8px;font-size:15px;color:#334155;">Uso de Franjas</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#e2e8f0;">
                <th style="padding:8px;text-align:left;">Franja</th>
                <th style="padding:8px;text-align:left;">Puntos</th>
                <th style="padding:8px;text-align:left;">Ocupación</th>
              </tr>
            </thead>
            <tbody>${slotRows}</tbody>
          </table>`
        : ""
    }
  </div>
  <div style="padding:12px;text-align:center;color:#94a3b8;font-size:12px;">
    Sistema de Gestión de Citas - Centro Hogar Sanchez
  </div>
</body>
</html>`;
}

export function buildDailySummarySubject(date: string, count: number): string {
  return `Citas de almacén para MAÑANA ${date} — ${count} descarga${count !== 1 ? "s" : ""} programada${count !== 1 ? "s" : ""}`;
}

export function buildAlertHtml(data: AlertData): string {
  const typeLabels: Record<string, string> = {
    new_appointment: "Nueva Cita Creada",
    updated_appointment: "Cita Actualizada",
    deleted_appointment: "Cita Eliminada",
    capacity_warning: "Aviso de Capacidad",
  };

  const typeColors: Record<string, string> = {
    new_appointment: "#22c55e",
    updated_appointment: "#f59e0b",
    deleted_appointment: "#dc2626",
    capacity_warning: "#f97316",
  };

  const label = typeLabels[data.type] || "Alerta";
  const color = typeColors[data.type] || "#64748b";

  const appointmentInfo = data.appointment
    ? `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
      <tr><td style="padding:6px;font-weight:bold;width:140px;">Proveedor:</td><td style="padding:6px;">${data.appointment.providerName}</td></tr>
      <tr><td style="padding:6px;font-weight:bold;">Horario:</td><td style="padding:6px;">${data.appointment.startTime} - ${data.appointment.endTime}</td></tr>
      ${data.appointment.size ? `<tr><td style="padding:6px;font-weight:bold;">Talla:</td><td style="padding:6px;">${data.appointment.size}</td></tr>` : ""}
      ${data.appointment.pointsUsed != null ? `<tr><td style="padding:6px;font-weight:bold;">Puntos:</td><td style="padding:6px;">${data.appointment.pointsUsed}</td></tr>` : ""}
      ${data.appointment.goodsType ? `<tr><td style="padding:6px;font-weight:bold;">Tipo mercancía:</td><td style="padding:6px;">${data.appointment.goodsType}</td></tr>` : ""}
      <tr><td style="padding:6px;font-weight:bold;">Duración:</td><td style="padding:6px;">${data.appointment.workMinutesNeeded} min</td></tr>
    </table>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:${color};color:#fff;padding:16px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:18px;">${label}</h2>
  </div>
  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;">
    ${data.message ? `<p style="margin:0 0 12px;color:#334155;">${data.message}</p>` : ""}
    ${appointmentInfo}
  </div>
  <div style="padding:12px;text-align:center;color:#94a3b8;font-size:12px;">
    Sistema de Gestión de Citas - Centro Hogar Sanchez
  </div>
</body>
</html>`;
}

export function buildAlertSubject(type: AlertData["type"], providerName?: string): string {
  const prefixes: Record<string, string> = {
    new_appointment: "Nueva cita",
    updated_appointment: "Cita actualizada",
    deleted_appointment: "Cita eliminada",
    capacity_warning: "Aviso de capacidad",
  };
  const prefix = prefixes[type] || "Alerta";
  return providerName ? `${prefix}: ${providerName}` : prefix;
}
