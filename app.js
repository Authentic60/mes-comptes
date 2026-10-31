/* Mes budgets — web app hors-ligne. Les données restent dans le stockage local de l'iPhone. */
(() => {
'use strict';
const KEY = 'mes-budgets-v1';
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const TPL = [
  { name: 'Logement', lines: ['Loyer', 'Électricité (EDF)', 'Internet / mobile'] },
  { name: 'Obligations', lines: ['Assurances', 'Impôts', 'Frais bancaires'] },
  { name: 'Voiture', lines: ['Recharge / carburant', 'Péages / parkings', 'Entretien voiture'] },
  { name: 'Vie quotidienne', lines: ['Courses alimentaires', 'Santé / coiffure'] },
  { name: 'Plaisirs et abonnements', lines: ['Restaurants', 'Shopping / loisirs', 'Jeux vidéo (Steam)', 'Abonnements'] },
  { name: 'Épargne et marge', lines: ['Épargne', 'Imprévus / divers'] }
];
const FIXED_GROUPS = ['Logement', 'Obligations', 'Épargne et marge'];
const INCOME = ['Salaire', 'Virement co-titulaire', 'Virement depuis épargne', 'Autre entrée'];
const NEUTRAL = ['Virement interne'];
const UNCL = Core.UNCL;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const E0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const E2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const todayYMD = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthOf = o => o.m || o.d.slice(0, 7);
const ymLabel = ym => `${MOIS[+ym.slice(5) - 1]} ${ym.slice(0, 4)}`;
const shiftYM = (ym, n) => { let y = +ym.slice(0, 4), m = +ym.slice(5) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return `${y}-${pad(m + 1)}`; };
const fmtDay = d => `${d.slice(8)}/${d.slice(5, 7)}`;
const sum = (a, k) => a.reduce((x, y) => x + y[k], 0);

/* ---------- état ---------- */
function defaultState() {
  return { v: 1, salary: 0, groups: TPL.map(g => ({ name: g.name, lines: g.lines.map(c => ({ c, b: 0 })) })), hors: ['Exceptionnel'], rules: [], ops: [], lastBackup: null, lastCat: null };
}
function valid(s) { return s && s.v === 1 && Array.isArray(s.ops) && Array.isArray(s.groups) && Array.isArray(s.rules) && Array.isArray(s.hors); }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (valid(s)) return s; } catch (e) {} return defaultState(); }
let state = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("Impossible d'enregistrer : stockage plein ou bloqué."); } }
const ui = { tab: 'budget', ym: todayYMD().slice(0, 7), open: {}, q: '', onlyUncl: false, pending: null };

const budgetCats = () => state.groups.flatMap(g => g.lines.map(l => l.c));
const allCats = () => [...budgetCats(), ...state.hors, ...INCOME, ...NEUTRAL, UNCL];
function catOptions(sel) {
  const known = new Set(allCats());
  const opt = (arr, label) => `<optgroup label="${esc(label)}">${arr.map(c => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('')}</optgroup>`;
  const others = [...NEUTRAL, UNCL]; if (sel && !known.has(sel)) others.push(sel);
  return state.groups.map(g => opt(g.lines.map(l => l.c), g.name)).join('') + opt(state.hors, 'Hors budget') + opt(INCOME, 'Entrées') + opt(others, 'Autres');
}
function monthTotals(ym) { const t = {}; for (const o of state.ops) if (monthOf(o) === ym) t[o.c] = (t[o.c] || 0) + o.a; return t; }

/* ---------- toast & feuilles ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }
function openSheet(html) { const o = $('#overlay'); o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`; o.hidden = false; }
function closeSheet() { const o = $('#overlay'); o.hidden = true; o.innerHTML = ''; ui.pending = null; }

/* ---------- barres & statuts ---------- */
function bar(s, b, fixed) {
  const r = b > 0 ? s / b : (s > 2 ? 2 : 0);
  const pct = Math.min(100, Math.max(0, r * 100));
  const cls = r > 1.0 ? 'over' : r >= 0.8 ? 'warn' : fixed ? 'fx' : '';
  return `<div class="bar" role="img" aria-label="${Math.round(pct)} % du budget"><i class="${cls}" style="width:${pct.toFixed(1)}%"></i></div>`;
}
function status(s, b) {
  if (b <= 0) return s > 2 ? `<span class="bad">⚠ Hors budget · ${E0.format(s)}</span>` : '';
  const d = b - s;
  return d < -2 ? `<span class="bad">⚠ Dépassé de ${E0.format(-d)}</span>` : `<span class="dim">Reste ${E0.format(Math.max(d, 0))}</span>`;
}

