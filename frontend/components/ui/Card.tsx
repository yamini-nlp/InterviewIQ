import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type CardVariant = "elevated" | "flat" | "glass" | "outlined";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  elevated: "card-elevated",
  flat: "card-flat",
  glass: "glass rounded-2xl",
  outlined: "border border-neutral-200 rounded-2xl bg-transparent",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "glass", className, children, ...props },
  ref
) {
  return (
    <div ref={ref} className={cn(variantClasses[variant], "p-6", className)} {...props}>
      {children}
    </div>
  );
});
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardHeader(
  { className, children, ...props },
  ref
) {
  return (
    <div ref={ref} className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  );
});
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(function CardTitle(
  { className, children, ...props },
  ref
) {
  return (
    <h3 ref={ref} className={cn("font-display text-lg font-semibold text-neutral-900", className)} {...props}>
      {children}
    </h3>
  );
});
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className, children, ...props }, ref) {
    return (
      <p ref={ref} className={cn("mt-1 text-sm text-neutral-600", className)} {...props}>
        {children}
      </p>
    );
  }
);
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardContent(
  { className, children, ...props },
  ref
) {
  return (
    <div ref={ref} className={cn("text-sm text-neutral-700", className)} {...props}>
      {children}
    </div>
  );
});
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardFooter(
  { className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("mt-6 pt-4 border-t border-neutral-200 flex items-center justify-end gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
});
CardFooter.displayName = "CardFooter";