import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";
import { popoverSurface } from "@/components/ui/Popover";
import { cn } from "@/lib/utils";

export interface ComboboxProps {
  value?: string;
  /** Receives the committed value (a picked item, or typed text when `allowCustom`). */
  onChange?: (value: string) => void;
  /** Searchable option list (filtered as the user types). */
  items: string[];
  placeholder?: string;
  /** Classes applied to the input. */
  className?: string;
  disabled?: boolean;
  /** Shown when the filter matches nothing. */
  emptyMessage?: string;
  /** Allow committing text that isn't in `items` (free-form ids). Default true. */
  allowCustom?: boolean;
  name?: string;
  id?: string;
}

const inputClass = cn(
  "h-9 w-full rounded-md border bg-background pl-3 pr-9 text-sm outline-none transition-colors",
  "hover:border-primary/60 focus-visible:ring-1 focus-visible:ring-ring",
);

const itemClass = cn(
  "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none",
  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);

/**
 * Searchable single-select on Base UI's `combobox` primitive — a portalled, themed
 * floating panel (same animated {@link popoverSurface} as Tooltip/Popover/Select)
 * that filters as you type and is anchored directly under the input. With
 * `allowCustom` (default) the typed text commits even if it isn't in `items`, so it
 * doubles as an autocomplete for free-form ids (e.g. OpenRouter model names).
 */
export function Combobox({
  value,
  onChange,
  items,
  placeholder,
  className,
  disabled,
  emptyMessage = "No matches",
  allowCustom = true,
  name,
  id,
}: ComboboxProps) {
  return (
    <BaseCombobox.Root
      items={items}
      // Free-form: track the input text as the source of truth so any typed id commits.
      // Strict: control the selected value and let the primitive render its label.
      {...(allowCustom
        ? { inputValue: value ?? "", onInputValueChange: (next: string) => onChange?.(next) }
        : { value: value ?? null })}
      onValueChange={(next) => onChange?.(next == null ? "" : String(next))}
      disabled={disabled}
      name={name}>
      <div className="relative">
        <BaseCombobox.Input
          id={id}
          placeholder={placeholder}
          className={cn(inputClass, className)}
        />
        <BaseCombobox.Trigger
          aria-label="Toggle options"
          className="group absolute right-1 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground">
          <BaseCombobox.Icon className="flex">
            <ChevronDown className="size-4 transition-transform duration-200 group-data-popup-open:rotate-180" />
          </BaseCombobox.Icon>
        </BaseCombobox.Trigger>
      </div>

      <BaseCombobox.Portal>
        <BaseCombobox.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <BaseCombobox.Popup
            className={cn(
              popoverSurface,
              "max-h-[min(var(--available-height),20rem)] w-(--anchor-width) overflow-y-auto p-1",
            )}>
            <BaseCombobox.Empty className="px-2 py-4 text-center text-xs text-muted-foreground">
              {emptyMessage}
            </BaseCombobox.Empty>
            <BaseCombobox.List>
              {(item: string) => (
                <BaseCombobox.Item key={item} value={item} className={itemClass}>
                  <span className="min-w-0 truncate">{item}</span>
                  {item === value && <Check className="absolute right-2 size-4 text-primary" />}
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
