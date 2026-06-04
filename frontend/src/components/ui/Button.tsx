import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Shared look for the themed "chameleon" + legacy color variants. Geometry (height/padding/
// text-size) is intentionally left to the `size` prop so these stay consistent with the
// standard variants and don't blow up into oversized pills on small screens.
const themed = 'border font-semibold uppercase tracking-wider'

const ButtonVariants = cva(
  // whitespace-nowrap keeps labels on one line (whole buttons wrap in flex-wrap toolbars,
  // rather than a single label breaking mid-word). The `keyword` variants opt back into wrapping.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-center rounded-md text-sm font-medium ' +
    'transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-200 ease-out ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed ' +
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out hover:[&_svg]:scale-110 ' +
    'active:translate-y-px cursor-pointer group',
  {
    variants: {
      variant: {
        // --- STANDARD SHADCN VARIANTS ---
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-primary/5 hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',

        // --- NEW: SMART THEME VARIANTS (The "Chameleon" Logic) ---
        // Use these when you want the button to match the user's selected theme (Rose, Gold, etc.)

        button_primary:
          themed + ' ' +
          'bg-primary/10 text-primary border-primary/20 ' +
          'hover:bg-primary/20 hover:border-primary/30 hover:shadow-sm ' +
          'dark:bg-primary/10 dark:text-primary dark:border-primary/20 dark:hover:bg-primary/20',

        hero_login:
          'w-full py-4 rounded-xl flex justify-center items-center mt-4 shadow-md font-bold ' +
          'bg-primary/10 text-primary border border-primary/20 ' +
          'hover:bg-primary/20 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]',

        // --- RESTORED: LEGACY COLOR VARIANTS (Fixed Colors) ---
        // These will ALWAYS be their specific color, regardless of the active theme.

        // Original Login Button
        blue_big_login:
          'w-full py-4 rounded-xl flex justify-center items-center mt-4 shadow-md font-bold ' +
          'bg-blue-600/20 text-blue-700 border border-blue-600/30 hover:bg-blue-600/30 ' +
          'dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-500/20',

        button_blue:
          themed + ' ' +
          'bg-blue-600/15 text-blue-700 border-blue-600/20 hover:bg-blue-600/25 ' +
          'dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-500/20',

        button_red:
          themed + ' ' +
          'bg-red-600/15 text-red-700 border-red-600/20 hover:bg-red-600/25 ' +
          'dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/20',

        button_green:
          themed + ' ' +
          'bg-emerald-600/15 text-emerald-700 border-emerald-600/20 hover:bg-emerald-600/25 ' +
          'dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20',

        button_yellow:
          themed + ' ' +
          'bg-amber-600/15 text-amber-700 border-amber-600/20 hover:bg-amber-600/25 ' +
          'dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 dark:hover:bg-amber-500/20',

        button_neutral:
          themed + ' ' +
          'bg-neutral-900/10 text-neutral-800 border-neutral-900/15 hover:bg-neutral-900/20 ' +
          'dark:bg-white/5 dark:text-foreground/80 dark:border-white/10 dark:hover:bg-white/10',

        button_gray:
          themed + ' ' +
          'bg-slate-600/15 text-slate-700 border-slate-600/20 hover:bg-slate-600/25 ' +
          'dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20 dark:hover:bg-slate-500/20',

        // --- UTILITY VARIANTS ---
        keyword:
          'h-auto w-full justify-between items-center rounded-xl border border-dashed p-3 text-left ' +
          'bg-muted/30 border-border text-foreground hover:bg-muted/50 hover:border-primary/50 ' +
          'whitespace-normal break-all font-mono text-lg font-black tracking-tight',

        keyword_success:
          'h-auto w-full justify-between items-center rounded-xl border border-dashed p-3 text-left ' +
          'bg-emerald-600/15 text-emerald-700 border-emerald-600/30 whitespace-normal break-all ' +
          'dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 ' +
          'font-mono text-lg font-black tracking-tight',

        // Updated Action Logic
        action:
          'bg-transparent text-muted-foreground hover:bg-muted p-2 rounded-lg ' +
          'data-[color=destructive]:hover:text-destructive ' +
          'data-[color=success]:hover:text-emerald-500 ' +
          'data-[color=info]:hover:text-primary ' + // Info maps to Primary (Theme color)
          'data-[color=warning]:hover:text-amber-500 ' +
          'data-[color=blue]:hover:text-blue-500 ' + // Edit actions — distinct from theme primary
          'data-[color=indigo]:hover:text-indigo-500', // View actions — cool, observational

        tab: 'rounded-lg border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-border',

        sidebar:
          'w-full justify-start px-4 py-2.5 text-sm font-medium rounded-lg border border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:border-border data-[state=active]:shadow-sm',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof ButtonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(ButtonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, ButtonVariants };