/* ---------- vue Budget ---------- */
function viewBudget() {
  const t = monthTotals(ui.ym);
  const gs = state.groups.map((g, i) => {
    const lines = g.lines.map(l => ({ c: l.c, b: l.b, s: -(t[l.c] || 0) }));
    return { i, name: g.name, lines, b: sum(lines, 'b'), s: sum(lines, 's') };
  });
  const B = sum(gs, 'b'), S = sum(gs, 's'), rest = B - S;
  const known = new Set(allCats());
  const horsRows = [...state.hors, ...Object.keys(t).filter(c => !known.has(c))].map(c => ({ c, s: -(t[c] || 0) })).filter(r => Math.abs(r.s) >= 0.005);
  const nUncl = state.ops.filter(o => monthOf(o) === ui.ym && o.c === UNCL).length;
  const sal = t['Salaire'] || 0, epa = t['Virement depuis épargne'] || 0;
  let h = '';
  const last = state.lastBackup ? new Date(state.lastBackup) : null;
  if (state.ops.length > 0 && (!last || (Date.now() - last) > 30 * 864e5)) h += `<div class="banner">💾 Pense à sauvegarder tes données (Réglages › Sauvegarde). Elles ne sont que sur ce téléphone.</div>`;
  if (B === 0) h += `<div class="banner">Aucun budget défini. Va dans Réglages pour les saisir, ou restaure ta sauvegarde.</div>`;
  h += `<section class="card hero"><div class="lbl">Reste du budget · ${esc(ymLabel(ui.ym))}</div>
    <div class="big ${rest < 0 ? 'neg' : ''}">${E0.format(rest)}</div>${bar(S, B)}
    <div class="sub">${E0.format(S)} dépensés sur ${E0.format(B)} budgétés</div>
    <div class="kv"><span>Salaire reçu${state.salary ? ' (prévu ' + E0.format(state.salary) + ')' : ''}</span><b>${E0.format(sal)}</b></div>
    <div class="kv"><span>Prélevé sur l'épargne</span><b class="${epa > 0 ? 'neg' : ''}">${E0.format(epa)}</b></div></section>`;
  for (const g of gs) {
    const fixed = FIXED_GROUPS.includes(g.name), open = !!ui.open[g.i];
    h += `<section class="card group"><button class="ghead" data-act="toggle" data-g="${g.i}" aria-expanded="${open}">
      <div class="r1"><span class="nm">${esc(g.name)}<span class="chev">${open ? '▾' : '▸'}</span></span>
      <span class="am">${E0.format(g.s)} <small>/ ${E0.format(g.b)}</small></span></div>${bar(g.s, g.b, fixed)}
      <div class="st" style="margin-top:6px;font-size:13px">${status(g.s, g.b)}</div></button>`;
    if (open) h += `<div class="glines">${g.lines.map(l => `<div class="line"><div class="r1"><span>${esc(l.c)}</span><span class="am">${E0.format(l.s)} <small class="dim">/ ${E0.format(l.b)}</small></span></div>${bar(l.s, l.b, fixed)}<div class="st">${status(l.s, l.b)}</div></div>`).join('')}</div>`;
    h += `</section>`;
  }
  if (horsRows.length || nUncl) {
    h += `<h2>Hors budget</h2><section class="card">`;
    for (const r of horsRows) h += `<div class="row"><div class="t">${esc(r.c)}</div><div class="v">${E2.format(r.s)}</div></div>`;
    if (nUncl) h += `<div class="row"><div class="t">${nUncl} opération${nUncl > 1 ? 's' : ''} à classer</div><button class="btn sm" data-act="goUncl">Classer</button></div>`;
    h += `</section>`;
  }
  return h;
}

