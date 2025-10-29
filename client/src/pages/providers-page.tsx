import { useQuery, useMutation } from "@tanstack/react-query";
import { ProvidersTable } from "@/components/providers-table";
import { providersApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Provider, CreateProviderInput, UpdateProviderInput } from "@shared/types";
import { Card } from "@/components/ui/card";

interface ProvidersPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

export default function ProvidersPage({ userRole }: ProvidersPageProps) {
  const { toast } = useToast();
  const isReadOnly = userRole === "BASIC_READONLY";

  // Fetch providers
  const { data: providers = [], isLoading, error } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    queryFn: () => providersApi.list(),
  });

  // Create provider mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateProviderInput) => providersApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      toast({
        title: "Success",
        description: "Provider created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create provider",
        variant: "destructive",
      });
    },
  });

  // Update provider mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProviderInput }) =>
      providersApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      toast({
        title: "Success",
        description: "Provider updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update provider",
        variant: "destructive",
      });
    },
  });

  // Delete provider mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => providersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      toast({
        title: "Success",
        description: "Provider deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete provider",
        variant: "destructive",
      });
    },
  });

  const handleAdd = (provider: { name: string; notes?: string }) => {
    createMutation.mutate(provider);
  };

  const handleEdit = (id: string, provider: { name?: string; notes?: string }) => {
    updateMutation.mutate({ id, input: provider });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this provider?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Providers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your warehouse delivery providers
          </p>
        </div>
        <Card className="p-12">
          <div className="text-center text-muted-foreground">Loading providers...</div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Providers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your warehouse delivery providers
          </p>
        </div>
        <Card className="p-12">
          <div className="text-center text-destructive">
            Error loading providers: {(error as Error).message}
          </div>
        </Card>
      </div>
    );
  }

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
