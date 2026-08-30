import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1fr_460px]">
      {/* Value panel — hidden on small screens where it would just push the form down. */}
      <aside className="hidden lg:flex flex-col justify-between bg-ink-900 px-12 py-10 text-white">
        <Link href="/" className="text-[17px] font-bold tracking-tight">
          <span className="text-brand-400">◆</span> Business
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            Your customers are already talking. Join the conversation.
          </h2>
          <ul className="mt-8 space-y-4 text-[14.5px] text-ink-300">
            {[
              ['Reply to every review', 'Publicly or by direct message, from any device.'],
              ['Answer leads in minutes', 'Quote requests, messages, and appointment asks in one inbox.'],
              ['Keep your details right', 'Hours, photos, menu, and services — the things customers check first.'],
              ['See what is working', 'Page views, calls, directions, and where the leads came from.'],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span>
                  <strong className="font-semibold text-white">{title}.</strong> {body}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12.5px] text-ink-500">
          Reviews are written by customers and are not edited or removed by businesses.
        </p>
      </aside>

      <main className="flex min-h-screen flex-col justify-center bg-white px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 inline-block text-[17px] font-bold tracking-tight lg:hidden">
            <span className="text-brand-700">◆</span> Business
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