/* ---------- vue Opérations ---------- */
function viewOps() {
  return `<div class="tools"><input type="search" id="q" placeholder="Rechercher" value="${esc(ui.q)}" autocomplete="off"><label class="tog"><input type="checkbox" id="onlyUncl" ${ui.onlyUncl ? 'checked' : ''}> À classer</label></div><div id="opsList"></div>`;
}
function renderOpsList() {
  let ops = state.ops.filter(o => monthOf(o) === ui.ym);
  if (ui.onlyUncl) ops = ops.filter(o => o.c === UNCL);
  const q = Core.nfd(ui.q).trim();
  if (q) ops = ops.filter(o => Core.nfd(o.l + ' ' + o.c).includes(q));
  ops.sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
  const el = $('#opsList');
  if (!ops.length) { el.innerHTML = `<div class="empty">Aucune opération ${ui.onlyUncl ? 'à classer ' : ''}ce mois-ci.</div>`; return; }
  const tot = ops.reduce((x, o) => x + o.a, 0);
  el.innerHTML = `<div class="hint">${ops.length} opération${ops.length > 1 ? 's' : ''} · total ${E2.format(tot)}</div><section class="card" style="padding:4px 16px">` +
    ops.map(o => `<div class="row"><button class="opbtn" data-act="edit" data-id="${esc(o.id)}"><div class="t"><div class="l1">${esc(o.l)}</div><div class="l2">${fmtDay(o.d)} · ${esc(o.c)}${o.c === UNCL ? '<span class="chip u">à classer</span>' : ''}${o.m && o.m !== o.d.slice(0, 7) ? `<span class="chip">imputé ${esc(o.m.slice(5))}/${esc(o.m.slice(0, 4))}</span>` : ''}</div></div></button><div class="v ${o.a > 0 ? 'in' : ''}">${E2.format(o.a)}</div></div>`).join('') + `</section>`;
}

/* ---------- vue Réglages ---------- */
function viewSettings() {
  const lastB = state.lastBackup ? new Date(state.lastBackup).toLocaleDateString('fr-FR') : 'jamais';
  let h = `<h2>Salaire prévu</h2><section class="card"><div class="bud"><span>Par mois</span><input type="number" inputmode="decimal" data-bind="salary" value="${state.salary || ''}" placeholder="0"></div></section>`;
  h += `<h2>Budgets mensuels</h2><section class="card">`;
  state.groups.forEach((g, i) => {
    h += `<div style="font-weight:700;margin:10px 0 2px">${esc(g.name)}</div>`;
    g.lines.forEach((l, j) => { h += `<div class="bud"><span>${esc(l.c)}</span><input type="number" inputmode="decimal" data-bind="budget" data-g="${i}" data-l="${j}" value="${l.b || ''}" placeholder="0"></div>`; });
  });
  h += `<div class="kv" style="margin-top:10px"><span>Total budgété</span><b id="budTotal">${E0.format(sum(state.groups.flatMap(g => g.lines), 'b'))}</b></div></section>`;
  h += `<h2>Importer mes opérations</h2><section class="card"><p class="hint" style="margin-top:0">Choisis l'export de ta banque (.xlsx ou .csv). Les doublons sont ignorés et les opérations sont classées automatiquement.</p>
    <label class="btn">Choisir un fichier<input type="file" id="fileImport" accept=".xlsx,.csv,.txt,text/csv"></label></section>`;
  h += `<h2>Sauvegarde</h2><section class="card"><p class="hint" style="margin-top:0">Dernière sauvegarde : ${esc(lastB)}. ${state.ops.length} opérations enregistrées sur ce téléphone.</p>
    <button class="btn" data-act="exportJson">Sauvegarder mes données</button>
    <label class="btn sec">Restaurer une sauvegarde<input type="file" id="fileRestore" accept=".json,application/json"></label>
    <button class="btn sec" data-act="exportCsv">Exporter les opérations (Excel / CSV)</button></section>`;
  h += `<h2>Règles de classement perso</h2><section class="card"><p class="hint" style="margin-top:0">Si le libellé contient le mot-clé, l'opération prend cette catégorie (ça passe avant les règles de base).</p>`;
  h += state.rules.length ? state.rules.map((r, i) => `<div class="rule"><span>${esc(r.k)} → <b>${esc(r.c)}</b></span><button data-act="delRule" data-i="${i}" aria-label="Supprimer">×</button></div>`).join('') : `<div class="dim" style="font-size:14px">Aucune règle perso.</div>`;
  h += `<div class="field"><span>Nouveau mot-clé</span><input type="text" id="ruleK" placeholder="ex. LECLERC" autocapitalize="characters" autocomplete="off"></div>
    <div class="field"><span>Catégorie</span><select id="ruleC">${catOptions('')}</select></div><button class="btn sec" data-act="addRule">Ajouter la règle</button></section>`;
  h += `<h2>Zone sensible</h2><section class="card"><button class="btn danger" data-act="wipe">Effacer toutes mes données</button></section>
    <p class="hint">Mes budgets v1 · tout reste sur cet appareil, rien n'est envoyé sur Internet.</p>`;
  return h;
}

