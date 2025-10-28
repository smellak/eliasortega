import { AppointmentDialog } from '../appointment-dialog'
import { useState } from 'react'

export default function AppointmentDialogExample() {
  const [open, setOpen] = useState(true)
  
  const providers = [
    { id: '1', name: 'Acme Corp' },
    { id: '2', name: 'Global Logistics' },
    { id: '3', name: 'Fast Shipping Inc' },
  ]

  return (
    <AppointmentDialog
      open={open}
      onOpenChange={setOpen}
      providers={providers}
      onSave={(data) => console.log('Saved:', data)}
    />
  )
}
