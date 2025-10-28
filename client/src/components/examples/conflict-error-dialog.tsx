import { ConflictErrorDialog } from '../conflict-error-dialog'
import { useState } from 'react'

export default function ConflictErrorDialogExample() {
  const [open, setOpen] = useState(true)
  
  const error = {
    minute: '2025-10-28T09:37:00Z',
    minuteMadrid: '2025-10-28 10:37',
    workUsed: 3.2,
    workAvailable: 3.0,
    forkliftsUsed: 3,
    forkliftsAvailable: 2,
    docksUsed: 2,
    docksAvailable: 3,
    failedRule: 'forklifts' as const,
  }

  return (
    <ConflictErrorDialog
      open={open}
      onOpenChange={setOpen}
      error={error}
    />
  )
}
