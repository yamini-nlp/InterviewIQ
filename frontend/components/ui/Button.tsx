import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-500 hover:bg-primary-400 text-white shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30",
  secondary:
    "bg-secondary-500 hover:bg-secondary-400 text-white shadow-lg shadow-secondary-500/20 hover:shadow-secondary-500/30",
  outline:
    "border border-neutral-300 hover:border-neutral-400 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 bg-transparent",
  ghost: "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 bg-transparent",
  destructive: "bg-error-500 hover:bg-error-600 text-white shadow-lg shadow-error-500/20",
  danger: "bg-error-500 hover:bg-error-600 text-white shadow-lg shadow-error-500/20",
  link: "text-primary-500 hover:text-primary-400 underline-offset-4 hover:underline bg-transparent shadow-none",
};

const sizeTextClasses: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
  icon: "text-sm",
};

const sizePaddingClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5",
  md: "px-5 py-2.5",
  lg: "px-7 py-3.5",
  icon: "h-10 w-10 p-0 justify-center",
};

const spinnerSize: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
  icon: 16,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, leftIcon, rightIcon, className, children, disabled, type = "button", ...props },
  ref
) {
  const isLink = variant === "link";

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-disabled={disabled || loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50",
        variantClasses[variant],
        sizeTextClasses[size],
        isLink ? "p-0 h-auto" : sizePaddingClasses[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={spinnerSize[size]} className="animate-spin" aria-hidden="true" />}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

Button.displayName = "Button";