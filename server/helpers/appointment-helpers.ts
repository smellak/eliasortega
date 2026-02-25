import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "../db/client";
import { slotCapacityValidator } from "../services/slot-validator";
import { getMadridMidnight } from "../utils/madrid-date";
import { normalizeCategory, estimateLines, estimateDeliveryNotes } from "../config/estimation-ratios";

export function formatToMadridLocal(date: Date): string {
  return formatInTimeZone(date, 'Europe/Madrid', 'dd/MM/yyyy, HH:mm');
}

export function resolveEstimationsForRoute(goodsType: string | null, units: number | null, lines: number | null, deliveryNotesCount: number | null): { lines: number | null; deliveryNotesCount: number | null; estimatedFields: string[] } {
  const estimated: string[] = [];
  let resolvedLines = lines;
  let resolvedDN = deliveryNotesCount;

  if (goodsType && units != null && units > 0) {
    const category = normalizeCategory(goodsType);
    if (category) {
      if (resolvedLines == null) {
        resolvedLines = estimateLines(category, units);
        estimated.push("lines");
      }
      if (resolvedDN == null) {
        resolvedDN = estimateDeliveryNotes(category);
        estimated.push("deliveryNotesCount");
      }
    }
  }

  return { lines: resolvedLines, deliveryNotesCount: resolvedDN, estimatedFields: estimated };
}

export async function findAppointmentsWithDockFallback(
  where: any,
  orderBy?: any,
  client: any = prisma,
): Promise<any[]> {
  try {
    return await client.appointment.findMany({ where, include: { dock: true }, ...(orderBy ? { orderBy } : {}) });
  } catch {
    return await client.appointment.findMany({ where, ...(orderBy ? { orderBy } : {}) });
  }
}

export function normalizeAppointmentResponse(a: any) {
  return {
    ...a,
    dockCode: a.dock?.code || null,
    dockName: a.dock?.name || null,
    dock: undefined,
    estimatedFields: a.estimatedFields && typeof a.estimatedFields === "string"
      ? JSON.parse(a.estimatedFields)
      : a.estimatedFields || null,
  };
}

