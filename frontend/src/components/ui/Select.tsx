import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { popoverSurface } from "@/components/ui/Popover";
import { cn } from "@/lib/utils";

export interface SelectProps {
  value?: string;
  /** Convenience: receives the selected value directly (not the event). */
  onChange?: (value: string) => void;
  /** `<option value=…>label</option>` elements — kept for a drop-in native-select API. */
  children: ReactNode;
  /** Classes applied to the trigger button. */
  className?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  /** Shown when the current value matches no option. */
  placeholder?: ReactNode;
}

type OptionEl = ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;

const triggerClass = cn(
  "group inline-flex h-9 min-w-0 items-center justify-between gap-2 rounded-md border bg-background pl-3 pr-2 text-sm",
  "cursor-pointer select-none outline-none transition-colors",
  "hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:border-primary/60",
  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
);

const itemClass = cn(
  "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none",
  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);

/**
 * Modern dropdown on Base UI's `select` primitive — a portalled, themed floating
 * panel (same animated {@link popoverSurface} as Tooltip/Popover) with full listbox
 * a11y, keyboard nav and typeahead. Drop-in for the old native `<select>` wrapper:
 * pass `value`, `onChange`, and `<option>` children.
 */
export function Select({
  value,
  onChange,
  children,
  className,
  disabled,
  name,
  id,
  placeholder,
}: SelectProps) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const el = child as OptionEl;
      return {
        value: String(el.props.value ?? ""),
        label: el.props.children,
        disabled: el.props.disabled,
      };
    });
  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? placeholder ?? null;

  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(next) => onChange?.(next == null ? "" : String(next))}
      disabled={disabled}
      name={name}
      id={id}>
      <BaseSelect.Trigger className={cn(triggerClass, className)}>
        <BaseSelect.Value className="min-w-0 truncate text-left">
          {(v: string) => labelFor(v)}
        </BaseSelect.Value>
        <BaseSelect.Icon className="shrink-0">
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-data-popup-open:rotate-180" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>

      <BaseSelect.Portal>
        <BaseSelect.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          alignItemWithTrigger={false}
          className="z-50">
          <BaseSelect.Popup
            className={cn(
              popoverSurface,
              "max-h-[min(var(--available-height),20rem)] min-w-(--anchor-width) overflow-y-auto p-1",
            )}>
            {options.map((o) => (
              <BaseSelect.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                label={typeof o.label === "string" ? o.label : undefined}
                className={itemClass}>
                <BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator className="absolute right-2 inline-flex">
                  <Check className="size-4" />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
