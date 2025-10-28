import { CapacityWindowsTable } from '../capacity-windows-table'

export default function CapacityWindowsTableExample() {
  const windows = [
    {
      id: '1',
      startUtc: '2025-10-28T08:00:00',
      endUtc: '2025-10-28T20:00:00',
      workersAvailable: 3,
      forkliftsAvailable: 2,
      docksActive: 3,
    },
    {
      id: '2',
      startUtc: '2025-10-29T08:00:00',
      endUtc: '2025-10-29T20:00:00',
      workersAvailable: 2,
      forkliftsAvailable: 1,
      docksActive: 2,
    },
  ]

  return (
    <CapacityWindowsTable
      windows={windows}
      onAdd={(window) => console.log('Add:', window)}
      onEdit={(id, window) => console.log('Edit:', id, window)}
      onDelete={(id) => console.log('Delete:', id)}
    />
  )
}
