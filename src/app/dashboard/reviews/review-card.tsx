'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  replyToReviewAction, reportReviewAction, saveReplyDraftAction,
} from '@/lib/reviews/actions';
import { REPORT_REASONS, MAX_REPLY_LENGTH, type ReplyState } from '@/lib/reviews/constants';
import { Button, Textarea, Badge, Alert, Stars } from '@/components/ui';

interface ReviewView {
  id: string;
  authorName: string;
  authorCity: string | null;
  authorReviewCount: number;
  rating: number;
  body: string;
  createdAt: string;
  helpfulCount: number;
  visibility: string;
}

interface ReplyView { body: string; createdAt: string; editedAt: string | null }

function SubmitReply({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Publishing…' : editing ? 'Update reply' : 'Publish reply'}
    </Button>
  );
}

export function ReviewCard({
  review, reply, draft, canReply, canReport,
}: {
  review: ReviewView;
  reply: ReplyView | null;
  draft: string;
  canReply: boolean;
  canReport: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [body, setBody] = useState(reply?.body ?? draft);
  const [replyState, replyFormAction] = useActionState<ReplyState, FormData>(replyToReviewAction, {});
  const [reportState, reportFormAction] = useActionState<ReplyState, FormData>(reportReviewAction, {});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (replyState.ok) { setComposing(false); }
  }, [replyState.ok]);

  useEffect(() => {
    if (reportState.ok) { setReporting(false); }
  }, [reportState.ok]);

  // Debounced draft autosave.
  useEffect(() => {
    if (!composing || reply) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveReplyDraftAction(review.id, body);
    }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [body, composing, reply, review.id]);

  const date = new Date(review.createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <article className="rounded-lg border border-ink-200 bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-200 text-[13px] font-semibold text-ink-700"
          >
            {review.authorName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink-900">{review.authorName}</p>
            <p className="text-[12.5px] text-ink-500">
              {review.authorCity && <>{review.authorCity} · </>}
              {review.authorReviewCount} review{review.authorReviewCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Stars rating={review.rating} />
          <time dateTime={review.createdAt} className="text-[12.5px] text-ink-500">{date}</time>
        </div>
      </header>

      <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-800">
        {review.body}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {review.helpfulCount > 0 && (
          <span className="text-[12.5px] text-ink-500">
            {review.helpfulCount} found this helpful
          </span>
        )}
        {review.visibility === 'not_recommended' && (
          <Badge tone="neutral">Not currently recommended</Badge>
        )}
        {reply && <Badge tone="good">✓ You replied</Badge>}
      </div>

      {reply && !composing && (
        <div className="mt-4 rounded-md border-l-2 border-brand-600 bg-brand-50/50 p-3.5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-700">
            Your reply
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] text-ink-800">{reply.body}</p>
          <p className="mt-2 text-[12px] text-ink-500">
            {new Date(reply.createdAt).toLocaleDateString()}
            {reply.editedAt && ' · edited'}
          </p>
        </div>
      )}

      {replyState.error && <div className="mt-3"><Alert tone="bad">{replyState.error}</Alert></div>}
      {reportState.ok && (
        <div className="mt-3">
          <Alert tone="good" title="Report received">
            We&apos;ll review it against our content guidelines and email you the
            decision, usually within 3 business days.
          </Alert>
        </div>
      )}

      {composing ? (
        <form action={replyFormAction} className="mt-4 space-y-2">
          <input type="hidden" name="reviewId" value={review.id} />
          <label htmlFor={`reply-${review.id}`} className="sr-only">Your public reply</label>
          <Textarea
            id={`reply-${review.id}`}
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_REPLY_LENGTH}
            placeholder="Thank the customer, address the specifics, and say what you'll do next. This is public."
            autoFocus
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="tnum text-[12px] text-ink-500">
              {body.length}/{MAX_REPLY_LENGTH}
              {!reply && draft && body === draft && ' · draft restored'}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setComposing(false)}>
                Cancel
              </Button>
              <SubmitReply editing={!!reply} />
            </div>
          </div>
          <p className="text-[12px] text-ink-400">
            Your reply is public and appears under this review with your business name.
          </p>
        </form>
      ) : reporting ? (
        <form action={reportFormAction} className="mt-4 space-y-3 rounded-md border border-ink-200 p-3.5">
          <input type="hidden" name="reviewId" value={review.id} />
          <p className="text-[13px] font-semibold text-ink-900">Why are you reporting this review?</p>
          {reportState.error && <Alert tone="bad">{reportState.error}</Alert>}
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="flex gap-2.5 text-[13px]">
                <input type="radio" name="reason" value={r.value} required
                       className="mt-1 h-3.5 w-3.5 shrink-0 accent-brand-700" />
                <span>
                  <span className="font-medium text-ink-800">{r.label}</span>
                  <span className="block text-[12.5px] text-ink-500">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <Textarea name="detail" placeholder="Add any detail that helps us assess this. Optional."
                    className="min-h-20 text-[13px]" maxLength={2000} />
          <Alert tone="info">
            Reporting a review does not remove it. A moderator decides based on our
            content guidelines, and your advertising status has no bearing on the outcome.
          </Alert>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setReporting(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="secondary">Submit report</Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {canReply && (
            <Button size="sm" variant={reply ? 'secondary' : 'primary'}
                    onClick={() => { setBody(reply?.body ?? draft); setComposing(true); }}>
              {reply ? 'Edit reply' : draft ? 'Continue draft' : 'Reply publicly'}
            </Button>
          )}
          {canReply && (
            <Button size="sm" variant="secondary" disabled title="Direct messaging arrives with the Inbox">
              Message privately
            </Button>
          )}
          {canReport && (
            <Button size="sm" variant="ghost" onClick={() => setReporting(true)}>
              Report
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
