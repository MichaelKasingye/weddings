'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { normalizePhone, formatPhone } from '@/lib/phone';
import { defaultSeats } from '@/lib/wedding';
import { importGuestsAction, type ImportResult } from '@/app/(admin)/dashboard/actions';

type Parsed = { row: number; name: string; phoneRaw: string; seatsRaw: string };
type Checked = Parsed & { phone: string | null; seats: number | null; status: 'ok' | 'warn' | 'skip' | 'error'; note: string };

const HEAD_NAME = /name|guest|invitee/i;
const HEAD_PHONE = /phone|number|tel|mobile|contact|whatsapp/i;
const HEAD_SEATS = /seat|invites?$|count|people|pax|admit/i;
const HEAD_TITLE = /^(title|salutation|prefix)$/i;

/** Finds the name / phone / seats columns (from the header row if there is one). */
function toRows(table: unknown[][]): Parsed[] {
  const rows = table.map((r) => r.map((c) => (c == null ? '' : String(c).trim()))).filter((r) => r.some(Boolean));
  if (!rows.length) return [];
  const head = rows[0];
  const hasHeader = head.some((c) => HEAD_NAME.test(c) || HEAD_PHONE.test(c)) && !head.some((c) => normalizePhone(c));
  let iTitle = -1, iName = 0, iPhone = 1, iSeats = 2;
  if (hasHeader) {
    iTitle = head.findIndex((c) => HEAD_TITLE.test(c));
    iName = head.findIndex((c) => HEAD_NAME.test(c));
    iPhone = head.findIndex((c, i) => i !== iName && HEAD_PHONE.test(c));
    iSeats = head.findIndex((c, i) => i !== iName && i !== iPhone && HEAD_SEATS.test(c));
    if (iName < 0) iName = 0;
    if (iPhone < 0) iPhone = iName === 1 ? 0 : 1;
  }
  return rows.slice(hasHeader ? 1 : 0).map((r, i) => {
    const title = iTitle >= 0 ? r[iTitle] || '' : '';
    const name = [title, r[iName] || ''].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return { row: i + 1, name, phoneRaw: r[iPhone] || '', seatsRaw: iSeats >= 0 ? r[iSeats] || '' : '' };
  });
}

function check(rows: Parsed[], existing: Set<string>, existingPhones: Set<string>): Checked[] {
  const seenKey = new Set<string>(), phoneCount = new Map<string, number>();
  const out = rows.map((r): Checked => {
    const phone = normalizePhone(r.phoneRaw);
    const seatsNum = r.seatsRaw ? Number(r.seatsRaw) : defaultSeats(r.name);
    const seats = Number.isInteger(seatsNum) && seatsNum >= 1 && seatsNum <= 20 ? seatsNum : null;
    const base = { ...r, phone, seats };
    if (!r.name) return { ...base, status: 'error', note: 'Name is missing' };
    if (r.name.length > 80) return { ...base, status: 'error', note: 'Name is too long (80 characters at most)' };
    if (!r.phoneRaw) return { ...base, status: 'error', note: 'Phone is missing' };
    if (!phone) return { ...base, status: 'error', note: 'Not a valid phone number' };
    if (seats === null) return { ...base, status: 'error', note: 'Seats must be a number from 1 to 20' };
    const key = r.name.toLowerCase() + '|' + phone;
    if (existing.has(key)) return { ...base, status: 'skip', note: 'Already on the guest list' };
    if (seenKey.has(key)) return { ...base, status: 'skip', note: 'Appears twice in this file' };
    seenKey.add(key);
    phoneCount.set(phone, (phoneCount.get(phone) || 0) + 1);
    return { ...base, status: 'ok', note: '' };
  });
  // the same number for different names is allowed (e.g. one phone for a family), but worth a look
  for (const c of out) {
    if (c.status !== 'ok' || !c.phone) continue;
    if ((phoneCount.get(c.phone) || 0) > 1) { c.status = 'warn'; c.note = 'Same phone as another guest in this file'; }
    else if (existingPhones.has(c.phone)) { c.status = 'warn'; c.note = 'Same phone as a guest already on the list'; }
  }
  return out;
}

const TEMPLATE = 'Name,Phone,Seats\r\nMr. & Mrs. John Doe,0772 123456,2\r\nDr. Sarah Kato,+256 701 234567,1\r\nMs. Grace Namuli,0756123456,\r\n';

