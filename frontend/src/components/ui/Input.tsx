import { useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

/**
 * Shared field skin for {@link Input} / {@link PasswordInput} / Textarea — themed
 * border + background, purple hover border, focus ring (matches Button/Select/…).
 */
export const inputBase = cn(
  "w-full rounded-md border bg-background text-sm outline-none transition-colors",
  "hover:border-primary/60 focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional leading icon (rendered inside the field). */
  icon?: ReactNode;
}

/**
 * Canonical themed text input. Renders a bare `<input>` (drop-in anywhere a plain
 * field is expected); when `icon` is set it wraps in a relative container and insets
 * the text for the leading icon.
 */
export function Input({ className, icon, ...props }: InputProps) {
  const input = (
    <input {...props} className={cn(inputBase, "h-9", icon ? "pl-8 pr-3" : "px-3", className)} />
  );
  if (!icon) return input;
  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
      {input}
    </div>
  );
}

/** Password field with a built-in show/hide eye toggle (type flips password↔text). */
export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative w-full">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={cn(inputBase, "h-9 pl-3 pr-10", className)}
      />
      <Tooltip content={show ? "Hide" : "Show"} asChild>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </Tooltip>
    </div>
  );
}