export async function upsertAppointmentInternal(data: {
  externalRef: string;
  providerId: string | null;
  providerName: string;
  start: string;
  end: string;
  workMinutesNeeded: number;
  forkliftsNeeded: number;
  goodsType: string | null;
  units: number | null;
  lines: number | null;
  deliveryNotesCount: number | null;
  providerEmail?: string | null;
  providerPhone?: string | null;
}) {
  const est = resolveEstimationsForRoute(data.goodsType, data.units, data.lines, data.deliveryNotesCount);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findUnique({
      where: { externalRef: data.externalRef },
    });

    const { size, points: pointsUsed } = slotCapacityValidator.determineSizeAndPoints(data.workMinutesNeeded);
    const startDate = new Date(data.start);
    const slotDate = getMadridMidnight(startDate);
    const resolvedSlotStart = await slotCapacityValidator.resolveSlotStartTime(startDate, tx);
    const slotStartTime = resolvedSlotStart || formatInTimeZone(startDate, 'Europe/Madrid', 'HH:mm');

    const startUtcDate = new Date(data.start);
    const endUtcDate = new Date(data.end);
    const slotValidation = await slotCapacityValidator.validateSlotCapacity(
      slotDate,
      slotStartTime,
      pointsUsed,
      startUtcDate,
      endUtcDate,
      existing?.id,
      tx
    );

    if (!slotValidation.valid) {
      return {
        success: false as const,
        conflict: {
          slotStartTime: slotValidation.slotStartTime,
          slotEndTime: slotValidation.slotEndTime || "",
          maxPoints: slotValidation.maxPoints,
          pointsUsed: slotValidation.pointsUsed,
          pointsNeeded: pointsUsed,
          reason: slotValidation.reason,
          message: slotValidation.error || "Slot sin capacidad disponible",
        },
      };
    }

    // Use adjusted times if the dock assignment required a time shift
    const finalStartUtc = slotValidation.adjustedStartUtc || new Date(data.start);
    const finalEndUtc = slotValidation.adjustedEndUtc || new Date(data.end);

    if (existing) {
      const appointment = await tx.appointment.update({
        where: { id: existing.id },
        data: {
          providerId: data.providerId,
          providerName: data.providerName,
          startUtc: finalStartUtc,
          endUtc: finalEndUtc,
          workMinutesNeeded: data.workMinutesNeeded,
          forkliftsNeeded: data.forkliftsNeeded,
          goodsType: data.goodsType,
          units: data.units,
          lines: est.lines,
          deliveryNotesCount: est.deliveryNotesCount,
          estimatedFields: est.estimatedFields.length > 0 ? JSON.stringify(est.estimatedFields) : null,
          providerEmail: data.providerEmail || null,
          providerPhone: data.providerPhone || null,
          size,
          pointsUsed,
          slotDate,
          slotStartTime: slotValidation.slotStartTime,
          dockId: slotValidation.assignedDock?.id || null,
        },
      });

      return { success: true as const, action: "updated" as const, appointment, assignedDock: slotValidation.assignedDock };
    }

    const appointment = await tx.appointment.create({
      data: {
        providerId: data.providerId,
        providerName: data.providerName,
        startUtc: finalStartUtc,
        endUtc: finalEndUtc,
        workMinutesNeeded: data.workMinutesNeeded,
        forkliftsNeeded: data.forkliftsNeeded,
        goodsType: data.goodsType,
        units: data.units,
        lines: est.lines,
        deliveryNotesCount: est.deliveryNotesCount,
        estimatedFields: est.estimatedFields.length > 0 ? JSON.stringify(est.estimatedFields) : null,
        providerEmail: data.providerEmail || null,
        providerPhone: data.providerPhone || null,
        externalRef: data.externalRef,
        size,
        pointsUsed,
        slotDate,
        slotStartTime: slotValidation.slotStartTime,
        dockId: slotValidation.assignedDock?.id || null,
      },
    });

    return { success: true as const, action: "created" as const, appointment, assignedDock: slotValidation.assignedDock };
  }, { isolationLevel: "Serializable" });
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildConfirmationPage(status: string, appt: any, contactPhone: string): string {
  const header = `<div style="background:#1e40af;color:#fff;padding:20px;text-align:center;">
    <h1 style="margin:0;font-size:20px;">Centro Hogar Sánchez</h1>
    <p style="margin:4px 0 0;font-size:13px;opacity:0.85;">Gestión de Descargas</p>
  </div>`;
  const footer = `<div style="padding:16px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;">
    ${contactPhone ? `Teléfono de contacto: <strong>${escapeHtml(contactPhone)}</strong><br>` : ""}
    Centro Hogar Sánchez — Sistema de Gestión de Citas
  </div>`;
  const wrap = (body: string) => `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmar Cita</title></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;"><div style="max-width:500px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">${header}<div style="padding:24px;">${body}</div>${footer}</div></body></html>`;

  if (status === "error" || !appt) {
    return wrap(`<div style="text-align:center;padding:20px 0;"><p style="font-size:18px;color:#dc2626;font-weight:600;">Enlace no válido</p><p style="color:#64748b;">Este enlace no es válido o ha expirado. Si necesitas ayuda, contacta con el almacén.</p></div>`);
  }

  const dateStr = formatInTimeZone(appt.startUtc, "Europe/Madrid", "dd/MM/yyyy");
  const startTime = formatInTimeZone(appt.startUtc, "Europe/Madrid", "HH:mm");
  const endTime = formatInTimeZone(appt.endUtc, "Europe/Madrid", "HH:mm");
  const sizeLabel = appt.size === "S" ? "Pequeña" : appt.size === "M" ? "Mediana" : appt.size === "L" ? "Grande" : "";
  const summary = `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Proveedor</td><td style="padding:10px;border:1px solid #e2e8f0;">${escapeHtml(appt.providerName)}</td></tr>
    <tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Fecha</td><td style="padding:10px;border:1px solid #e2e8f0;">${dateStr}</td></tr>
    <tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Horario</td><td style="padding:10px;border:1px solid #e2e8f0;">${startTime} — ${endTime}</td></tr>
    ${appt.goodsType ? `<tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Mercancía</td><td style="padding:10px;border:1px solid #e2e8f0;">${escapeHtml(appt.goodsType || "")}</td></tr>` : ""}
    ${sizeLabel ? `<tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Tamaño</td><td style="padding:10px;border:1px solid #e2e8f0;">${sizeLabel}</td></tr>` : ""}
    ${appt.dock ? `<tr><td style="padding:10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">Muelle</td><td style="padding:10px;border:1px solid #e2e8f0;">${escapeHtml(appt.dock.name)}</td></tr>` : ""}
  </table>`;

  if (status === "confirmed") {
    const confirmedDate = appt.confirmedAt ? formatInTimeZone(appt.confirmedAt, "Europe/Madrid", "dd/MM/yyyy HH:mm") : "";
    return wrap(`<div style="text-align:center;padding:8px 0;"><p style="font-size:24px;margin:0;">✅</p><p style="font-size:18px;color:#16a34a;font-weight:600;margin:8px 0;">Cita confirmada</p></div>${summary}<p style="text-align:center;color:#16a34a;font-weight:600;">¡Nos vemos el ${dateStr}!</p>${confirmedDate ? `<p style="text-align:center;font-size:12px;color:#94a3b8;">Confirmada el ${confirmedDate}</p>` : ""}`);
  }

  if (status === "cancelled") {
    const cancelledDate = appt.cancelledAt ? formatInTimeZone(appt.cancelledAt, "Europe/Madrid", "dd/MM/yyyy HH:mm") : "";
    return wrap(`<div style="text-align:center;padding:8px 0;"><p style="font-size:24px;margin:0;">❌</p><p style="font-size:18px;color:#dc2626;font-weight:600;margin:8px 0;">Cita anulada</p></div>${summary}${appt.cancellationReason ? `<p style="color:#64748b;font-size:13px;"><strong>Motivo:</strong> ${escapeHtml(appt.cancellationReason || "")}</p>` : ""}<p style="text-align:center;color:#64748b;">Si necesitas reprogramar, contacta con el almacén.</p>${cancelledDate ? `<p style="text-align:center;font-size:12px;color:#94a3b8;">Anulada el ${cancelledDate}</p>` : ""}`);
  }

  // Pending — show confirm/cancel buttons
  const token = appt.confirmationToken;
  return wrap(`<p style="font-size:16px;margin:0 0 16px;"><strong>Datos de tu cita:</strong></p>${summary}
    <div id="actions">
      <div style="text-align:center;margin:24px 0;">
        <button onclick="doAction('confirm')" style="display:block;width:100%;background:#16a34a;color:#fff;border:none;padding:16px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-bottom:12px;min-height:48px;">✅ Confirmo mi cita</button>
        <button onclick="showCancel()" style="display:block;width:100%;background:#dc2626;color:#fff;border:none;padding:16px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;min-height:48px;">❌ Necesito anular</button>
      </div>
    </div>
    <div id="cancel-form" style="display:none;margin:16px 0;">
      <p style="font-weight:600;margin-bottom:8px;">¿Por qué necesitas anular? (opcional)</p>
      <textarea id="cancel-reason" rows="3" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;box-sizing:border-box;" placeholder="Motivo de la anulación..."></textarea>
      <button onclick="doAction('cancel')" style="display:block;width:100%;background:#dc2626;color:#fff;border:none;padding:14px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:12px;">Confirmar anulación</button>
      <button onclick="hideCancel()" style="display:block;width:100%;background:#e2e8f0;color:#475569;border:none;padding:12px;border-radius:8px;font-size:14px;cursor:pointer;margin-top:8px;">Volver</button>
    </div>
    <div id="result" style="display:none;text-align:center;padding:20px 0;"></div>
    <script>
      function showCancel(){document.getElementById('actions').style.display='none';document.getElementById('cancel-form').style.display='block';}
      function hideCancel(){document.getElementById('actions').style.display='block';document.getElementById('cancel-form').style.display='none';}
      function doAction(action){
        var reason=action==='cancel'?document.getElementById('cancel-reason').value:'';
        document.getElementById('actions').style.display='none';
        document.getElementById('cancel-form').style.display='none';
        document.getElementById('result').style.display='block';
        document.getElementById('result').innerHTML='<p style="color:#64748b;">Procesando...</p>';
        fetch('/api/appointments/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'${token}',action:action,reason:reason||undefined})})
        .then(function(r){return r.json()})
        .then(function(d){
          if(d.success){
            if(action==='confirm'){document.getElementById('result').innerHTML='<p style="font-size:24px;">✅</p><p style="font-size:18px;color:#16a34a;font-weight:600;">¡Cita confirmada!</p><p style="color:#64748b;">Nos vemos el día de la descarga.</p>';}
            else{document.getElementById('result').innerHTML='<p style="font-size:24px;">❌</p><p style="font-size:18px;color:#dc2626;font-weight:600;">Cita anulada</p><p style="color:#64748b;">Hemos informado al almacén.</p>';}
          }else{var e=document.createElement('p');e.style.color='#dc2626';e.textContent=d.error||'Error desconocido';document.getElementById('result').innerHTML='';document.getElementById('result').appendChild(e);document.getElementById('actions').style.display='block';}
        })
        .catch(function(){document.getElementById('result').innerHTML='<p style="color:#dc2626;">Error de conexión. Inténtalo de nuevo.</p>';document.getElementById('actions').style.display='block';});
      }
    </script>`);
}
