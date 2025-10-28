import { CapacityWindowsTable } from "@/components/capacity-windows-table";

interface CapacityPageProps {
  userRole: "admin" | "planner" | "basic_readonly";
}

export default function CapacityPage({ userRole }: CapacityPageProps) {
  const isReadOnly = userRole === "basic_readonly";

  // TODO: remove mock data
  const windows = [
    {
      id: '1',
      startUtc: '2025-10-28T06:00:00Z',
      endUtc: '2025-10-28T18:00:00Z',
      workersAvailable: 3,
      forkliftsAvailable: 2,
      docksActive: 3,
    },
    {
      id: '2',
      startUtc: '2025-10-29T06:00:00Z',
      endUtc: '2025-10-29T18:00:00Z',
      workersAvailable: 2,
      forkliftsAvailable: 1,
      docksActive: 2,
    },
  ];

  const handleAdd = (window: any) => {
    console.log("Add window:", window);
    // TODO: Call API
  };

  const handleEdit = (id: string, window: any) => {
    console.log("Edit window:", id, window);
    // TODO: Call API
  };

  const handleDelete = (id: string) => {
    console.log("Delete window:", id);
    // TODO: Call API
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Capacity Windows</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define warehouse capacity for different time periods
        </p>
      </div>

      <CapacityWindowsTable
        windows={windows}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        readOnly={isReadOnly}
      />
    </div>
  );
}
