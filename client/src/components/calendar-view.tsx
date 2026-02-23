import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps?: {
    providerName: string;
    workMinutesNeeded: number;
    forkliftsNeeded: number;
    goodsType?: string | null;
  };
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: any) => void;
  onDateSelect?: (selectInfo: any) => void;
  onEventDrop?: (eventDropInfo: any) => void;
  onViewChange?: (view: "dayGridMonth" | "timeGridWeek" | "timeGridDay") => void;
  onDateChange?: (date: Date) => void;
  onDatesChange?: (startDate: Date, endDate: Date, viewType: "dayGridMonth" | "timeGridWeek" | "timeGridDay", currentStart?: Date) => void;
  readOnly?: boolean;
}

export function CalendarView({
  events,
  onEventClick,
  onDateSelect,
  onEventDrop,
  onViewChange,
  onDateChange,
  onDatesChange,
  readOnly = false,
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<"dayGridMonth" | "timeGridWeek" | "timeGridDay">("timeGridWeek");

  const handlePrev = () => {
    calendarRef.current?.getApi().prev();
    const newDate = calendarRef.current?.getApi().getDate() || new Date();
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  const handleNext = () => {
    calendarRef.current?.getApi().next();
    const newDate = calendarRef.current?.getApi().getDate() || new Date();
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  const handleToday = () => {
    calendarRef.current?.getApi().today();
    const newDate = new Date();
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev} data-testid="button-calendar-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday} data-testid="button-calendar-today">
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext} data-testid="button-calendar-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold ml-2 capitalize">{format(currentDate, "MMMM yyyy", { locale: es })}</h2>
        </div>

        <div className="flex gap-0.5 rounded-full bg-muted p-1">
          <Button
            variant={viewType === "dayGridMonth" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => {
              setViewType("dayGridMonth");
              calendarRef.current?.getApi().changeView("dayGridMonth");
              onViewChange?.("dayGridMonth");
            }}
            data-testid="button-view-month"
          >
            Mes
          </Button>
          <Button
            variant={viewType === "timeGridWeek" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => {
              setViewType("timeGridWeek");
              calendarRef.current?.getApi().changeView("timeGridWeek");
              onViewChange?.("timeGridWeek");
            }}
            data-testid="button-view-week"
          >
            Semana
          </Button>
          <Button
            variant={viewType === "timeGridDay" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => {
              setViewType("timeGridDay");
              calendarRef.current?.getApi().changeView("timeGridDay");
              onViewChange?.("timeGridDay");
            }}
            data-testid="button-view-day"
          >
            Día
          </Button>
        </div>
      </div>

      <div className="calendar-container bg-card rounded-xl border border-card-border p-4 shadow-sm">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={false}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          allDaySlot={false}
          height="auto"
          events={events}
          editable={!readOnly}
          selectable={!readOnly}
          selectMirror={true}
          dayMaxEvents={true}
          eventClick={onEventClick}
          select={onDateSelect}
          eventDrop={onEventDrop}
          datesSet={(dateInfo) => {
            // FullCalendar notifies when the date range changes
            const startDate = dateInfo.start;
            const endDate = dateInfo.end;
            const viewType = dateInfo.view.type as "dayGridMonth" | "timeGridWeek" | "timeGridDay";
            const currentStart = dateInfo.view.currentStart; // This is the actual month/week/day start
            
            setCurrentDate(currentStart);
            
            // Pass the actual view's current start instead of the render range
            onDatesChange?.(startDate, endDate, viewType, currentStart);
          }}
          eventContent={(eventInfo) => {
            const props = eventInfo.event.extendedProps;
            return (
              <div className="p-1.5 text-xs overflow-hidden">
                <div className="font-semibold truncate text-white">{props.providerName}</div>
                <div className="font-mono text-[10px] text-white/85">
                  {format(new Date(eventInfo.event.start!), "HH:mm", { locale: es })} -{" "}
                  {format(new Date(eventInfo.event.end!), "HH:mm", { locale: es })}
                </div>
                <div className="text-[10px] text-white/70 mt-0.5">
                  W:{props.workMinutesNeeded} F:{props.forkliftsNeeded}
                </div>
              </div>
            );
          }}
        />
      </div>

      <style>{`
        .fc {
          font-family: inherit;
        }
        .fc .fc-button {
          display: none;
        }
        .fc .fc-col-header-cell {
          padding: 0.5rem 0.75rem;
          font-weight: 600;
          background: linear-gradient(135deg, hsl(213 94% 97%), hsl(213 40% 95%));
          color: hsl(213 50% 30%);
        }
        .dark .fc .fc-col-header-cell {
          background: linear-gradient(135deg, hsl(213 30% 12%), hsl(213 20% 15%));
          color: hsl(213 50% 80%);
        }
        .fc .fc-timegrid-slot {
          height: 3rem;
          transition: background-color 0.15s ease;
        }
        .fc .fc-timegrid-slot:hover {
          background: hsl(213 60% 97%);
        }
        .dark .fc .fc-timegrid-slot:hover {
          background: hsl(213 20% 14%);
        }
        .fc .fc-event {
          border-radius: 0.5rem;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 102, 204, 0.25);
          background: linear-gradient(135deg, hsl(213 94% 52%), hsl(213 94% 42%));
          transition: box-shadow 0.2s ease, transform 0.15s ease;
        }
        .fc .fc-event:hover {
          box-shadow: 0 4px 12px rgba(0, 102, 204, 0.35);
        }
        .fc .fc-event-main {
          color: white;
        }
        .fc .fc-daygrid-day-number {
          padding: 0.375rem 0.625rem;
          font-weight: 500;
          color: hsl(213 30% 35%);
        }
        .dark .fc .fc-daygrid-day-number {
          color: hsl(213 30% 75%);
        }
        .fc .fc-day-today {
          background: hsl(213 80% 97%) !important;
        }
        .dark .fc .fc-day-today {
          background: hsl(213 30% 13%) !important;
        }
      `}</style>
    </div>
  );
}
