'use client';

import { useState, useActionState, useEffect, useRef, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import clsx from 'clsx';
import {
  sendMessageAction, setConversationStatusAction, markReadAction,
  type InboxState,
} from '@/lib/inbox/actions';
import { Button, Textarea, Alert, Badge } from '@/components/ui';

interface MessageView {
  id: string;
  senderType: string;
  senderName: string | null;
  body: string | null;
  isAutomated: boolean;
  createdAt: string;
}

interface TemplateView { id: string; name: string; body: string }

function Send() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Sending…' : 'Send'}
    </Button>
  );
}

/** Templates support {{customer_name}} and {{business_name}}. */
function fill(body: string, customerName: string, businessName: string): string {
  return body
    .replace(/\{\{\s*customer_name\s*\}\}/g, customerName.split(' ')[0])
    .replace(/\{\{\s*business_name\s*\}\}/g, businessName);
}

export function Thread({
  conversationId, status, canWrite, messages, templates, customerName, businessName,
}: {
  conversationId: string;
  status: string;
  canWrite: boolean;
  messages: MessageView[];
  templates: TemplateView[];
  customerName: string;
  businessName: string;
}) {
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [state, action] = useActionState<InboxState, FormData>(sendMessageAction, {});
  const [pendingStatus, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.ok) { setBody(''); setTemplateId(''); }
  }, [state.ok]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  // Marking read revalidates, which is illegal during a server render — so it
  // happens here, once, after the thread is on screen.
  useEffect(() => {
    void markReadAction(conversationId);
  }, [conversationId]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-ink-200 bg-white">
        <ul className="max-h-[440px] space-y-3 overflow-y-auto p-4">
          {messages.map((m) => {
            const mine = m.senderType === 'business';
            const system = m.senderType === 'system';
            if (system) {
              return (
                <li key={m.id} className="text-center">
                  <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[12px] text-ink-500">
                    {m.body}
                  </span>
                </li>
              );
            }
            return (
              <li key={m.id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={clsx('max-w-[85%] rounded-lg px-3.5 py-2.5', mine ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-900')}>
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.body}</p>
                  <p className={clsx('mt-1 text-[11.5px]', mine ? 'text-brand-100' : 'text-ink-500')}>
                    {m.senderName}
                    {m.isAutomated && ' · automated'}
                    {' · '}
                    {new Date(m.createdAt).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
              </li>
            );
          })}
          <div ref={endRef} />
        </ul>

        {canWrite ? (
          <form action={action} className="space-y-2 border-t border-ink-100 p-4">
            <input type="hidden" name="conversationId" value={conversationId} />
            <input type="hidden" name="templateId" value={templateId} />
            {state.error && <Alert tone="bad">{state.error}</Alert>}

            <label htmlFor="reply-body" className="sr-only">Your reply</label>
            <Textarea
              id="reply-body"
              name="body"
              value={body}
              onChange={(e) => { setBody(e.target.value); setTemplateId(''); }}
              placeholder="Answer their question and say what happens next."
              className="min-h-20"
            />

            {showTemplates && (
              <ul className="space-y-1.5 rounded-md border border-ink-200 p-2">
                {templates.length === 0 && (
                  <li className="px-1 py-1 text-[12.5px] text-ink-500">No templates yet.</li>
                )}
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setBody(fill(t.body, customerName, businessName));
                        setTemplateId(t.id);
                        setShowTemplates(false);
                      }}
                      className="w-full rounded px-2 py-1.5 text-left hover:bg-ink-50"
                    >
                      <span className="block text-[13px] font-medium text-ink-900">{t.name}</span>
                      <span className="mt-0.5 block line-clamp-1 text-[12px] text-ink-500">{t.body}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button" size="sm" variant="ghost"
                onClick={() => setShowTemplates((v) => !v)}
                aria-expanded={showTemplates}
              >
                {showTemplates ? 'Hide templates' : `Templates (${templates.length})`}
              </Button>
              <Send />
            </div>
          </form>
        ) : (
          <div className="border-t border-ink-100 p-4">
            <Alert tone="info">Your role can read this conversation but not reply.</Alert>
          </div>
        )}
      </div>

      {canWrite && (
        <div className="rounded-lg border border-ink-200 bg-white px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-medium text-ink-900">Did this turn into a job?</p>
              <p className="text-[12.5px] text-ink-500">
                Marking won or lost is what makes your cost-per-lead reporting accurate.
              </p>
            </div>
            <div className="flex gap-2">
              {(['won', 'lost', 'closed'] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={status === s ? 'primary' : 'secondary'}
                  disabled={pendingStatus}
                  onClick={() => startTransition(() => {
                    void setConversationStatusAction(conversationId, s);
                  })}
                >
                  {s === 'won' ? 'Won' : s === 'lost' ? 'Lost' : 'Close'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
