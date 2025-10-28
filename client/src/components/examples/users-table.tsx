import { UsersTable } from '../users-table'

export default function UsersTableExample() {
  const users = [
    { id: '1', email: 'admin@example.com', role: 'admin' as const },
    { id: '2', email: 'planner@example.com', role: 'planner' as const },
    { id: '3', email: 'viewer@example.com', role: 'basic_readonly' as const },
  ]

  return (
    <UsersTable
      users={users}
      onAdd={(user) => console.log('Add:', user)}
      onEdit={(id, user) => console.log('Edit:', id, user)}
      onDelete={(id) => console.log('Delete:', id)}
    />
  )
}
