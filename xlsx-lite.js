/* Lecteur .xlsx minimal (sans bibliothèque) : dézippe avec DecompressionStream, lit les feuilles visibles. */
(function (root) {
  'use strict';
  const u16 = (d, o) => d.getUint16(o, true), u32 = (d, o) => d.getUint32(o, true);

  async function inflateRaw(u8) {
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter(); w.write(u8); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let e = u8.length - 22;
    while (e >= 0 && u32(dv, e) !== 0x06054b50) e--;
    if (e < 0) throw new Error("Ce fichier n'est pas un .xlsx valide.");
    const n = u16(dv, e + 10); let p = u32(dv, e + 16);
    const td = new TextDecoder(), files = {};
    for (let i = 0; i < n; i++) {
      if (u32(dv, p) !== 0x02014b50) break;
      const method = u16(dv, p + 10), csize = u32(dv, p + 20), nlen = u16(dv, p + 28), xlen = u16(dv, p + 30), clen = u16(dv, p + 32), lho = u32(dv, p + 42);
      files[td.decode(u8.subarray(p + 46, p + 46 + nlen))] = { method, csize, lho };
      p += 46 + nlen + xlen + clen;
    }
    return { u8, dv, files };
  }
  async function readEntry(z, name) {
    const f = z.files[name]; if (!f) return null;
    const nlen = u16(z.dv, f.lho + 26), xlen = u16(z.dv, f.lho + 28);
    const start = f.lho + 30 + nlen + xlen;
    const data = z.u8.subarray(start, start + f.csize);
    const out = f.method === 0 ? data : await inflateRaw(data);
    return new TextDecoder('utf-8').decode(out);
  }
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const colIdx = ref => { let n = 0; const m = /^[A-Z]+/.exec(ref); if (!m) return 0; for (const ch of m[0]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const textOf = el => { let t = ''; for (const x of el.getElementsByTagName('t')) { if (x.parentNode.nodeName === 'rPh') continue; t += x.textContent; } return t; };

  async function read(buf) {
    if (typeof DecompressionStream === 'undefined') throw new Error("Ton navigateur ne sait pas lire les .xlsx : enregistre l'export en CSV, ou mets iOS à jour.");
    const z = unzip(buf);
    const wb = xml(await readEntry(z, 'xl/workbook.xml'));
    const relsDoc = xml(await readEntry(z, 'xl/_rels/workbook.xml.rels'));
    const rels = {};
    for (const r of relsDoc.getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target');
    const sstXml = await readEntry(z, 'xl/sharedStrings.xml');
    const shared = sstXml ? [...xml(sstXml).getElementsByTagName('si')].map(textOf) : [];
    const out = [];
    for (const s of wb.getElementsByTagName('sheet')) {
      const state = s.getAttribute('state');
      if (state === 'hidden' || state === 'veryHidden') continue;
      let target = rels[s.getAttribute('r:id')] || '';
      target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
      const sx = await readEntry(z, target); if (!sx) continue;
      const rows = [];
      for (const row of xml(sx).getElementsByTagName('row')) {
        const arr = [];
        for (const c of row.getElementsByTagName('c')) {
          const t = c.getAttribute('t'); const vEl = c.getElementsByTagName('v')[0]; const v = vEl ? vEl.textContent : null;
          let val = null;
          if (t === 's') val = v == null ? null : shared[+v];
          else if (t === 'inlineStr') { const is = c.getElementsByTagName('is')[0]; val = is ? textOf(is) : null; }
          else if (t === 'str') val = v;
          else if (t === 'b') val = v === '1';
          else if (t === 'e') val = null;
          else if (v != null && v !== '') val = parseFloat(v);
          arr[colIdx(c.getAttribute('r') || 'A1')] = val;
        }
        rows.push(arr);
      }
      out.push({ name: s.getAttribute('name'), rows });
    }
    return out;
  }
  root.XlsxLite = { read };
})(typeof self !== 'undefined' ? self : globalThis);
