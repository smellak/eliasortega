import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps?: {
    providerName: string;
    workMinutesNeeded: number;
    forkliftsNeeded: number;
    goodsType?: string;
  };
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: any) => void;
  onDateSelect?: (selectInfo: any) => void;
  onEventDrop?: (eventDropInfo: any) => void;
  readOnly?: boolean;
}

export function CalendarView({
  events,
  onEventClick,
  onDateSelect,
  onEventDrop,
  readOnly = false,
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<"timeGridDay" | "timeGridWeek">("timeGridWeek");

  const handlePrev = () => {
    calendarRef.current?.getApi().prev();
    setCurrentDate(calendarRef.current?.getApi().getDate() || new Date());
  };

  const handleNext = () => {
    calendarRef.current?.getApi().next();
    setCurrentDate(calendarRef.current?.getApi().getDate() || new Date());
  };

  const handleToday = () => {
    calendarRef.current?.getApi().today();
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev} data-testid="button-calendar-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday} data-testid="button-calendar-today">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext} data-testid="button-calendar-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold ml-2">{format(currentDate, "MMMM yyyy")}</h2>
        </div>

        <div className="flex gap-2">
          <Button
            variant={viewType === "timeGridDay" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setViewType("timeGridDay");
              calendarRef.current?.getApi().changeView("timeGridDay");
            }}
            data-testid="button-view-day"
          >
            Day
          </Button>
          <Button
            variant={viewType === "timeGridWeek" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setViewType("timeGridWeek");
              calendarRef.current?.getApi().changeView("timeGridWeek");
            }}
            data-testid="button-view-week"
          >
            Week
          </Button>
        </div>
      </div>

      <div className="calendar-container bg-card rounded-md border border-card-border p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
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
          eventContent={(eventInfo) => {
            const props = eventInfo.event.extendedProps;
            return (
              <div className="p-1 text-xs overflow-hidden">
                <div className="font-semibold truncate">{props.providerName}</div>
                <div className="font-mono text-[10px] opacity-90">
                  {format(new Date(eventInfo.event.start!), "HH:mm")} -{" "}
                  {format(new Date(eventInfo.event.end!), "HH:mm")}
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">
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
          padding: 0.5rem;
          font-weight: 600;
          background: hsl(var(--muted));
          color: hsl(var(--muted-foreground));
        }
        .fc .fc-timegrid-slot {
          height: 3rem;
        }
        .fc .fc-event {
          border-radius: 0.375rem;
          border: 1px solid;
          cursor: pointer;
        }
        .fc .fc-event-main {
          color: inherit;
        }
        .fc .fc-daygrid-day-number {
          padding: 0.25rem 0.5rem;
        }
      `}</style>
    </div>
  );
}
