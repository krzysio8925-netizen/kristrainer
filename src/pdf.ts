// Generowanie PDF planu (pdfmake ładowany dopiero przy pierwszym kliknięciu „Generuj”).
import { menuDay, planDay } from './engine/silnik';
import type { Data, Day, Macro4, Person, PlanVersion, Row } from './engine/types';
import { DAY_NAME, VEG_NOTE, fmt, qtyTxt, serveLabel } from './format';

type PdfMake = { createPdf: (doc: unknown) => { getBlob: (cb: (b: Blob) => void) => void } };
declare global { interface Window { pdfMake?: PdfMake } }

function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('Nie wczytała się biblioteka PDF.'));
    document.head.appendChild(s);
  });
}
async function pdfMake(): Promise<PdfMake> {
  if (!window.pdfMake?.createPdf) { await loadScript('./vendor/pdfmake.min.js'); await loadScript('./vendor/vfs_fonts.js'); }
  return window.pdfMake!;
}

/** Logo Kris Trainer narysowane na canvasie (font Inter) → PNG. */
async function logoPng() {
  try { await Promise.all([document.fonts.load('900 25px Inter'), document.fonts.load('600 11.5px Inter')]); } catch { /* font zapasowy */ }
  const SC = 6, cv = document.createElement('canvas'); cv.width = 210 * SC; cv.height = 52 * SC;
  const x = cv.getContext('2d')!; x.scale(SC, SC);
  const rr = (X: number, Y: number, W: number, H: number, R: number, f: string) => { x.beginPath(); x.roundRect(X, Y, W, H, R); x.fillStyle = f; x.fill(); };
  rr(0, 0, 52, 52, 12, '#111827'); rr(8, 23, 36, 6, 1.5, '#f59e0b'); rr(5, 15, 6, 22, 2, '#f59e0b'); rr(41, 15, 6, 22, 2, '#f59e0b');
  x.strokeStyle = '#ffffff'; x.lineWidth = 6.5; x.lineCap = 'round'; x.lineJoin = 'round';
  x.stroke(new Path2D('M17 10 v32 M17 26 L35 10 M22 22 L35 42'));
  const spaced = (t: string, X: number, Y: number, ls: number) => { let cx = X; for (const ch of t) { x.fillText(ch, cx, Y); cx += x.measureText(ch).width + ls; } };
  x.font = '900 25px Inter, Arial, sans-serif'; x.fillStyle = '#111827'; spaced('KRIS', 62, 28, -0.5);
  x.font = '600 11.5px Inter, Arial, sans-serif'; x.fillStyle = '#f59e0b'; spaced('TRAINER', 63, 45, 4.6);
  return cv.toDataURL('image/png');
}

const C = { green: '#1d6b55', grey: '#5b6a62', line: '#d9e0da', soft: '#e1efe9', amber: '#f59e0b' };
const layout = { hLineWidth: () => .5, vLineWidth: () => 0, hLineColor: () => C.line, paddingTop: () => 3, paddingBottom: () => 3 };
const head = () => ['Produkt', 'Ilość', 'Białko', 'Węgle', 'Tłuszcz', 'Kcal'].map((h, i) => ({ text: h, bold: true, fontSize: 7.5, color: C.grey, alignment: i ? 'right' : 'left' }));
const cells = (m: Macro4, bold = false) => [...[0, 1, 2].map(i => ({ text: fmt(m[i], bold ? 0 : 1), alignment: 'right', color: bold ? undefined : C.grey, bold })),
  { text: fmt(m[3]), alignment: 'right', color: bold ? undefined : C.grey, bold }];

function planSection(v: PlanVersion, D: Data) {
  const out: unknown[] = [];
  (['T', 'N'] as Day[]).forEach((day, di) => {
    const R = planDay(v, day, D);
    out.push({ text: DAY_NAME[day].toUpperCase(), bold: true, fontSize: 13, color: C.green, margin: [0, di ? 14 : 4, 0, 2], ...(di ? { pageBreak: 'before' } : {}) });
    out.push({ text: `Cel: ${fmt(R.T.kcal)} kcal · B ${fmt(R.T.g[0])} g · W ${fmt(R.T.g[1])} g · T ${fmt(R.T.g[2])} g     Plan: ${fmt(R.tot[3])} kcal · B ${fmt(R.tot[0])} g · W ${fmt(R.tot[1])} g · T ${fmt(R.tot[2])} g`, fontSize: 8.5, color: C.grey, margin: [0, 0, 0, 8] });
    const body: unknown[] = [head()];
    R.meals.forEach(M => {
      body.push([{ text: M.meal, bold: true, colSpan: 2, fillColor: C.soft }, {}, ...M.sum.map(x => ({ text: fmt(x), bold: true, alignment: 'right', fillColor: C.soft, fontSize: 8.5 }))]);
      M.rows.forEach((r: Row) => body.push([
        { stack: [{ text: r.prod }, ...(r.role === 'V' ? [{ text: VEG_NOTE, fontSize: 7, color: C.grey }] : [])] },
        { text: qtyTxt(r, D), bold: true, alignment: 'right' }, ...cells(r.m)]));
    });
    body.push([{ text: 'SUMA DNIA', bold: true, colSpan: 2 }, {}, ...cells(R.tot, true)]);
    out.push({ table: { headerRows: 1, widths: ['*', 60, 48, 48, 48, 48], body }, fontSize: 9.5, layout });
  });
  return out;
}

