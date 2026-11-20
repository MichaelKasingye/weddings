'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { GuestRow } from '@/lib/guests';
import Icon from './Icon';
import { when } from '@/lib/format';
import { clearSentAction, deleteGuestsAction, markWhatsappSentAction, sendSmsAction } from '@/app/(admin)/dashboard/actions';

export type Filter = 'all' | 'unsent' | 'sent' | 'opened' | 'unopened';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unsent', label: 'Not sent' },
  { key: 'sent', label: 'Sent' },
  { key: 'opened', label: 'Opened' },
  { key: 'unopened', label: 'Sent, not opened' },
];

const isSent = (g: GuestRow) => !!g.whatsapp || g.sms?.status === 'sent' || g.sms?.status === 'delivered';
const matches = (g: GuestRow, f: Filter) =>
  f === 'all' ? true : f === 'unsent' ? !isSent(g) : f === 'sent' ? isSent(g) : f === 'opened' ? !!g.opens : isSent(g) && !g.opens;

const waUrl = (g: GuestRow) => `https://wa.me/${g.phone.replace(/\D/g, '')}?text=${encodeURIComponent(g.whatsappText)}`;

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.8h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.72.97.99-3.62-.23-.37a9.78 9.78 0 0 1-1.5-5.22c0-5.41 4.41-9.82 9.83-9.82 2.62 0 5.09 1.02 6.94 2.88a9.75 9.75 0 0 1 2.87 6.95c0 5.41-4.41 9.81-9.81 9.81zm8.36-18.17A11.76 11.76 0 0 0 12.04.17C5.5.17.18 5.49.18 12.03c0 2.09.55 4.13 1.59 5.93L.08 24.1l6.29-1.65a11.85 11.85 0 0 0 5.67 1.44h.01c6.53 0 11.86-5.32 11.86-11.86 0-3.17-1.23-6.15-3.47-8.39z" />
    </svg>
  );
}

