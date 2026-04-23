import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useExpense, useProcessExpenseApproval } from '../hooks/useExpenses';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATEGORY_LABELS as LABELS } from '../lib/supabase';
import type { ExpenseCategory } from '../lib/supabase';

function fmtDate(raw: string | null): string {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return '—'; }
}

function fmtMoney(amount: number | null, currency = 'GBP'): string {
  if (amount == null) return '—';
  const sym = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' ';
  return `${sym}${Number(amount).toFixed(2)}`;
}

export default function ExpenseApprovalView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const defaultAction = searchParams.get('action') as 'reject' | 'forward' | null;

  const { data: expense, isLoading, error } = useExpense(id!);
  const processApproval = useProcessExpenseApproval();

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [approvers, setApprovers] = useState<{ id: string; display_name: string; email: string }[]>([]);
  const [approverEmail, setApproverEmail] = useState('');

  // Panel state
  const [panel, setPanel] = useState<'idle' | 'reject' | 'forward'>(defaultAction ?? 'idle');
  const [rejectReason, setRejectReason] = useState('');
  const [forwardTo, setForwardTo] = useState('');
  const [forwardReason, setForwardReason] = useState('');
  const [comments, setComments] = useState('');
  const [done, setDone] = useState<'approved' | 'rejected' | 'forwarded' | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setApproverEmail(data.user.email);
    });
    supabase.from('approvers').select('id, display_name, email').eq('is_active', true).order('display_name')
      .then(({ data }) => { if (data) setApprovers(data); });
  }, []);

  useEffect(() => {
    if (!expense) return;
    const fileRec = (expense as { expense_files?: { storage_path: string; bucket_name: string } }).expense_files;
    if (fileRec?.storage_path) {
      supabase.storage.from(fileRec.bucket_name).createSignedUrl(fileRec.storage_path, 3600)
        .then(({ data }) => { if (data) setReceiptUrl(data.signedUrl); });
    }
  }, [expense]);

  if (isLoading) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-faint)' }}>
      <div style={{ width: 28, height: 28, border: '2px solid var(--line)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
      Loading expense…
    </div>
  );

  if (error || !expense) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>Expense not found.</div>
  );

  if (done) return (
    <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center', padding: '0 20px' }} className="animate-rise">
      <div style={{ fontSize: 56, marginBottom: 20 }}>
        {done === 'approved' ? '✅' : done === 'rejected' ? '❌' : '↪️'}
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 12 }}>
        {done === 'approved' ? 'Expense Approved' : done === 'rejected' ? 'Expense Rejected' : 'Expense Forwarded'}
      </h2>
      <p style={{ color: 'var(--ink-faint)', fontSize: 14 }}>
        {done === 'approved' && 'Your approval has been recorded. Finance has been notified.'}
        {done === 'rejected' && 'The rejection has been recorded. Finance will be notified and can correct the expense.'}
        {done === 'forwarded' && 'The expense has been forwarded to the new approver. They will receive an email.'}
      </p>
      <div style={{ marginTop: 28, padding: '16px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', borderRadius: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 4 }}>{expense.employee_name ?? expense.employee_email}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
          {fmtMoney(expense.amount, expense.currency)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>{expense.merchant_name ?? 'Receipt'}</div>
      </div>
    </div>
  );

  if (expense.status !== 'pending_approval') return (
    <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>ℹ️</div>
      <h2 style={{ fontFamily: 'var(--font-display)' }}>Already Processed</h2>
      <p style={{ color: 'var(--ink-faint)' }}>
        This expense has already been <strong style={{ color: 'var(--ink)' }}>{expense.status.replace(/_/g, ' ')}</strong>.
      </p>
    </div>
  );

  const doAction = async (action: 'approve' | 'reject' | 'forward') => {
    setActionError('');
    if (action === 'reject' && !rejectReason.trim()) { setActionError('Please provide a reason for rejection.'); return; }
    if (action === 'forward' && (!forwardTo || !forwardReason.trim())) { setActionError('Please select an approver and provide a reason.'); return; }
    try {
      await processApproval.mutateAsync({
        expense_id: expense.id,
        action,
        comments: comments || undefined,
        reject_reason: action === 'reject' ? rejectReason : undefined,
        forward_to_approver_id: action === 'forward' ? forwardTo : undefined,
        forward_reason: action === 'forward' ? forwardReason : undefined,
        approver_email: approverEmail || undefined,
      });
      setDone(action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'forwarded');
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const ocr = (expense as { ocr?: Array<{ extracted_fields: Record<string, unknown> }> }).ocr?.[0];

  return (
    <div>
      <header style={{ marginBottom: 24 }} className="animate-rise">
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.22em', fontFamily: 'var(--font-display)', marginBottom: 8 }}>
          Expense Approval
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontFamily: 'var(--font-display)' }}>
          Review &amp; Decide
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--ink-faint)', fontSize: 13 }}>
          This expense is awaiting your approval. Review the receipt and details below.
        </p>
      </header>

      <div className="split-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24, alignItems: 'start' }}>

        {/* Receipt image */}
        <div>
          <div className="card animate-rise delay-1" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Receipt
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {receiptUrl ? (
                <img src={receiptUrl} alt="Receipt" style={{ maxWidth: '100%', maxHeight: 700, objectFit: 'contain', display: 'block' }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 40 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
                  <div>No receipt image available</div>
                </div>
              )}
            </div>
          </div>

          {ocr && (
            <div className="card animate-rise delay-2" style={{ marginTop: 16, padding: '16px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
                AI-Extracted Data
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {Object.entries(ocr.extracted_fields).filter(([, v]) => v != null).map(([key, val]) => (
                  <div key={key} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{key.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: 12, color: 'var(--accent-text)', fontFamily: 'var(--font-mono)' }}>{String(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Details + Actions */}
        <div>
          {/* Summary card */}
          <div className="card animate-rise delay-1" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 8 }}>{LABELS[expense.category as ExpenseCategory] ?? expense.category}</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                {fmtMoney(expense.amount, expense.currency)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 6 }}>{expense.merchant_name ?? 'Unknown merchant'}</div>
            </div>

            {[
              { label: 'Employee', value: expense.employee_name ?? expense.employee_email },
              { label: 'Email', value: expense.employee_email },
              { label: 'Receipt Date', value: fmtDate(expense.receipt_date) },
              { label: 'GL Code', value: expense.gl_code ?? '—' },
              { label: 'Cost Centre', value: expense.cost_centre ?? '—' },
              { label: 'Department', value: expense.department ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-faint)' }}>{label}</span>
                <span style={{ color: 'var(--ink-soft)', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
              </div>
            ))}

            {expense.description && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-muted)', fontStyle: 'italic' }}>"{expense.description}"</div>
            )}

            {expense.finance_notes && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,198,224,0.08)', border: '1px solid rgba(0,198,224,0.2)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Finance Notes</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{expense.finance_notes}</div>
              </div>
            )}
          </div>

          {/* Approver comments */}
          <div className="card animate-rise delay-2" style={{ padding: 20, marginBottom: 16 }}>
            <label>Optional Comments</label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={2}
              style={{ width: '100%', marginTop: 8, resize: 'vertical' }}
              placeholder="Add comments (optional)…"
            />
          </div>

          {/* Action buttons */}
          {panel === 'idle' && (
            <div className="animate-rise delay-3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-accent"
                style={{ width: '100%', padding: '14px', fontSize: 15 }}
                disabled={processApproval.isPending}
                onClick={() => doAction('approve')}
              >
                {processApproval.isPending ? 'Processing…' : '✓ Approve Expense'}
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button className="btn btn-ghost" style={{ borderColor: 'rgba(244,63,94,0.3)', color: 'var(--danger)' }} onClick={() => setPanel('reject')}>
                  ✗ Reject
                </button>
                <button className="btn btn-ghost" onClick={() => setPanel('forward')}>
                  → Forward
                </button>
              </div>
            </div>
          )}

          {/* Reject panel */}
          {panel === 'reject' && (
            <div className="card animate-rise" style={{ padding: 20, border: '1px solid rgba(244,63,94,0.3)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 14 }}>Reject Expense</div>
              <label>Reason for rejection *</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                style={{ width: '100%', marginTop: 8, borderColor: 'rgba(244,63,94,0.4)', resize: 'vertical' }}
                placeholder="Please explain why this expense cannot be approved…"
              />
              {actionError && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--danger)' }}>{actionError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setPanel('idle'); setActionError(''); }}>Cancel</button>
                <button
                  style={{ flex: 1, padding: '10px', background: 'var(--danger-soft)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 8, color: 'var(--danger)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                  disabled={processApproval.isPending}
                  onClick={() => doAction('reject')}
                >
                  {processApproval.isPending ? 'Rejecting…' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          )}

          {/* Forward panel */}
          {panel === 'forward' && (
            <div className="card animate-rise" style={{ padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 14 }}>Forward to Another Approver</div>
              <label>Forward to *</label>
              <select
                value={forwardTo}
                onChange={e => setForwardTo(e.target.value)}
                style={{ width: '100%', marginTop: 8, marginBottom: 14 }}
              >
                <option value="">— Select approver —</option>
                {approvers
                  .filter(a => a.id !== expense.assigned_approver_id)
                  .map(a => (
                    <option key={a.id} value={a.id}>{a.display_name} ({a.email})</option>
                  ))}
              </select>
              <label>Reason for forwarding *</label>
              <textarea
                value={forwardReason}
                onChange={e => setForwardReason(e.target.value)}
                rows={2}
                style={{ width: '100%', marginTop: 8, resize: 'vertical' }}
                placeholder="Why are you forwarding this expense?"
              />
              {actionError && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--danger)' }}>{actionError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setPanel('idle'); setActionError(''); }}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={processApproval.isPending} onClick={() => doAction('forward')}>
                  {processApproval.isPending ? 'Forwarding…' : 'Forward →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
