import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-tap-coarse',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-900',
        accent: 'bg-accent-600 text-white hover:bg-accent-900',
        danger: 'bg-danger-600 text-white hover:bg-danger-900',
        outline: 'border border-border bg-surface text-text hover:bg-primary-50',
        ghost: 'text-text hover:bg-primary-50',
        link: 'text-primary-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-2 min-h-tap',
        sm: 'h-9 px-3 text-sm',
        lg: 'h-14 px-8 text-base',
        icon: 'h-11 w-11 min-h-tap',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