function menuSection(v: PlanVersion, D: Data) {
  const out: unknown[] = [
    { text: 'PRZYKŁADOWE POSIŁKI', bold: true, fontSize: 16, color: C.green, pageBreak: 'before', margin: [0, 0, 0, 4] },
    { text: 'Gotowe dania dopasowane do Twojego makro. Każda propozycja to cały dzień – wybierz jedną i trzymaj się gramatur.', fontSize: 9, color: C.grey, margin: [0, 0, 0, 6] },
    { ul: D.rules.principles, fontSize: 8.5, color: C.grey, margin: [0, 0, 0, 4] },
  ];
  (['T', 'N'] as Day[]).forEach(day => D.recipes.menus[day].forEach((menu, mi) => {
    const R = menuDay(v, day, mi, D), first = day === 'T' && mi === 0;
    out.push({ text: `${DAY_NAME[day]} · Propozycja ${menu.id}`, fontSize: 9, bold: true, color: C.amber, characterSpacing: .5, margin: [0, first ? 12 : 0, 0, 0], ...(first ? {} : { pageBreak: 'before' }) });
    out.push({ text: menu.name, bold: true, fontSize: 14, margin: [0, 0, 0, 2] });
    out.push({ text: `Suma dnia: ${fmt(R.tot[3])} kcal · B ${fmt(R.tot[0])} g · W ${fmt(R.tot[1])} g · T ${fmt(R.tot[2])} g   (cel: ${fmt(R.T.kcal)} kcal · B ${fmt(R.T.g[0])} · W ${fmt(R.T.g[1])} · T ${fmt(R.T.g[2])})`, fontSize: 8.5, color: C.grey, margin: [0, 0, 0, 8] });
    R.meals.forEach(M => {
      const r = M.recipe;
      const tags = [serveLabel(r, D), `${r.time} min`].concat(M.slot.periWorkout ? ['okołotreningowy'] : []).join(' · ');
      const ingr = { table: { headerRows: 1, widths: ['*', 40, 27, 27, 27, 28], body: [head(), ...M.rows.map(x => [{ text: x.prod }, { text: qtyTxt(x, D), bold: true, alignment: 'right' }, ...cells(x.m)]),
        [{ text: 'Razem', bold: true }, {}, ...cells(M.sum, true)]] }, fontSize: 8, layout };
      out.push({ unbreakable: true, margin: [0, 0, 0, 10], stack: [
        { columns: [{ text: `${M.slot.name.toUpperCase()} · ${M.slot.label.toUpperCase()}`, fontSize: 7.5, bold: true, color: C.green, characterSpacing: .4 },
          { text: tags, fontSize: 7.5, color: C.grey, alignment: 'right' }] },
        { text: r.name, bold: true, fontSize: 11.5, margin: [0, 1, 0, 4] },
        { columns: [{ width: '60%', stack: [ingr] },
          { width: '*', stack: [{ ol: r.steps, fontSize: 8.5, margin: [0, 0, 0, 3] }, ...(r.tip ? [{ text: [{ text: 'Wskazówka: ', bold: true }, r.tip], fontSize: 8, color: C.grey }] : [])] }], columnGap: 12 },
      ] });
    });
  }));
  return out;
}

/** Tworzy PDF planu osoby i pobiera go na dysk. */
export async function downloadPdf(person: Person, v: PlanVersion, D: Data) {
  const [pm, logo] = await Promise.all([pdfMake(), logoPng()]);
  const content: unknown[] = [
    { columns: [{ stack: [{ image: logo, width: 150 }, { text: 'Plan żywieniowy', fontSize: 10, color: C.grey, margin: [0, 4, 0, 0] }], width: 'auto' },
      { stack: [{ text: person.name || 'Bez nazwy', bold: true, fontSize: 13, alignment: 'right' },
        { text: `${person.sex === 'K' ? 'Kobieta' : 'Mężczyzna'} · wersja v${v.n} · ${new Date(v.createdAt).toLocaleDateString('pl-PL')}`, fontSize: 9, color: C.grey, alignment: 'right' }] }], margin: [0, 0, 0, 6] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: C.green }], margin: [0, 0, 0, 10] },
    { text: 'Wszystkie produkty ważone w stanie surowym, przed obróbką termiczną.', fontSize: 9, italics: true, color: C.grey, margin: [0, 0, 0, 10] },
  ];
  if (v.note) content.push({ text: 'Notatka: ' + v.note, fontSize: 9, color: C.grey, margin: [0, -6, 0, 10] });
  content.push(...planSection(v, D), ...menuSection(v, D));
  const docDef = { pageSize: 'A4', pageMargins: [40, 40, 40, 46], content, defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#18221d' },
    info: { title: `Plan żywieniowy – ${person.name} – v${v.n}`, author: 'Kris Trainer' },
    footer: (p: number, n: number) => ({ columns: [{ text: 'Kris Trainer', fontSize: 8, color: C.grey }, { text: `${p} / ${n}`, fontSize: 8, color: C.grey, alignment: 'right' }], margin: [40, 14, 40, 0] }) };
  const blob = await new Promise<Blob>(res => pm.createPdf(docDef).getBlob(res));
  const name = `Plan_${(person.name || 'osoba').trim().replace(/\s+/g, '_')}_v${v.n}.pdf`;
  saveFile(blob, name);
  return name;
}

export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
