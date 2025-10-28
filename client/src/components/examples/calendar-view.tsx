import { CalendarView } from '../calendar-view'

export default function CalendarViewExample() {
  const events = [
    {
      id: '1',
      title: 'Acme Corp',
      start: '2025-10-28T09:00:00',
      end: '2025-10-28T11:00:00',
      extendedProps: {
        providerName: 'Acme Corp',
        workMinutesNeeded: 90,
        forkliftsNeeded: 2,
        goodsType: 'Electronics',
      },
    },
    {
      id: '2',
      title: 'Global Logistics',
      start: '2025-10-28T14:00:00',
      end: '2025-10-28T15:30:00',
      extendedProps: {
        providerName: 'Global Logistics',
        workMinutesNeeded: 60,
        forkliftsNeeded: 1,
      },
    },
  ]

  return (
    <CalendarView
      events={events}
      onEventClick={(e) => console.log('Event clicked:', e)}
      onDateSelect={(e) => console.log('Date selected:', e)}
      onEventDrop={(e) => console.log('Event dropped:', e)}
    />
  )
}
