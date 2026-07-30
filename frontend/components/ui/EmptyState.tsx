import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3 className="font-display text-lg font-semibold text-neutral-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-neutral-600">{description}</p>}
      {action && (
        <Button size="sm" className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}