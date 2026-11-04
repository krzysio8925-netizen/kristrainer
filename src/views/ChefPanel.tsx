import { useId, useState, type KeyboardEvent } from 'react';

import { DATA as D } from '../data';
import { hasPrefs } from '../engine/kucharz';
import type { MenuPrefs } from '../engine/types';

const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter(y => y !== x) : [...list, x]);
const PRODUCTS = D.products.map(p => p.name).sort((a, b) => a.localeCompare(b, 'pl'));

/** Lista produktów (lubi / nie je): chipy + pole z podpowiedziami. */
function ProductPicker({ label, hint, items, tone, disabled, onChange }: {
  label: string; hint: string; items: string[]; tone: 'like' | 'avoid'; disabled?: boolean; onChange: (x: string[]) => void;
}) {
  const [text, setText] = useState('');
  const id = useId(), listId = `${id}-list`;
  const add = (name: string) => { if (!items.includes(name)) onChange([...items, name]); setText(''); };
  const pick = (val: string) => {
    const q = val.trim().toLowerCase();
    if (!q) return;
    const hit = PRODUCTS.find(p => p.toLowerCase() === q) ?? PRODUCTS.find(p => p.toLowerCase().startsWith(q)) ?? PRODUCTS.find(p => p.toLowerCase().includes(q));
    if (hit) add(hit);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); pick(text); } };
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <div className={`picker ${tone}`}>
        {items.map(x => (
          <button key={x} type="button" className="pchip" disabled={disabled} onClick={() => onChange(items.filter(y => y !== x))} aria-label={`Usuń: ${x}`}>
            {x}<span aria-hidden="true">×</span></button>))}
        <input id={id} list={listId} value={text} disabled={disabled} placeholder={items.length ? 'dodaj…' : hint}
          onChange={e => { const val = e.target.value; if (PRODUCTS.includes(val)) add(val); else setText(val); }} onKeyDown={onKey} />
        <datalist id={listId}>{PRODUCTS.filter(p => !items.includes(p)).map(p => <option key={p} value={p} />)}</datalist>
      </div>
    </div>
  );
}

/** Preferencje kucharza: kuchnie, tryb ekspres, wykluczenia, lubiane i pomijane produkty. */
export function ChefPanel({ prefs, disabled, onChange }: { prefs: MenuPrefs; disabled?: boolean; onChange: (p: MenuPrefs) => void }) {
  const set = (patch: Partial<MenuPrefs>) => onChange({ ...prefs, ...patch });
  return (
    <section className="chef" aria-labelledby="chef-h">
      <div className="chef-head">
        <div>
          <h2 id="chef-h">Kucharz</h2>
          <p className="hint">Wybierz kuchnie i ograniczenia – kucharz ułoży 3 propozycje dnia z gramaturami dopasowanymi do makro.</p>
        </div>
        <div className="chef-actions">
          <button type="button" className="btn" disabled={disabled} onClick={() => set({ seed: prefs.seed + 1 })} title="Inne propozycje przy tych samych ustawieniach">
            <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M3 6h3.5c2 0 3 1 4.2 3l.6 1c1.2 2 2.2 3 4.2 3H17m0 0-2.5-2.5M17 13l-2.5 2.5M3 14h3.5c1 0 1.7-.3 2.3-.8M17 6h-1.5c-1 0-1.7.3-2.3.8M17 6l-2.5-2.5M17 6l-2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Wymieszaj</button>
          {hasPrefs(prefs) && <button type="button" className="linkbtn" disabled={disabled} onClick={() => onChange({ cuisines: [], express: false, exclude: [], avoid: [], like: [], seed: prefs.seed })}>Wyczyść</button>}
        </div>
      </div>

      <div className="field">
        <span className="label" id="lbl-cuisine">Kuchnie <em>{prefs.cuisines.length ? `wybrane: ${prefs.cuisines.length}` : 'dowolne – zaznacz, by zawęzić'}</em></span>
        <div className="cuisines" role="group" aria-labelledby="lbl-cuisine">
          {D.chef.cuisines.map(c => (
            <button key={c.id} type="button" className="cuisine" aria-pressed={prefs.cuisines.includes(c.id)} disabled={disabled}
              onClick={() => set({ cuisines: toggle(prefs.cuisines, c.id) })}>{c.name}</button>))}
          <button type="button" className="cuisine express" aria-pressed={prefs.express} disabled={disabled} onClick={() => set({ express: !prefs.express })}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M9.2 1.5 3.5 9h4l-1 5.5L12.5 7h-4l.7-5.5Z" fill="currentColor" /></svg>
            <span>Ekspres<small>maks. oszczędność czasu · do {D.chef.expressMaxMin} min</small></span></button>
        </div>
      </div>

      <div className="field">
        <span className="label" id="lbl-ex">Wykluczenia</span>
        <div className="exclusions" role="group" aria-labelledby="lbl-ex">
          {D.chef.exclusions.map(e => (
            <button key={e.id} type="button" className="xchip" aria-pressed={prefs.exclude.includes(e.id)} disabled={disabled}
              onClick={() => set({ exclude: toggle(prefs.exclude, e.id) })}>{e.label}</button>))}
        </div>
      </div>

      <div className="chef-lists">
        <ProductPicker label="Nie je" hint="np. Pieczarki, Batat…" tone="avoid" items={prefs.avoid} disabled={disabled} onChange={avoid => set({ avoid })} />
        <ProductPicker label="Lubi" hint="np. Łosoś, Mango…" tone="like" items={prefs.like} disabled={disabled} onChange={like => set({ like })} />
      </div>
    </section>
  );
}
