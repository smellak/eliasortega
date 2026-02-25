import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { appointmentsApi } from "@/lib/api";
import { formatInTimeZone } from "date-fns-tz";
import type { Appointment } from "@shared/types";

const TIMEZONE = "Europe/Madrid";

export function useNewAppointmentToast() {
  const { toast } = useToast();
  const lastKnownIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const appointments = await appointmentsApi.list();
        if (appointments.length === 0) return;

        // Sort by createdAt descending to find newest
        const sorted = [...appointments].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const newest = sorted[0];

        if (!initializedRef.current) {
          lastKnownIdRef.current = newest.id;
          initializedRef.current = true;
          return;
        }

        if (newest.id !== lastKnownIdRef.current) {
          lastKnownIdRef.current = newest.id;
          const dateStr = formatInTimeZone(new Date(newest.startUtc), TIMEZONE, "EEE d/M HH:mm");
          toast({
            title: "Nueva cita creada",
            description: `${newest.providerName} — ${dateStr}`,
          });
        }
      } catch {
        // Polling failure is non-critical
      }
    };

    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [toast]);
}
