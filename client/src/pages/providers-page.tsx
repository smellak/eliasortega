import { ProvidersTable } from "@/components/providers-table";

interface ProvidersPageProps {
  userRole: "admin" | "planner" | "basic_readonly";
}

export default function ProvidersPage({ userRole }: ProvidersPageProps) {
  const isReadOnly = userRole === "basic_readonly";

  // TODO: remove mock data
  const providers = [
    { id: '1', name: 'Acme Corp', notes: 'Main electronics supplier' },
    { id: '2', name: 'Global Logistics', notes: '' },
    { id: '3', name: 'Fast Shipping Inc', notes: 'Express deliveries only' },
  ];

  const handleAdd = (provider: any) => {
    console.log("Add provider:", provider);
    // TODO: Call API
  };

  const handleEdit = (id: string, provider: any) => {
    console.log("Edit provider:", id, provider);
    // TODO: Call API
  };

  const handleDelete = (id: string) => {
    console.log("Delete provider:", id);
    // TODO: Call API
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Providers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your warehouse delivery providers
        </p>
      </div>

      <ProvidersTable
        providers={providers}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        readOnly={isReadOnly}
      />
    </div>
  );
}