export default function GuestTable({
  initialRows,
  isSuper,
  smsReady,
  me,
  initialFilter,
}: {
  initialRows: GuestRow[];
  isSuper: boolean;
  smsReady: boolean;
  me: string;
  initialFilter: Filter;
}) {
  const [rows, setRows] = useState(initialRows);
  useEffect(() => setRows(initialRows), [initialRows]);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [queue, setQueue] = useState<{ ids: string[]; i: number } | null>(null);
  const [smsBusy, setSmsBusy] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // keep the address bar in step with the filter, so a refresh keeps it
  useEffect(() => {
    const u = new URL(window.location.href);
    if (filter === 'all') u.searchParams.delete('filter'); else u.searchParams.set('filter', filter);
    window.history.replaceState(null, '', u);
  }, [filter]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((g) => matches(g, f.key)).length])) as Record<Filter, number>, [rows]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return rows.filter((g) => matches(g, filter) && (!q || g.name.toLowerCase().includes(q) || (qDigits.length >= 3 && g.phone.includes(qDigits))));
  }, [rows, filter, query]);
  const byId = useMemo(() => new Map(rows.map((g) => [g.id, g])), [rows]);

  const allVisibleSelected = visible.length > 0 && visible.every((g) => selected.has(g.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) visible.forEach((g) => next.delete(g.id));
    else visible.forEach((g) => next.add(g.id));
    setSelected(next);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const selectedRows = rows.filter((g) => selected.has(g.id));
  const patch = (id: string, p: Partial<GuestRow>) => setRows((rs) => rs.map((g) => (g.id === id ? { ...g, ...p } : g)));

  /* ---------- actions ---------- */
  async function copy(text: string, what = 'Link copied') {
    try { await navigator.clipboard.writeText(text); setToast(what); }
    catch { window.prompt('Copy this:', text); }
  }

  async function openWhatsApp(g: GuestRow) {
    window.open(waUrl(g), '_blank', 'noopener');
    patch(g.id, { whatsapp: { at: new Date().toISOString(), byName: me } });
    const r = await markWhatsappSentAction(g.id);
    if (!r.ok) setToast(r.error);
  }

  async function undo(g: GuestRow, channel: 'whatsapp' | 'sms') {
    if (!confirm(`Mark ${channel === 'sms' ? 'the SMS' : 'WhatsApp'} for ${g.name} as not sent?`)) return;
    patch(g.id, { [channel]: null } as Partial<GuestRow>);
    const r = await clearSentAction(g.id, channel);
    if (!r.ok) setToast(r.error);
  }

  async function sendSms(list: GuestRow[]) {
    if (!list.length) return;
    const cost = list.length === 1 ? `Send the SMS invitation to ${list[0].name} (${list[0].phoneDisplay})?` : `Send the SMS invitation to ${list.length} guests?`;
    const resend = list.filter((g) => g.sms?.status === 'sent' || g.sms?.status === 'delivered').length;
    if (!confirm(cost + (resend ? `\n\n${resend} of them already received an SMS and will get another one.` : '') + '\n\nEach SMS is charged by the SMS provider.')) return;
    setSmsBusy({ done: 0, total: list.length });
    let ok = 0, failed = 0, lastError = '';
    for (let i = 0; i < list.length; i += 20) {
      const batch = list.slice(i, i + 20);
      const r = await sendSmsAction(batch.map((g) => g.id));
      if (!r.ok) { lastError = r.error; failed += batch.length; break; }
      for (const res of r.results) {
        patch(res.id, { sms: { at: new Date().toISOString(), byName: me, status: res.ok ? 'sent' : 'failed', error: res.error ?? null } });
        if (res.ok) ok++; else { failed++; lastError = res.error || lastError; }
      }
      setSmsBusy({ done: Math.min(i + 20, list.length), total: list.length });
    }
    setSmsBusy(null);
    setToast(failed ? `${ok} SMS sent, ${failed} failed${lastError ? ': ' + lastError : ''}` : `${ok} SMS sent`);
  }

  async function deleteSelected() {
    const list = selectedRows;
    if (!list.length) return;
    if (!confirm(`Delete ${list.length} guest(s)? Their invitation links will stop working.`)) return;
    const r = await deleteGuestsAction(list.map((g) => g.id));
    if (!r.ok) { setToast(r.error); return; }
    setRows((rs) => rs.filter((g) => !selected.has(g.id)));
    setSelected(new Set());
    setToast(`${r.deleted} guest(s) deleted`);
  }

  function downloadCsv() {
    const list = selectedRows.length ? selectedRows : visible;
    const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [['Name', 'Phone', 'Seats', 'Link', 'WhatsApp sent', 'SMS', 'Opened'].map(esc).join(',')]
      .concat(list.map((g) => [g.name, g.phoneDisplay, g.seats, g.url, g.whatsapp ? when(g.whatsapp.at) : '', g.sms ? g.sms.status : '', g.opens ? `${g.opens.count}x` : ''].map(esc).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'guest-links.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- WhatsApp one-by-one sender ---------- */
  const current = queue ? byId.get(queue.ids[queue.i]) : undefined;
  const nextInQueue = () => setQueue((q) => (q ? { ...q, i: q.i + 1 } : q));

  return (
    <div className="space-y-4">
      {/* search + filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative md:w-72">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 subtle pointer-events-none" />
          <input className="input pl-9" type="search" placeholder="Search name or phone…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search guests" />
        </div>
        <div className="tabs" role="tablist" aria-label="Filter guests">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)} className="tab">
              {f.label} <span className="count">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* the list */}
      <div className="panel">
        {/* toolbar (stays in view while scrolling the list) */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b sticky top-14 lg:top-0 z-10 rounded-t-lg" style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
          <label className="flex items-center gap-2.5 text-[13px] font-medium mr-2 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4" checked={allVisibleSelected} onChange={toggleAll} disabled={!visible.length} />
            {selected.size ? `${selected.size} selected` : <span className="muted">Select all</span>}
          </label>
          <button className="btn btn-sm btn-wa" disabled={!selected.size} onClick={() => setQueue({ ids: selectedRows.map((g) => g.id), i: 0 })}>
            <WhatsAppIcon /> Send on WhatsApp
          </button>
          {smsReady && (
            <button className="btn btn-sm" disabled={!selected.size || !!smsBusy} onClick={() => sendSms(selectedRows)}>
              <Icon name="message" /> {smsBusy ? `Sending ${smsBusy.done}/${smsBusy.total}…` : 'Send SMS'}
            </button>
          )}
          <button className="btn btn-sm" onClick={downloadCsv} disabled={!visible.length}><Icon name="download" /> CSV</button>
          {isSuper && <button className="btn btn-sm btn-danger" disabled={!selected.size} onClick={deleteSelected}><Icon name="trash" /> Delete</button>}
          {selected.size > 0 && <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>}
        </div>

        {visible.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium">{rows.length ? 'No guests match.' : 'No guests yet'}</p>
            {!rows.length && isSuper && (
              <>
                <p className="muted mt-1">Upload your guest list to create everyone’s personal link.</p>
                <Link href="/dashboard/upload" className="btn btn-primary mt-5"><Icon name="upload" /> Upload the guest list</Link>
              </>
            )}
            {!rows.length && !isSuper && <p className="muted mt-1">The super admin hasn’t added the guest list yet.</p>}
          </div>
        ) : (
          <ul className="divide">
            {visible.map((g) => (
              <li key={g.id} className="guest-row flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" style={selected.has(g.id) ? { background: '#FAFAFA' } : undefined}>
                <input type="checkbox" className="w-4 h-4" checked={selected.has(g.id)} onChange={() => toggle(g.id)} aria-label={`Select ${g.name}`} />
                <div className="flex-1 min-w-[12rem]">
                  <p className="font-medium leading-snug">
                    {g.name} <span className="subtle text-xs font-normal ml-1">{g.seats} {g.seats === 1 ? 'seat' : 'seats'}</span>
                  </p>
                  <p className="muted text-[13px] tabular-nums">{g.phoneDisplay}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {g.whatsapp && (
                      <span className="chip chip-ok" title={`Sent by ${g.whatsapp.byName}`}>
                        <span className="dot" />WhatsApp · {when(g.whatsapp.at)} · {g.whatsapp.byName}
                        <button className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => undo(g, 'whatsapp')} aria-label={`Mark WhatsApp for ${g.name} as not sent`} title="Mark as not sent">✕</button>
                      </span>
                    )}
                    {g.sms && (
                      <span className={'chip ' + (g.sms.status === 'failed' ? 'chip-bad' : 'chip-ok')} title={g.sms.error || `Sent by ${g.sms.byName}`}>
                        <span className="dot" />SMS {g.sms.status} · {when(g.sms.at)}
                        <button className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => undo(g, 'sms')} aria-label={`Clear the SMS status for ${g.name}`} title="Clear">✕</button>
                      </span>
                    )}
                    {!g.whatsapp && !g.sms && <span className="chip chip-muted"><span className="dot" />Not sent</span>}
                    {g.opens ? (
                      <span className="chip chip-info" title={`First opened ${when(g.opens.firstAt)}, last ${when(g.opens.lastAt)}`}>
                        <span className="dot" />Opened {g.opens.count}× · {when(g.opens.lastAt)}
                      </span>
                    ) : isSent(g) ? (
                      <span className="chip chip-warn"><span className="dot" />Not opened yet</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button className="btn btn-sm btn-wa" onClick={() => openWhatsApp(g)} title={`Open WhatsApp with the invitation for ${g.name}`}>
                    <WhatsAppIcon /> WhatsApp
                  </button>
                  {smsReady && <button className="btn btn-sm" disabled={!!smsBusy} onClick={() => sendSms([g])}><Icon name="message" /> SMS</button>}
                  <button className="btn btn-sm" onClick={() => copy(g.url)} title={g.url}><Icon name="copy" /> Copy link</button>
                  <a className="btn btn-sm px-2" href={g.path} target="_blank" rel="noopener" title="View invitation" aria-label={`View the invitation for ${g.name}`}><Icon name="external" /></a>
                  {isSuper && <Link className="btn btn-sm px-2" href={`/dashboard/guests/${g.id}`} title="Edit" aria-label={`Edit ${g.name}`}><Icon name="pencil" /></Link>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* WhatsApp one-by-one sender for the selected guests */}
      {queue && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: 'rgba(24,24,27,.4)' }} role="dialog" aria-modal="true" aria-labelledby="wa-title">
          <div className="panel w-full max-w-md p-5" style={{ boxShadow: '0 24px 64px rgba(0,0,0,.18)', borderColor: 'var(--line-strong)' }}>
            {current ? (
              <>
                <p className="subtle text-xs font-medium">Guest {queue.i + 1} of {queue.ids.length}</p>
                <h2 id="wa-title" className="text-lg font-semibold mt-1">{current.name}</h2>
                <p className="muted tabular-nums">{current.phoneDisplay}</p>
                {current.whatsapp && <p className="chip chip-warn mt-2">Already sent {when(current.whatsapp.at)} by {current.whatsapp.byName}</p>}
                <p className="text-[13px] mt-3 p-3 rounded-md whitespace-pre-wrap border" style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}>{current.whatsappText}</p>
                <p className="subtle text-xs mt-2">WhatsApp opens with this message ready. Press send there, then come back here for the next guest.</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button className="btn btn-primary flex-1" autoFocus onClick={async () => { await openWhatsApp(current); nextInQueue(); }}>
                    <WhatsAppIcon /> Open WhatsApp
                  </button>
                  <button className="btn" onClick={nextInQueue}>Skip</button>
                  <button className="btn" onClick={() => setQueue(null)}>Stop</button>
                </div>
              </>
            ) : (
              <>
                <h2 id="wa-title" className="text-lg font-semibold">All done</h2>
                <p className="muted mt-1">You went through all {queue.ids.length} selected guests.</p>
                <button className="btn btn-primary mt-4 w-full" onClick={() => { setQueue(null); setSelected(new Set()); }}>Close</button>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-md text-[13px] font-medium max-w-[calc(100vw-32px)] text-center border" style={{ background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)', boxShadow: '0 12px 32px rgba(0,0,0,.2)' }} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