export default function Uploader({ existingKeys, existingPhones }: { existingKeys: string[]; existingPhones: string[] }) {
  const existing = useMemo(() => new Set(existingKeys), [existingKeys]);
  const phones = useMemo(() => new Set(existingPhones), [existingPhones]);
  const [fileName, setFileName] = useState('');
  const [paste, setPaste] = useState('');
  const [rows, setRows] = useState<Checked[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(file: File | undefined) {
    setError(''); setResult(null); setRows(null);
    if (!file) return;
    setFileName(file.name);
    try {
      let table: unknown[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import('read-excel-file/browser');
        table = (await readSheet(file)) as unknown[][];
      } else if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        table = Papa.parse<string[]>(await file.text(), { skipEmptyLines: true }).data;
      } else {
        setError('Please choose an Excel (.xlsx) or CSV file. In Excel: File → Save As → Excel Workbook or CSV.');
        return;
      }
      const parsed = toRows(table);
      if (!parsed.length) { setError('The file has no rows.'); return; }
      setRows(check(parsed, existing, phones));
    } catch (e) {
      setError('Could not read the file: ' + (e instanceof Error ? e.message : 'unknown error'));
    }
  }

  function onPaste() {
    setError(''); setResult(null); setFileName('');
    const table = Papa.parse<string[]>(paste.trim(), { skipEmptyLines: true, delimiter: '' }).data;
    const parsed = toRows(table);
    if (!parsed.length) { setError('Nothing to read. Paste one guest per line: name, phone, seats.'); return; }
    setRows(check(parsed, existing, phones));
  }

  async function onImport() {
    if (!rows) return;
    const toSend = rows.filter((r) => r.status === 'ok' || r.status === 'warn');
    if (!toSend.length) return;
    setBusy(true);
    const r = await importGuestsAction(toSend.map((x) => ({ name: x.name, phone: x.phone!, seats: x.seats })));
    setBusy(false);
    setResult(r);
    if (r.ok) setRows(null);
  }

  const counts = rows ? { ok: rows.filter((r) => r.status === 'ok').length, warn: rows.filter((r) => r.status === 'warn').length, skip: rows.filter((r) => r.status === 'skip').length, error: rows.filter((r) => r.status === 'error').length } : null;
  const ready = counts ? counts.ok + counts.warn : 0;

  return (
    <div className="space-y-4">
      {result?.ok && (
        <div className="alert alert-ok">
          <p className="font-semibold">{result.added} guest(s) added, each with their own invitation link.</p>
          {result.skipped.length > 0 && <p className="text-sm mt-1">{result.skipped.length} skipped: {result.skipped.slice(0, 5).map((s) => `${s.name || 'row ' + s.row} (${s.reason})`).join('; ')}{result.skipped.length > 5 ? '…' : ''}</p>}
          <Link href="/dashboard/guests" className="btn btn-sm btn-primary mt-3">Go to the guest list</Link>
        </div>
      )}
      {result && !result.ok && <p className="alert alert-bad">{result.error}</p>}
      {error && <p className="alert alert-bad">{error}</p>}

      <section className="panel p-5 space-y-3">
        <h2 className="font-semibold">1. Choose the file</h2>
        <p className="muted text-sm">
          An Excel (.xlsx) or CSV file with a <b>Name</b> column and a <b>Phone</b> column. A <b>Seats</b> column is optional
          (empty = 2 for “Mr. &amp; Mrs.”, otherwise 1). Phone numbers can be written any way: 0772 123456, 772123456, +256 772 123456.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn btn-primary cursor-pointer">
            Choose file…
            <input type="file" accept=".xlsx,.csv,.txt,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {fileName && <span className="text-sm muted">{fileName}</span>}
          <a className="btn btn-sm" href={'data:text/csv;charset=utf-8,' + encodeURIComponent(TEMPLATE)} download="guest-list-template.csv">Download a template</a>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer muted">…or paste the list</summary>
          <textarea className="input mt-2 font-mono text-xs" rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Mr. & Mrs. John Doe, 0772 123456, 2\nDr. Sarah Kato, 0701 234567'} />
          <button className="btn btn-sm mt-2" onClick={onPaste} disabled={!paste.trim()}>Read the pasted list</button>
        </details>
      </section>

      {rows && counts && (
        <section className="panel p-5 space-y-3">
          <h2 className="font-semibold">2. Check and add</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="chip chip-ok">{counts.ok} ready</span>
            {counts.warn > 0 && <span className="chip chip-warn">{counts.warn} ready, worth a look</span>}
            {counts.skip > 0 && <span className="chip chip-muted">{counts.skip} skipped (duplicates)</span>}
            {counts.error > 0 && <span className="chip chip-bad">{counts.error} with problems (not added)</span>}
          </div>
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto rounded-md border" style={{ borderColor: 'var(--line)' }}>
            <table className="table">
              <thead className="sticky top-0" style={{ background: 'var(--panel)' }}>
                <tr><th>#</th><th>Name on invitation</th><th>Phone</th><th>Seats</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row} style={r.status === 'error' ? { background: 'var(--bad-bg)' } : r.status === 'skip' ? { opacity: 0.55 } : undefined}>
                    <td className="muted tabular-nums">{r.row}</td>
                    <td>{r.name || <span className="muted">—</span>}</td>
                    <td className="tabular-nums whitespace-nowrap">{r.phone ? formatPhone(r.phone) : <span style={{ color: 'var(--bad)' }}>{r.phoneRaw || '—'}</span>}</td>
                    <td className="tabular-nums">{r.seats ?? r.seatsRaw}</td>
                    <td>
                      {r.status === 'ok' && <span className="chip chip-ok">Ready</span>}
                      {r.status === 'warn' && <span className="chip chip-warn">{r.note}</span>}
                      {r.status === 'skip' && <span className="chip chip-muted">{r.note}</span>}
                      {r.status === 'error' && <span className="chip chip-bad">{r.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {counts.error > 0 && <p className="muted text-sm">Rows with problems are left out. Fix them in the file and upload it again; guests already added are skipped automatically.</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={onImport} disabled={!ready || busy}>{busy ? 'Adding…' : `Add ${ready} guest${ready === 1 ? '' : 's'}`}</button>
            <button className="btn" onClick={() => setRows(null)} disabled={busy}>Cancel</button>
          </div>
        </section>
      )}
    </div>
  );
}
