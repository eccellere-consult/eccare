'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from '@/components/ui/input';

/** A password/PIN field with a show/hide toggle — wraps the generic `Input`
 *  rather than replacing it, so every existing prop (id, autoComplete,
 *  placeholder, value, onChange...) still works unchanged. Defaults to
 *  `type="password"`; pass a different `type` only if you have a reason to. */
const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'password', ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          type={visible ? 'text' : type}
          className={cn('pr-11', className)}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-secondary hover:text-text"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