/* ---------- rendu ---------- */
function renderTop() {
  const t = $('#top');
  if (ui.tab === 'settings') { t.innerHTML = '<h1>Réglages</h1>'; return; }
  t.innerHTML = `<button class="nav" data-act="prev" aria-label="Mois précédent">‹</button><div class="month">${esc(ymLabel(ui.ym))}</div><button class="nav" data-act="next" aria-label="Mois suivant">›</button>`;
}
function render() {
  renderTop();
  $('#view').innerHTML = ui.tab === 'budget' ? viewBudget() : ui.tab === 'ops' ? viewOps() : viewSettings();
  if (ui.tab === 'ops') renderOpsList();
  $$('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
}

/* ---------- ajout / modification d'une opération ---------- */
function sheetOp(id) {
  const o = id ? state.ops.find(x => x.id === id) : { id: null, d: todayYMD(), l: '', a: -1, c: state.lastCat || budgetCats()[0], m: '' };
  if (!o) return;
  const isIn = o.a > 0;
  const kw = id && o.c === UNCL ? Core.suggestKeyword(o.l) : '';
  openSheet(`<h3>${id ? 'Modifier l’opération' : 'Nouvelle opération'}</h3>
  <form id="opForm" autocomplete="off" data-id="${id ? esc(id) : ''}" data-oldcat="${esc(o.c)}">
    <div class="seg"><label><input type="radio" name="typ" value="out" ${isIn ? '' : 'checked'}><span>Dépense</span></label><label><input type="radio" name="typ" value="in" ${isIn ? 'checked' : ''}><span>Entrée</span></label></div>
    <div class="field"><span>Montant (€)</span><input type="text" name="amt" inputmode="decimal" placeholder="0,00" value="${id ? String(Math.abs(o.a)).replace('.', ',') : ''}"></div>
    <div class="field"><span>Catégorie</span><select name="cat">${catOptions(o.c)}</select></div>
    <div class="field"><span>Libellé</span><input type="text" name="lbl" value="${esc(o.l)}" placeholder="facultatif"></div>
    <div class="grid2"><div class="field"><span>Date</span><input type="date" name="d" value="${esc(o.d)}"></div>
    <div class="field"><span>Imputer au mois (facultatif)</span><input type="month" name="m" value="${esc(o.m || '')}"></div></div>
    ${id ? `<div class="field"><label class="tog"><input type="checkbox" name="remember"> Retenir pour les prochains imports :</label><input type="text" name="kw" value="${esc(kw)}" placeholder="mot-clé du libellé" autocapitalize="characters"></div>` : ''}
    <button type="button" class="btn" data-act="saveOp">Enregistrer</button>
    ${id ? `<button type="button" class="btn danger" data-act="delOp">Supprimer</button>` : ''}
    <button type="button" class="btn sec" data-act="close">Annuler</button></form>`);
  if (!id) setTimeout(() => { const i = $('#opForm [name=amt]'); if (i) i.focus(); }, 80);
}
function saveOp() {
  const f = $('#opForm'); const id = f.dataset.id;
  const amt = Core.parseNum(f.amt.value);
  if (!(amt > 0)) { toast('Entre un montant supérieur à 0.'); return; }
  const d = Core.toYMD(f.d.value); if (!d) { toast('Date invalide.'); return; }
  const c = f.cat.value; const l = f.lbl.value.trim() || c;
  const a = Math.round(amt * 100) / 100 * (f.typ.value === 'in' ? 1 : -1);
  let m = /^\d{4}-\d{2}$/.test(f.m.value) ? f.m.value : ''; if (m === d.slice(0, 7)) m = '';
  if (id) {
    const o = state.ops.find(x => x.id === id); if (!o) return;
    const changed = c !== f.dataset.oldcat;
    Object.assign(o, { d, l, a, c, m }); if (!m) delete o.m;
    if (changed) o.f = 1;
    if (f.remember && f.remember.checked && f.kw.value.trim()) { state.rules.push({ k: f.kw.value.trim(), c }); reclassify(); }
  } else {
    const o = { id: uid(), d, l, a, c, f: 1 }; if (m) o.m = m; state.ops.push(o); state.lastCat = c;
  }
  ui.ym = (m || d.slice(0, 7)); save(); closeSheet(); render(); toast('Enregistré ✓');
}
function reclassify() { let n = 0; for (const o of state.ops) if (o.c === UNCL && !o.f) { const c = Core.classify(o.l, state.rules); if (c !== UNCL) { o.c = c; n++; } } return n; }

/* ---------- import ---------- */
async function handleImport(file) {
  try {
    let sheets;
    const buf = await file.arrayBuffer();
    if (/\.xlsx$/i.test(file.name)) sheets = await XlsxLite.read(buf);
    else { let txt; try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('windows-1252').decode(buf); } sheets = [{ name: file.name, rows: Core.parseCSV(txt) }]; }
    let all = []; const parts = [];
    for (const s of sheets) { const r = Core.rowsToOps(s.rows); if (r.found && r.ops.length) { parts.push(`${s.name} (${r.ops.length})`); all = all.concat(r.ops); } }
    if (!all.length) { toast('Aucune opération trouvée : il faut des colonnes Date et Libellé.'); return; }
    const maxD = all.reduce((m, o) => o.d > m ? o.d : m, '0000');
    const dt = new Date(maxD + 'T12:00:00'); dt.setDate(dt.getDate() - 90);
    ui.pending = { all, parts, since: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` };
    sheetImport();
  } catch (e) { toast(e.message || 'Import impossible.'); }
}
function computeImport() {
  const p = ui.pending; const inc = p.all.filter(o => o.d >= p.since);
  const { fresh, dup } = Core.dedupe(state.ops, inc);
  p.fresh = fresh.map(o => ({ ...o, c: Core.classify(o.l, state.rules) }));
  p.dup = dup.length; p.inc = inc.length;
}
function sheetImport() {
  const p = ui.pending; computeImport();
  openSheet(`<h3>Importer</h3><p class="hint" style="margin-top:0">Feuilles lues : ${esc(p.parts.join(', '))}</p>
    <div class="field"><span>Importer à partir du</span><input type="date" id="since" value="${esc(p.since)}"></div><div id="impInfo"></div>
    <button class="btn" data-act="confirmImport" id="impGo">Importer</button><button class="btn sec" data-act="close">Annuler</button>`);
  impInfo();
}
function impInfo() {
  const p = ui.pending; if (!p) return;
  const u = p.fresh.filter(o => o.c === UNCL).length;
  $('#impInfo').innerHTML = `<div class="card" style="background:var(--bg)"><b>${p.fresh.length}</b> nouvelle${p.fresh.length > 1 ? 's' : ''} opération${p.fresh.length > 1 ? 's' : ''} · ${p.dup} déjà présente${p.dup > 1 ? 's' : ''}<br><span class="dim">${u} à classer ensuite à la main</span></div>`;
  $('#impGo').disabled = !p.fresh.length;
}
function confirmImport() {
  const p = ui.pending; if (!p || !p.fresh.length) return;
  let newest = '0000';
  for (const o of p.fresh) { state.ops.push({ id: uid(), d: o.d, l: o.l, a: o.a, c: o.c }); if (o.d > newest) newest = o.d; }
  const n = p.fresh.length; save(); closeSheet(); ui.tab = 'budget'; ui.ym = newest.slice(0, 7); render(); window.scrollTo(0, 0);
  toast(`${n} opérations importées ✓`);
}

/* ---------- export / sauvegarde ---------- */
async function deliver(name, mime, content) {
  const blob = new Blob([content], { type: mime }); const file = new File([blob], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); return true;
}
async function exportJson() {
  const ok = await deliver(`sauvegarde-budgets-${todayYMD()}.json`, 'application/json', JSON.stringify(state));
  if (ok) { state.lastBackup = Date.now(); save(); render(); toast('Sauvegarde créée ✓'); }
}
async function exportCsv() {
  const rows = [...state.ops].sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0).map(o => `${o.d.slice(8)}/${o.d.slice(5, 7)}/${o.d.slice(0, 4)};"${o.l.replace(/"/g, '""')}";${o.a.toFixed(2).replace('.', ',')};${o.c};${monthOf(o)}`);
  await deliver(`operations-${todayYMD()}.csv`, 'text/csv', '﻿Date;Libellé;Montant;Catégorie;Mois\n' + rows.join('\n'));
}
function restore(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const s = JSON.parse(r.result);
      if (!valid(s)) throw new Error('bad');
      if (!confirm(`Remplacer toutes les données actuelles par cette sauvegarde (${s.ops.length} opérations) ?`)) return;
      state = s; save(); ui.ym = todayYMD().slice(0, 7); ui.tab = 'budget'; render(); toast('Sauvegarde restaurée ✓');
    } catch (e) { toast("Ce fichier n'est pas une sauvegarde valide."); }
  };
  r.readAsText(file);
}

