import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'No connection' };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-bold tracking-tight text-ink-900">You are offline</h1>
        <p className="mt-2 text-[14.5px] text-ink-600">
          We could not reach the network. Anything you had already loaded is
          still on screen; new pages will load once you have signal again.
        </p>
        <p className="mt-4 text-[13px] text-ink-500">
          Replies and edits you were part-way through are not lost — they are
          saved as drafts on this device.
        </p>
      </div>
    </div>
  );
}
