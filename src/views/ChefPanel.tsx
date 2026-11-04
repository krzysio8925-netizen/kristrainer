import { useEffect, useId, useState, type FormEvent } from 'react';

import { DATA as D } from '../data';
import { EMPTY_PREFS, LOS, MAX_SHAKES, MIX, cuisineName, hasPrefs, menuThemes, termReport } from '../engine/kucharz';
import type { Day, Menu, MenuPrefs } from '../engine/types';

const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter(y => y !== x) : [...list, x]);
const same = (a: MenuPrefs, b: MenuPrefs) => JSON.stringify({ ...a, seed: 0 }) === JSON.stringify({ ...b, seed: 0 });
// Podpowiedzi: produkty i nazwy dań z bazy.
const SUGGEST = [...new Set([...D.products.map(p => p.name), ...Object.values(D.recipes.recipes).map(r => r.name)])].sort((a, b) => a.localeCompare(b, 'pl'));
const DIETS = D.chef.diets.map(id => D.chef.exclusions.find(e => e.id === id)!).filter(Boolean);
const OTHER_EX = D.chef.exclusions.filter(e => !D.chef.diets.includes(e.id));
const dania = (n: number) => (n === 1 ? 'danie' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'dania' : 'dań');

/** Lista „Lubi” / „Nie je”: wpis + Dodaj, a poniżej pozycje z informacją, czy zostały uwzględnione. */
function TermList({ title, hint, tone, items, applied, prefs, menus, disabled, onChange }: {
  title: string; hint: string; tone: 'like' | 'avoid'; items: string[]; applied: string[]; prefs: MenuPrefs; menus: Menu[]; disabled?: boolean; onChange: (x: string[]) => void;
}) {
  const [text, setText] = useState('');
  const id = useId();
  const add = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t && !items.some(x => x.toLowerCase() === t.toLowerCase())) onChange([...items, t]);
    setText('');
  };
  const report = termReport(items, menus, D, tone === 'like' ? prefs : undefined);
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{title}</label>
      <form className="term-add" onSubmit={add}>
        <input id={id} list={`${id}-l`} value={text} disabled={disabled} placeholder={hint} onChange={e => setText(e.target.value)} />
        <datalist id={`${id}-l`}>{SUGGEST.map(p => <option key={p} value={p} />)}</datalist>
        <button type="submit" className="btn" disabled={disabled || !text.trim()}>Dodaj</button>
      </form>
      {items.length > 0 && (
        <ul className={`terms ${tone}`}>
          {report.map(({ term, inBase, inAllowed, inMenus }) => {
            const pending = !applied.includes(term);
            let status: string, kind: 'ok' | 'warn' | 'wait';
            if (!inBase) { status = 'brak w bazie przepisów – nie wpłynie na propozycje'; kind = 'warn'; }
            else if (pending) { status = `${inBase} ${dania(inBase)} w bazie · kliknij „Przelicz propozycje”`; kind = 'wait'; }
            else if (tone === 'avoid') { status = `wykluczono ${inBase} ${dania(inBase)}`; kind = 'ok'; }
            else if (inMenus.length) { status = `uwzględnione w propozycji ${inMenus.join(', ')}`; kind = 'ok'; }
            else if (!inAllowed) { status = `${inBase} ${dania(inBase)} w bazie, ale odpada przez dietę, wykluczenia lub „Nie je”`; kind = 'warn'; }
            else { status = `${inAllowed} ${dania(inAllowed)} pasuje, ale nie na posiłki tego dnia przy wybranych kuchniach / ekspresie`; kind = 'warn'; }
            return (
              <li key={term} className={kind}>
                <span className="t-mark" aria-hidden="true">{kind === 'ok' ? '✓' : kind === 'wait' ? '•' : '!'}</span>
                <span className="t-body"><b>{term}</b><small>{status}</small></span>
                <button type="button" className="t-del" disabled={disabled} aria-label={`Usuń: ${term}`} onClick={() => onChange(items.filter(x => x !== term))}>×</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Preferencje kucharza. Zmiany to szkic – stosuje je dopiero „Przelicz propozycje”. */
export function ChefPanel({ prefs, menus, day, dayName, disabled, onApply }: {
  prefs: MenuPrefs; menus: Menu[]; day: Day; dayName: string; disabled?: boolean; onApply: (p: MenuPrefs) => void;
}) {
  const [draft, setDraft] = useState(prefs);
  const appliedKey = JSON.stringify(prefs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(prefs); }, [appliedKey]);
  const dirty = !same(draft, prefs);
  const set = (patch: Partial<MenuPrefs>) => setDraft(d => ({ ...d, ...patch }));
  const diet = DIETS.find(d => draft.exclude.includes(d.id))?.id ?? '';
  const setDiet = (id: string) => set({ exclude: [...draft.exclude.filter(x => !D.chef.diets.includes(x)), ...(id ? [id] : [])] });
  const themes = menuThemes(draft, D);
  const setPick = (i: number, pick: string) => set({ menuCuisines: draft.menuCuisines.map((c, j) => (j === i ? pick : c)) });
  // „Losuj” od razu losuje nową kuchnię tej propozycji i przelicza (razem z resztą szkicu).
  const roll = (i: number) => onApply({ ...draft, rolls: draft.rolls.map((r, j) => (j === i ? r + 1 : r)) });
  const slots = D.rules.days[day].slots, shakes = draft.shakes[day];
  const toggleShake = (id: string) => set({ shakes: { ...draft.shakes, [day]: shakes.includes(id) ? shakes.filter(x => x !== id) : [...shakes, id].slice(-MAX_SHAKES) } });

  return (
    <section className="chef" aria-labelledby="chef-h">
      <div className="chef-head">
        <div>
          <h2 id="chef-h">Kucharz</h2>
          <p className="hint">Ustaw dietę, kuchnie i gusta, potem kliknij „Przelicz propozycje” – kucharz ułoży 3 propozycje dnia z gramaturami pod makro.</p>
        </div>
        <div className="chef-actions">
          <button type="button" className="btn" disabled={disabled} onClick={() => onApply({ ...draft, seed: prefs.seed + 1 })} title="Inne propozycje przy tych samych ustawieniach">
            <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M3 6h3.5c2 0 3 1 4.2 3l.6 1c1.2 2 2.2 3 4.2 3H17m0 0-2.5-2.5M17 13l-2.5 2.5M3 14h3.5c1 0 1.7-.3 2.3-.8M17 6h-1.5c-1 0-1.7.3-2.3.8M17 6l-2.5-2.5M17 6l-2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Wymieszaj</button>
          {hasPrefs(draft) && <button type="button" className="linkbtn" disabled={disabled} onClick={() => setDraft({ ...EMPTY_PREFS, seed: prefs.seed, rolls: prefs.rolls })}>Wyczyść</button>}
        </div>
      </div>

      <div className="field">
        <span className="label" id="lbl-diet">Dieta</span>
        <div className="seg diet" role="group" aria-labelledby="lbl-diet">
          <button type="button" aria-pressed={!diet} disabled={disabled} onClick={() => setDiet('')}>Bez ograniczeń</button>
          {DIETS.map(d => <button key={d.id} type="button" aria-pressed={diet === d.id} disabled={disabled} onClick={() => setDiet(d.id)}>{d.label}</button>)}
        </div>
      </div>

      <div className="field">
        <span className="label">Kuchnia każdej propozycji <em>losowa, miks albo konkretna kuchnia</em></span>
        <div className="menu-cuisines">
          {themes.map((t, i) => (
            <div key={i} className="mc">
              <label className="mc-label" htmlFor={`mc-${i}`}>Propozycja {'ABC'[i]}</label>
              <select id={`mc-${i}`} value={draft.menuCuisines[i]} disabled={disabled} onChange={e => setPick(i, e.target.value)}>
                <option value={LOS}>Losowa kuchnia</option>
                <option value={MIX}>Miks kuchni</option>
                {D.chef.cuisines.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {t.pick === LOS && (
                <div className="mc-roll">
                  <span>wylosowano: <b>{cuisineName(D, t.theme!)}</b></span>
                  <button type="button" className="btn" disabled={disabled} onClick={() => roll(i)} title="Wylosuj inną kuchnię dla tej propozycji">
                    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="7.3" cy="7.3" r="1.3" fill="currentColor" /><circle cx="12.7" cy="12.7" r="1.3" fill="currentColor" /><circle cx="10" cy="10" r="1.3" fill="currentColor" /></svg>
                    Losuj</button>
                </div>)}
              {t.pick === MIX && <div className="mc-roll"><span>dania z dowolnych kuchni, najlepiej trafiające w makro</span></div>}
            </div>))}
        </div>
        <button type="button" className="cuisine express" aria-pressed={draft.express} disabled={disabled} onClick={() => set({ express: !draft.express })}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M9.2 1.5 3.5 9h4l-1 5.5L12.5 7h-4l.7-5.5Z" fill="currentColor" /></svg>
          <span>Ekspres<small>maks. oszczędność czasu · dania do {D.chef.expressMaxMin} min we wszystkich propozycjach</small></span></button>
      </div>

      <div className="field">
        <span className="label" id="lbl-shake">Szejk zamiast posiłku <em>{dayName.toLowerCase()} · maks. {MAX_SHAKES}</em></span>
        <div className="exclusions shakes" role="group" aria-labelledby="lbl-shake">
          {slots.map(sl => {
            const on = shakes.includes(sl.id);
            return <button key={sl.id} type="button" className="xchip shake" aria-pressed={on} disabled={disabled || (!on && shakes.length >= MAX_SHAKES)}
              onClick={() => toggleShake(sl.id)}>{sl.name} · {sl.label}</button>;
          })}
        </div>
        <p className="hint">Kucharz wstawi szejk dopasowany do makro tego posiłku – w każdej propozycji inny. Drugi dzień ustawisz po przełączeniu „Pokaż dzień”.</p>
      </div>

      <div className="field">
        <span className="label" id="lbl-ex">Wykluczenia</span>
        <div className="exclusions" role="group" aria-labelledby="lbl-ex">
          {OTHER_EX.map(e => (
            <button key={e.id} type="button" className="xchip" aria-pressed={draft.exclude.includes(e.id)} disabled={disabled}
              onClick={() => set({ exclude: toggle(draft.exclude, e.id) })}>{e.label}</button>))}
        </div>
      </div>

      <div className="chef-lists">
        <TermList title="Lubi" hint="produkt lub danie, np. łosoś, curry, makaron" tone="like" items={draft.like} applied={prefs.like} prefs={prefs} menus={menus} disabled={disabled} onChange={like => set({ like })} />
        <TermList title="Nie je" hint="np. pieczarki, batat, grzyby" tone="avoid" items={draft.avoid} applied={prefs.avoid} prefs={prefs} menus={menus} disabled={disabled} onChange={avoid => set({ avoid })} />
      </div>

      <div className={`chef-apply${dirty ? ' dirty' : ''}`}>
        <span className="hint">{dirty ? 'Masz zmiany, których jeszcze nie uwzględniono w propozycjach.' : `Propozycje są aktualne (${dayName.toLowerCase()}).`}</span>
        <button type="button" className="btn primary" disabled={disabled || !dirty} onClick={() => onApply(draft)}>Przelicz propozycje</button>
      </div>
    </section>
  );
}
