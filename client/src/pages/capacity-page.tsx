import { useQuery, useMutation } from "@tanstack/react-query";
import { CapacityWindowsTable } from "@/components/capacity-windows-table";
import { capacityShiftsApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CapacityShift, CreateCapacityShiftInput, UpdateCapacityShiftInput } from "@shared/types";
import { Card } from "@/components/ui/card";

interface CapacityPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

export default function CapacityPage({ userRole }: CapacityPageProps) {
  const { toast } = useToast();
  const isReadOnly = userRole === "BASIC_READONLY";

  // Fetch capacity shifts
  const { data: windows = [], isLoading, error } = useQuery<CapacityShift[]>({
    queryKey: ["/api/capacity-shifts"],
    queryFn: () => capacityShiftsApi.list(),
  });

  // Create capacity shift mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateCapacityShiftInput) => capacityShiftsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity-shifts"] });
      toast({
        title: "Success",
        description: "Capacity window created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create capacity window",
        variant: "destructive",
      });
    },
  });

  // Update capacity shift mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCapacityShiftInput }) =>
      capacityShiftsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity-shifts"] });
      toast({
        title: "Success",
        description: "Capacity window updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update capacity window",
        variant: "destructive",
      });
    },
  });

  // Delete capacity shift mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => capacityShiftsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity-shifts"] });
      toast({
        title: "Success",
        description: "Capacity window deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete capacity window",
        variant: "destructive",
      });
    },
  });

  const handleAdd = (window: any) => {
    createMutation.mutate(window);
  };

  const handleEdit = (id: string, window: any) => {
    updateMutation.mutate({ id, input: window });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this capacity window?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Capacity Windows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define warehouse capacity for different time periods
          </p>
        </div>
        <Card className="p-12">
          <div className="text-center text-muted-foreground">Loading capacity windows...</div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Capacity Windows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define warehouse capacity for different time periods
          </p>
        </div>
        <Card className="p-12">
          <div className="text-center text-destructive">
            Error loading capacity windows: {(error as Error).message}
          </div>
        </Card>
      </div>
    );
  }

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
