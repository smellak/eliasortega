import { UsersTable } from "@/components/users-table";

export default function UsersPage() {
  // TODO: remove mock data
  const users = [
    { id: '1', email: 'admin@example.com', role: 'admin' as const },
    { id: '2', email: 'planner@example.com', role: 'planner' as const },
    { id: '3', email: 'viewer@example.com', role: 'basic_readonly' as const },
  ];

  const handleAdd = (user: any) => {
    console.log("Add user:", user);
    // TODO: Call API
  };

  const handleEdit = (id: string, user: any) => {
    console.log("Edit user:", id, user);
    // TODO: Call API
  };

  const handleDelete = (id: string) => {
    console.log("Delete user:", id);
    // TODO: Call API
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage user accounts and permissions
        </p>
      </div>

      <UsersTable
        users={users}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
