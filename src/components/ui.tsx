import clsx from 'clsx';
import Link from 'next/link';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:   'bg-brand-700 text-white hover:bg-brand-800',
  secondary: 'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50',
  ghost:     'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  danger:    'bg-white text-bad-700 border border-bad-500/40 hover:bg-bad-50',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
};

export function Button({
  variant = 'primary', size = 'md', className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={clsx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  );
}

export function LinkButton({
  variant = 'primary', size = 'md', className, href, children,
}: {
  variant?: ButtonVariant; size?: ButtonSize; className?: string;
  href: string; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------- Field */

export function Field({
  label, name, error, hint, children, required,
}: {
  label: string; name: string; error?: string; hint?: string;
  children: React.ReactNode; required?: boolean;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-[13px] font-medium text-ink-800">
        {label}
        {required && <span className="text-brand-700" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={hintId} className="text-[12.5px] text-ink-500">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="text-[12.5px] text-bad-700">{error}</p>
      )}
    </div>
  );
}

export function Input({
  className, invalid, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={clsx(
        'w-full h-10 rounded-md border bg-white px-3 text-sm text-ink-900',
        'placeholder:text-ink-400',
        invalid ? 'border-bad-500' : 'border-ink-200',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({
  className, invalid, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={clsx(
        'w-full rounded-md border bg-white px-3 py-2 text-sm text-ink-900',
        'placeholder:text-ink-400 resize-y min-h-24',
        invalid ? 'border-bad-500' : 'border-ink-200',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

/* -------------------------------------------------------------- Feedback UI */

export function Alert({
  tone = 'bad', title, children,
}: { tone?: 'bad' | 'warn' | 'good' | 'info'; title?: string; children: React.ReactNode }) {
  const tones = {
    bad:  'bg-bad-50 border-bad-500/30 text-bad-700',
    warn: 'bg-warn-50 border-warn-500/30 text-warn-700',
    good: 'bg-good-50 border-good-500/30 text-good-700',
    info: 'bg-ink-100 border-ink-200 text-ink-700',
  };
  return (
    <div role="alert" className={clsx('rounded-md border px-3.5 py-3 text-[13.5px]', tones[tone])}>
      {title && <p className="font-semibold mb-0.5">{title}</p>}
      {children}
    </div>
  );
}

/** Status is carried by shape and text, never by color alone. */
export function Badge({
  tone = 'neutral', children,
}: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'brand'; children: React.ReactNode }) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700 border-ink-200',
    good:    'bg-good-50 text-good-700 border-good-500/30',
    warn:    'bg-warn-50 text-warn-700 border-warn-500/30',
    bad:     'bg-bad-50 text-bad-700 border-bad-500/30',
    brand:   'bg-brand-50 text-brand-700 border-brand-200',
  };
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium',
      tones[tone],
    )}>
      {children}
    </span>
  );
}

export function Card({
  title, description, action, children, className,
}: {
  title?: string; description?: string; action?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section className={clsx('rounded-lg border border-ink-200 bg-white', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function EmptyState({
  title, description, action,
}: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="py-12 text-center">
      <p className="text-[15px] font-semibold text-ink-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-ink-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Rating never relies on color alone — the numeral is always present. */
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" className="shrink-0">
            <path
              d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"
              fill={i <= Math.round(rating) ? 'var(--color-brand-600)' : 'var(--color-ink-200)'}
            />
          </svg>
        ))}
      </span>
      <span className="tnum text-[13px] font-semibold text-ink-800">{rating.toFixed(1)}</span>
    </span>
  );
}
