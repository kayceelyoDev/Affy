import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

// --- BUTTON ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium rounded-control transition-standard disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer';
    
    const variants = {
      primary: 'bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200',
      secondary: 'hairline-border bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/5',
      ghost: 'bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/5',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 h-8 gap-1.5',
      md: 'text-sm px-3.5 py-2 h-9 gap-2',
      lg: 'text-base px-5 py-2.5 h-11 gap-2.5',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

// --- CARD ---
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn('rounded-card hairline-border bg-white dark:bg-[#0A0A0A] p-5 shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  );
};

// --- INPUT ---
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full h-9 px-3 text-sm rounded-control hairline-border bg-transparent placeholder:text-neutral-500 focus:outline-none transition-standard',
          className
        )}
        {...props}
      />
    );
  }
);

// --- STATUS DOT ---
export interface StatusDotProps {
  status: 'active' | 'warning' | 'error' | 'idle';
  grayscale?: boolean;
  label?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, grayscale = false, label }) => {
  const colors = {
    active: grayscale ? 'bg-neutral-400' : 'bg-emerald-500',
    warning: grayscale ? 'bg-neutral-400' : 'bg-amber-500',
    error: grayscale ? 'bg-neutral-400' : 'bg-rose-500',
    idle: 'bg-neutral-400',
  };

  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('w-1.5 h-1.5 rounded-full inline-block', colors[status])} />
      {label && <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</span>}
    </span>
  );
};

// --- BADGE ---
export const Badge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium hairline-border bg-black/5 dark:bg-white/5', className)}>
      {children}
    </span>
  );
};
