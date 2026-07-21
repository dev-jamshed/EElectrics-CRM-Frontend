import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost" | "outline" | "destructive";
  size?: "sm" | "md" | "icon";
  asChild?: boolean;
  loading?: boolean;
};

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-secondary text-foreground",
  outline: "border border-border bg-background hover:bg-secondary",
  destructive: "bg-red-600 text-white hover:bg-red-700"
};

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4",
  icon: "h-10 w-10"
};

export function Button({ className, variant = "default", size = "md", asChild, loading, children, disabled, ...props }: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 ease-smooth active:scale-[0.98] focus:outline-none disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
    variants[variant],
    sizes[size],
    className
  );

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
      className: cn(classes, children.props.className)
    });
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
