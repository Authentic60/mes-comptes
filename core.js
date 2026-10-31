/* Fonctions pures : classement, lecture des nombres/dates, import CSV/Excel, doublons. */
(function (root) {
  'use strict';
  const UNCL = 'À classer';
  const nfd = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const pad = n => String(n).padStart(2, '0');

  function classify(label, personal) {
    const u = nfd(label);
    let res = UNCL;
    for (const r of (root.DEFAULT_RULES || [])) if (u.includes(r[0])) res = r[1];
    for (const r of (personal || [])) { const k = nfd(r.k).trim(); if (k && u.includes(k)) res = r.c; }
    return res;
  }

  function cleanLabel(l) {
    return String(l == null ? '' : l).replace(/\s+CARTE\s+\*{0,2}\d{4}\b.*$/i, '').replace(/\s+/g, ' ').trim();
  }

  function parseNum(v) {
    if (typeof v === 'number') return v;
    if (v == null) return 0;
    let s = String(v).replace(/[\s  €]/g, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  function validYMD(y, m, d) { return y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31; }
  function toYMD(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10);
      return null;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return validYMD(y, +m[2], +m[1]) ? `${y}-${pad(m[2])}-${pad(m[1])}` : null; }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return validYMD(+m[1], +m[2], +m[3]) ? m[0] : null;
    return null;
  }

  /* rows : tableau de lignes (tableaux de cellules). Cherche l'en-tête (Date + Libellé) puis lit les opérations. */
  function rowsToOps(rows) {
    let h = -1, ci = null;
    for (let i = 0; i < Math.min(rows.length, 80); i++) {
      const r = (rows[i] || []).map(x => nfd(x).trim());
      const di = r.indexOf('DATE');
      const li = r.findIndex(x => x.startsWith('LIBELL') || x === 'OPERATION' || x === 'DESCRIPTION' || x === 'INTITULE');
      if (di >= 0 && li >= 0) {
        ci = { d: di, l: li, deb: r.findIndex(x => x.startsWith('DEBIT')), cre: r.findIndex(x => x.startsWith('CREDIT')), mon: r.findIndex(x => x.startsWith('MONTANT')) };
        h = i; break;
      }
    }
    if (h < 0) return { found: false, ops: [] };
    if (ci.deb < 0 && ci.cre < 0 && ci.mon < 0) return { found: false, ops: [] };
    const ops = [];
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const d = toYMD(r[ci.d]);
      if (!d) continue;
      const l = cleanLabel(r[ci.l]);
      if (!l) continue;
      let a = 0;
      if (ci.deb >= 0 || ci.cre >= 0) {
        const de = ci.deb >= 0 ? parseNum(r[ci.deb]) : 0, cr = ci.cre >= 0 ? parseNum(r[ci.cre]) : 0;
        a = (isNaN(de) ? 0 : -Math.abs(de)) + (isNaN(cr) ? 0 : Math.abs(cr));
      } else { const m = parseNum(r[ci.mon]); a = isNaN(m) ? 0 : m; }
      a = Math.round(a * 100) / 100;
      if (a === 0) continue;
      ops.push({ d, l, a });
    }
    return { found: true, ops };
  }

  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    const first = (text.split(/\r?\n/).find(x => x.trim()) || '');
    const cnt = c => first.split(c).length - 1;
    const delim = [';', '\t', ','].reduce((b, c) => cnt(c) > cnt(b) ? c : b, ';');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  const keyOf = o => o.k || (o.d + '|' + o.a.toFixed(2) + '|' + nfd(o.l));
  function dedupe(existing, incoming) {
    const cnt = new Map();
    for (const o of existing) { const k = keyOf(o); cnt.set(k, (cnt.get(k) || 0) + 1); }
    const fresh = [], dup = [];
    for (const o of incoming) {
      const k = keyOf(o); const n = cnt.get(k) || 0;
      if (n > 0) { cnt.set(k, n - 1); dup.push(o); } else fresh.push(o);
    }
    return { fresh, dup };
  }

  function suggestKeyword(label) {
    let u = nfd(label);
    u = u.replace(/^(PAIEMENT\s+(CB|PSC)\s+\d{4}\s+|\d+\s+PAIEMENTS?\s+\d{4}\s+|PRLV SEPA\s+|VIR\s+(INST|SEPA)\s+|VIR\s+)/, '');
    const toks = u.split(/\s+/).filter(t => t.length >= 3 && !/\d/.test(t) && t !== 'CARTE');
    return toks.slice(0, 2).join(' ');
  }

  const Core = { UNCL, nfd, classify, cleanLabel, parseNum, toYMD, rowsToOps, parseCSV, dedupe, keyOf, suggestKeyword };
  root.Core = Core;
  if (typeof module !== 'undefined') module.exports = Core;
})(typeof self !== 'undefined' ? self : globalThis);
