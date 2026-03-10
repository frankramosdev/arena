"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "yes" | "no";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, { base: string; hover: string }> = {
  primary: {
    base: "background: var(--accent-primary); color: white;",
    hover: "background: var(--accent-hover); transform: translateY(-1px); box-shadow: var(--shadow-md);",
  },
  secondary: {
    base: "background: var(--bg-secondary); color: var(--text-primary);",
    hover: "background: var(--bg-tertiary);",
  },
  outline: {
    base: "background: transparent; color: var(--text-primary); border: 1px solid var(--border-medium);",
    hover: "background: var(--bg-secondary); border-color: var(--border-medium);",
  },
  ghost: {
    base: "background: transparent; color: var(--text-secondary);",
    hover: "background: var(--bg-secondary); color: var(--text-primary);",
  },
  yes: {
    base: "background: var(--green-soft); color: #166534;",
    hover: "background: #BBF7D0;",
  },
  no: {
    base: "background: var(--red-soft); color: #991B1B;",
    hover: "background: #FECACA;",
  },
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-6 py-3 text-base rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", isLoading, children, className, style, ...props }, ref) => {
    const variantStyle = variantStyles[variant];
    const sizeStyle = sizeStyles[size];

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center gap-2 font-medium
          transition-all duration-150 focus-ring cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
          ${sizeStyle}
          ${className || ""}
        `}
        style={{
          ...Object.fromEntries(
            variantStyle.base.split(";").filter(Boolean).map((s) => {
              const [key, value] = s.split(":").map((x) => x.trim());
              return [key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value];
            })
          ),
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!props.disabled) {
            variantStyle.hover.split(";").filter(Boolean).forEach((s) => {
              const [key, value] = s.split(":").map((x) => x.trim());
              (e.currentTarget.style as unknown as Record<string, string>)[
                key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
              ] = value;
            });
          }
        }}
        onMouseLeave={(e) => {
          variantStyle.base.split(";").filter(Boolean).forEach((s) => {
            const [key, value] = s.split(":").map((x) => x.trim());
            (e.currentTarget.style as unknown as Record<string, string>)[
              key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
            ] = value;
          });
        }}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