/* ---------- événements ---------- */
document.addEventListener('click', e => {
  if (e.target.id === 'overlay') { closeSheet(); return; }
  const el = e.target.closest('[data-act],[data-tab]'); if (!el) return;
  if (el.dataset.tab) { ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const a = el.dataset.act;
  if (a === 'prev' || a === 'next') { ui.ym = shiftYM(ui.ym, a === 'next' ? 1 : -1); render(); window.scrollTo(0, 0); }
  else if (a === 'toggle') { ui.open[el.dataset.g] = !ui.open[el.dataset.g]; render(); }
  else if (a === 'add') sheetOp(null);
  else if (a === 'edit') sheetOp(el.dataset.id);
  else if (a === 'goUncl') { ui.tab = 'ops'; ui.onlyUncl = true; ui.q = ''; render(); window.scrollTo(0, 0); }
  else if (a === 'close') closeSheet();
  else if (a === 'saveOp') saveOp();
  else if (a === 'delOp') { if (confirm('Supprimer cette opération ?')) { const id = $('#opForm').dataset.id; state.ops = state.ops.filter(o => o.id !== id); save(); closeSheet(); render(); toast('Supprimée'); } }
  else if (a === 'confirmImport') confirmImport();
  else if (a === 'exportJson') exportJson();
  else if (a === 'exportCsv') exportCsv();
  else if (a === 'delRule') { state.rules.splice(+el.dataset.i, 1); save(); render(); }
  else if (a === 'addRule') {
    const k = $('#ruleK').value.trim(); if (!k) { toast('Entre un mot-clé.'); return; }
    state.rules.push({ k, c: $('#ruleC').value }); const n = reclassify(); save(); render(); toast(n ? `Règle ajoutée · ${n} opération(s) classée(s)` : 'Règle ajoutée ✓');
  }
  else if (a === 'wipe') { if (confirm('Effacer TOUTES tes données de ce téléphone ? Pense à sauvegarder avant.') && confirm('Vraiment tout effacer ?')) { state = defaultState(); save(); render(); toast('Données effacées'); } }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { ui.q = e.target.value; renderOpsList(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'onlyUncl') { ui.onlyUncl = t.checked; renderOpsList(); }
  else if (t.id === 'since') { if (ui.pending) { ui.pending.since = t.value || '0000-00-00'; computeImport(); impInfo(); } }
  else if (t.id === 'fileImport') { const f = t.files[0]; t.value = ''; if (f) handleImport(f); }
  else if (t.id === 'fileRestore') { const f = t.files[0]; t.value = ''; if (f) restore(f); }
  else if (t.dataset.bind === 'salary') { state.salary = Core.parseNum(t.value) || 0; save(); }
  else if (t.dataset.bind === 'budget') {
    state.groups[+t.dataset.g].lines[+t.dataset.l].b = Math.max(0, Core.parseNum(t.value) || 0); save();
    $('#budTotal').textContent = E0.format(sum(state.groups.flatMap(g => g.lines), 'b'));
  }
});

render();
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
