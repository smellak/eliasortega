import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Card className="p-16">
      <div className="text-center text-muted-foreground">
        <Icon className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-base font-semibold">{title}</p>
        {description && <p className="text-sm mt-1.5">{description}</p>}
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            className="mt-4 gradient-btn text-white border-0 no-default-hover-elevate no-default-active-elevate"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}
