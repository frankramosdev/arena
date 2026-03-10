import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "background: var(--bg-tertiary); color: var(--text-secondary);",
  success: "background: var(--green-soft); color: #166534;",
  warning: "background: var(--amber-soft); color: #92400E;",
  error: "background: var(--red-soft); color: #991B1B;",
  info: "background: #DBEAFE; color: #1E40AF;",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full
        text-xs font-medium
        ${className || ""}
      `}
      style={Object.fromEntries(
        variantStyles[variant].split(";").filter(Boolean).map((s) => {
          const [key, value] = s.split(":").map((x) => x.trim());
          return [key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value];
        })
      )}
    >
      {children}
    </span>
  );
}
