import { ProvidersTable } from '../providers-table'

export default function ProvidersTableExample() {
  const providers = [
    { id: '1', name: 'Acme Corp', notes: 'Main electronics supplier' },
    { id: '2', name: 'Global Logistics', notes: '' },
    { id: '3', name: 'Fast Shipping Inc', notes: 'Express deliveries only' },
  ]

  return (
    <ProvidersTable
      providers={providers}
      onAdd={(provider) => console.log('Add:', provider)}
      onEdit={(id, provider) => console.log('Edit:', id, provider)}
      onDelete={(id) => console.log('Delete:', id)}
    />
  )
}
