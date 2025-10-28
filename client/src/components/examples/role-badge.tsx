import { RoleBadge } from '../role-badge'

export default function RoleBadgeExample() {
  return (
    <div className="flex gap-2">
      <RoleBadge role="admin" />
      <RoleBadge role="planner" />
      <RoleBadge role="basic_readonly" />
    </div>
  )
}
