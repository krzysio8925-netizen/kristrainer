import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import {
  deletePerson, errText, exportBackup, importBackup, listenPersons, loadVersions, savePerson, saveVersion, type Backup, type StoredVersion,
} from '../backend/store';
import { DATA as D } from '../data';
import { normPrefs, planMenus, prefsSummary } from '../engine/kucharz';
import { menuDay, planDay, targets } from '../engine/silnik';
import type { Day, Macro4, Person, PlanVersion, Target } from '../engine/types';
import { DAY_NAME, GROUP_COLOR, GROUP_NAME, VEG_NOTE, fmt, qtyTxt, serveLabel } from '../format';
import { downloadPdf, saveFile } from '../pdf';
import { ChefPanel } from './ChefPanel';
import { Logo } from './Logo';
import { BRANDS, BRAND_IDS, isBrandId, type BrandId } from '../brand';

const LS = 'kris-kalkulator';
const lsGet = (k: string) => { try { return localStorage.getItem(`${LS}-${k}`); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(`${LS}-${k}`, v); } catch { /* bez pamięci */ } };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const byCreated = (a: { createdAt: string }, b: { createdAt: string }) => (a.createdAt || '').localeCompare(b.createdAt || '');

function newVersion(n: number): PlanVersion {
  const t = D.template;
  return { n, createdAt: new Date().toISOString(), note: n === 1 ? 'Plan bazowy' : '', mode: 'kcal', kcal: { ...t.planKcal }, nAuto: true,
    split: { T: { ...t.planSplit.T }, N: { ...t.planSplit.N } }, swaps: {}, removed: { T: [], N: [] } };
}
function normalize(v: StoredVersion): StoredVersion {
  const t = D.template;
  return { ...v, mode: v.mode || 'kcal', kcal: { ...t.planKcal, ...(v.kcal || {}) },
    split: { T: { ...t.planSplit.T, ...(v.split?.T || {}) }, N: { ...t.planSplit.N, ...(v.split?.N || {}) } },
    swaps: { ...(v.swaps || {}) }, removed: { T: [...(v.removed?.T || [])], N: [...(v.removed?.N || [])] } };
}

/** Pole liczbowe, które pozwala spokojnie pisać i zapisuje tylko poprawne wartości. */
function NumField({ value, onCommit, min, max, disabled, label, className, onFocus }: {
  value: number; onCommit: (v: number) => void; min: number; max: number; disabled?: boolean; label: string; className?: string; onFocus?: () => void;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(String(value)); }, [value]);
  return <input className={className} type="number" inputMode="numeric" aria-label={label} min={min} max={max} disabled={disabled} value={text}
    onFocus={() => { focused.current = true; onFocus?.(); }}
    onBlur={() => { focused.current = false; setText(String(value)); }}
    onChange={e => { setText(e.target.value); const x = parseFloat(e.target.value); if (x >= min && x <= max) onCommit(x); }} />;
}

/** Pole tekstowe z lokalnym szkicem (żeby odświeżenia z bazy nie przerywały pisania). */
function TextField({ value, onCommit, disabled, id, placeholder, className }: {
  value: string; onCommit: (v: string) => void; disabled?: boolean; id: string; placeholder?: string; className?: string;
}) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value); }, [value]);
  return <input id={id} className={className} type="text" autoComplete="off" placeholder={placeholder} disabled={disabled} value={text}
    onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }}
    onChange={e => { setText(e.target.value); onCommit(e.target.value); }} />;
}

function Summary({ T, tot }: { T: Target; tot: Macro4 }) {
  const labels: [string, 'P' | 'C' | 'F' | null][] = [['Kcal', null], ['Białko', 'P'], ['Węglowodany', 'C'], ['Tłuszcz', 'F']];
  const tg = [T.kcal, ...T.g], plan = [tot[3], tot[0], tot[1], tot[2]];
  return (
    <section className="summary" aria-label="Podsumowanie dnia">
      {labels.map(([n, g], i) => {
        const diff = plan[i] - tg[i], tol = i === 0 ? Math.max(40, tg[i] * 0.03) : Math.max(5, tg[i] * 0.06);
        return (
          <div className="stat" key={n}>
            <span className="k">{g && <span className="dot" style={{ background: GROUP_COLOR[g] }} />}{n}</span>
            <span className="v">{fmt(plan[i])}<span style={{ fontSize: '.8rem', color: 'var(--muted)' }}> {i ? 'g' : 'kcal'}</span></span>
            <span className="t">cel {fmt(tg[i])}{i ? ` · ${fmt(T.pct[i - 1], 1)}%` : ''} · <span className={Math.abs(diff) <= tol ? 'ok' : 'off'}>{diff >= 0 ? '+' : '−'}{fmt(Math.abs(diff))}</span></span>
            <span className="meter" aria-hidden="true"><i style={{ width: `${Math.min(100, tg[i] ? (plan[i] / tg[i]) * 100 : 0)}%`, ...(g ? { background: GROUP_COLOR[g] } : {}) }} /></span>
          </div>
        );
      })}
    </section>
  );
}

export function Calculator({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [persons, setPersons] = useState<Person[] | null>(null);
  const [vers, setVers] = useState<Record<string, StoredVersion[]>>({});
  const [cid, setCid] = useState<string | null>(null);
  const [vid, setVid] = useState<string | null>(null);
  const [day, setDay] = useState<Day>('T');
  const [view, setViewState] = useState<'plan' | 'menu'>(lsGet('view') === 'menu' ? 'menu' : 'plan');
  const [menuIdx, setMenuIdx] = useState<Record<Day, number>>({ T: 0, N: 0 });
  const [confirmDel, setConfirmDel] = useState(false);
  const [status, setStatus] = useState('Ładowanie…');
  const [genInfo, setGenInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [brand, setBrandState] = useState<BrandId>(() => { const b = lsGet('brand'); return isBrandId(b) ? b : 'kris'; });
  const setBrand = (b: BrandId) => { setBrandState(b); lsSet('brand', b); setGenInfo(''); };
  const fileRef = useRef<HTMLInputElement>(null);

  // ── osoby (na żywo z bazy) ──
  useEffect(() => listenPersons(p => { setPersons(p); setStatus(s => (s === 'Ładowanie…' ? 'Połączono z bazą' : s)); },
    e => setStatus('Brak dostępu do bazy: ' + errText(e))), []);
  useEffect(() => {
    if (!persons || (cid && persons.some(p => p.id === cid))) return;
    const last = lsGet('last'), first = persons.find(p => p.id === last) ?? persons.slice().sort(byCreated)[0];
    setCid(first?.id ?? null);
  }, [persons, cid]);

  // ── wersje wybranej osoby ──
  useEffect(() => {
    if (!cid || vers[cid]) return;
    let alive = true;
    loadVersions(cid).then(async list => {
      let vs = list.map(normalize);
      if (!vs.length) { const v = { id: 'v1', ...newVersion(1) }; vs = [v]; await saveVersion(cid, v); }
      if (alive) setVers(m => ({ ...m, [cid]: vs }));
    }).catch(e => setStatus('Nie udało się wczytać wersji: ' + errText(e)));
    return () => { alive = false; };
  }, [cid, vers]);
  const versions = useMemo(() => (cid && vers[cid] ? vers[cid].slice().sort((a, b) => a.n - b.n) : []), [cid, vers]);
  useEffect(() => { if (versions.length && !versions.some(v => v.id === vid)) setVid(versions[versions.length - 1].id); }, [versions, vid]);

  const person = persons?.find(p => p.id === cid) ?? null;
  const v = versions.find(x => x.id === vid) ?? null;
  const ro = !!v && versions[versions.length - 1]?.id !== v.id;
  // Propozycje kucharza (liczone tylko w zakładce posiłków; zmieniają się z wersją, dniem i preferencjami).
  const menus = useMemo(() => (v && view === 'menu' ? planMenus(v, day, D) : []), [v, day, view]);

  // ── zapis: z opóźnieniem, ten sam dokument nigdy równolegle ──
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Map<string, Promise<unknown>>());
  const queue = useCallback((key: string, fn: () => Promise<unknown>) => {
    clearTimeout(pending.current.get(key)); setStatus('Zapisywanie…');
    pending.current.set(key, setTimeout(() => {
      pending.current.delete(key);
      const run = (inflight.current.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
      inflight.current.set(key, run);
      const done = () => { if (inflight.current.get(key) === run) inflight.current.delete(key); };
      run.then(() => { done(); if (!pending.current.size && !inflight.current.size) setStatus('Zapisano'); },
        e => { done(); setStatus('Nie zapisano: ' + errText(e) + '. Zmień coś jeszcze raz, żeby ponowić.'); });
    }, 600));
  }, []);

  const updateVersion = (fn: (x: StoredVersion) => void) => {
    if (!cid || !v || ro) return;
    const next = structuredClone(v); fn(next);
    setVers(m => ({ ...m, [cid]: m[cid].map(x => (x.id === next.id ? next : x)) }));
    queue(`v:${cid}:${next.id}`, () => saveVersion(cid, next));
  };
  const updatePerson = (patch: Partial<Person>) => {
    if (!person) return;
    const next = { ...person, ...patch };
    setPersons(ps => ps!.map(p => (p.id === next.id ? next : p)));
    queue(`p:${next.id}`, () => savePerson(next));
  };
  const selectPerson = (id: string) => { setCid(id); setVid(null); setConfirmDel(false); lsSet('last', id); };
  const setView = (x: 'plan' | 'menu') => { setViewState(x); lsSet('view', x); };

  const addPerson = async () => {
    const p: Person = { id: uid(), name: 'Nowa osoba', sex: 'M', createdAt: new Date().toISOString() };
    const v1 = { id: 'v1', ...newVersion(1) };
    setVers(m => ({ ...m, [p.id]: [v1] })); setPersons(ps => [...(ps ?? []), p]); selectPerson(p.id);
    try { await Promise.all([savePerson(p), saveVersion(p.id, v1)]); } catch (e) { setStatus('Nie zapisano nowej osoby: ' + errText(e)); }
  };
  const newVersionFromThis = async () => {
    if (!cid || !v) return;
    const n = versions[versions.length - 1].n + 1;
    const nv: StoredVersion = { ...structuredClone(v), id: `v${n}`, n, createdAt: new Date().toISOString(), note: '' };
    setVers(m => ({ ...m, [cid]: [...m[cid], nv] })); setVid(nv.id);
    try { await saveVersion(cid, nv); setStatus(`Utworzono v${n} na podstawie v${v.n}`); } catch (e) { setStatus('Nie zapisano nowej wersji: ' + errText(e)); }
  };
  const removePerson = async () => {
    if (!person) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    const id = person.id, vids = versions.map(x => x.id);
    setConfirmDel(false); setCid(null); setPersons(ps => ps!.filter(p => p.id !== id));
    try { await deletePerson(id, vids); setStatus('Usunięto osobę'); } catch (e) { setStatus('Nie udało się usunąć osoby: ' + errText(e)); }
  };

  const generate = async () => {
    if (!person || !v) return;
    setBusy(true); setGenInfo('');
    try { setGenInfo(`Zapisano ${await downloadPdf(person, v, D, brand)}.`); }
    catch (e) { setGenInfo('Nie udało się utworzyć PDF: ' + errText(e)); }
    finally { setBusy(false); }
  };
  const doExport = async () => {
    try { const b = await exportBackup(); saveFile(new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' }), `kris-trainer-kopia-${new Date().toISOString().slice(0, 10)}.json`); setStatus('Pobrano kopię danych'); }
    catch (e) { setStatus('Nie udało się zrobić kopii: ' + errText(e)); }
  };
  const doImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { const n = await importBackup(JSON.parse(await f.text()) as Backup); setVers({}); setStatus(`Zaimportowano osoby: ${n}`); }
    catch (err) { setStatus('Nie udało się zaimportować: ' + errText(err)); }
  };

  // ── render ──
  const header = (
    <header>
      <div className="brand"><Logo /><h1>Kalkulator doboru diety</h1></div>
      <div className="account">
        <span className="status">{status}</span>
        <span className="who">{email}</span>
        <button className="linkbtn" onClick={onLogout}>Wyloguj</button>
      </div>
    </header>
  );
  const tabs = (
    <nav className="tabs" role="tablist" aria-label="Osoby">
      {(persons ?? []).slice().sort(byCreated).map(p => (
        <button key={p.id} type="button" className="tab" role="tab" aria-selected={p.id === cid} onClick={() => p.id !== cid && selectPerson(p.id)}>{p.name || 'Bez nazwy'}</button>
      ))}
      <button type="button" className="tab add" onClick={addPerson}>+ Nowa osoba</button>
    </nav>
  );
  const backupBox = (
    <section className="notes import">
      <h2>Kopia danych</h2>
      <p className="hint">Pobierz kopię wszystkich osób i wersji albo wczytaj plik kopii (także plik z poprzedniego kalkulatora na claude.ai).</p>
      <div className="row-between" style={{ justifyContent: 'flex-start' }}>
        <button className="btn" onClick={doExport}>Pobierz kopię</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>Wczytaj kopię…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
      </div>
    </section>
  );

  if (persons && !persons.length) {
    return (
      <div className="wrap">{header}{tabs}
        <div className="empty"><strong style={{ fontFamily: 'var(--display)', fontSize: '1.2rem' }}>Brak osób</strong>
          <p className="hint">Dodaj pierwszą osobę albo wczytaj kopię danych z poprzedniego kalkulatora.</p>
          <button type="button" className="btn primary" onClick={addPerson}>Dodaj osobę</button></div>
        {backupBox}
      </div>
    );
  }
  if (!person || !v) return <div className="wrap">{header}{tabs}<p className="hint">Ładowanie…</p></div>;

  const mm = v.mode === 'macro';
  const sp = v.split[day], cp = 100 - sp.p - sp.f, ps = D.template.planSplit[day];
  const plan = view === 'plan' ? planDay(v, day, D) : null;
  const mIdx = Math.max(0, Math.min(menuIdx[day], menus.length - 1));
  const menu = view === 'menu' && menus.length ? menuDay(v, day, menus[mIdx], D) : null;
  const prefs = normPrefs(v.prefs);
  const cuisineName = (id: string) => D.chef.cuisines.find(c => c.id === id)?.name ?? id;
  const removed = [...(v.removed[day] ?? [])].sort((a, b) => a - b);
  const tmpl = D.template.days[day];

  const setKcal = (d: Day, val: number) => updateVersion(x => { x.kcal[d] = val; if (d === 'T' && x.nAuto) x.kcal.N = Math.round(val * D.template.restDayRatio / 10) * 10; });
  const toMacro = () => updateVersion(x => {
    if (x.mode === 'macro') return;
    x.macro = { T: { p: 0, c: 0, f: 0 }, N: { p: 0, c: 0, f: 0 } };
    (['T', 'N'] as Day[]).forEach(d => { const t = targets(v, d); x.macro![d] = { p: Math.round(t.g[0]), c: Math.round(t.g[1]), f: Math.round(t.g[2]) }; });
    x.mode = 'macro';
  });
  const toKcal = () => updateVersion(x => {
    if (x.mode !== 'macro') return;
    const r5 = (n: number) => Math.round(n * 2) / 2;
    (['T', 'N'] as Day[]).forEach(d => { const t = targets(v, d); x.kcal[d] = Math.round(t.kcal); x.split[d] = { p: r5(t.pct[0]), f: r5(t.pct[2]) }; });
    x.nAuto = false; x.mode = 'kcal';
  });

  return (
    <div className="wrap">
      {header}{tabs}
      <section className="personbar" aria-label="Osoba i wersja planu">
        <div className="field"><label className="label" htmlFor="pname">Imię i nazwisko</label>
          <TextField id="pname" value={person.name} onCommit={name => updatePerson({ name })} /></div>
        <div className="field"><span className="label" id="lbl-sex">Płeć</span>
          <div className="seg" role="group" aria-labelledby="lbl-sex" style={{ minWidth: 220 }}>
            <button type="button" aria-pressed={person.sex === 'M'} onClick={() => updatePerson({ sex: 'M' })}>Mężczyzna</button>
            <button type="button" aria-pressed={person.sex === 'K'} onClick={() => updatePerson({ sex: 'K' })}>Kobieta</button>
          </div></div>
        <div className="field" style={{ flex: '1 1 260px' }}><span className="label">Wersje planu</span>
          <div className="versions">{versions.map(x => (
            <button key={x.id} type="button" className="vchip" aria-pressed={x.id === v.id} title={x.note} onClick={() => { setVid(x.id); setConfirmDel(false); }}>
              v{x.n} · {new Date(x.createdAt).toLocaleDateString('pl-PL')}</button>))}</div></div>
        <div className="field"><label className="label" htmlFor="vnote">Powód zmiany / notatka</label>
          <TextField id="vnote" value={v.note} disabled={ro} placeholder="np. −200 kcal, wyrzucony posiłek 4" onCommit={note => updateVersion(x => { x.note = note; })} /></div>
        <div className="field" style={{ gridAutoFlow: 'column', alignItems: 'end' }}>
          <button type="button" className="btn" onClick={newVersionFromThis}>Nowa wersja z tej</button>
          <button type="button" className="btn danger" onClick={removePerson}>{confirmDel ? 'Kliknij ponownie, aby usunąć' : 'Usuń osobę'}</button>
        </div>
      </section>
      {ro && <div className="banner">Wersja archiwalna v{v.n}. Żeby wprowadzić zmiany, kliknij „Nowa wersja z tej”, a powstanie v{versions[versions.length - 1].n + 1} na jej podstawie.</div>}

      <div className="layout">
        <aside className="panel" aria-label="Dane wejściowe">
          <div className="field">
            <span className="label" id="lbl-mode">Zapotrzebowanie</span>
            <div className="seg" role="group" aria-labelledby="lbl-mode">
              <button type="button" aria-pressed={!mm} disabled={ro} onClick={toKcal}>Kcal</button>
              <button type="button" aria-pressed={mm} disabled={ro} onClick={toMacro}>Makro</button>
            </div>
            {mm && v.macro ? (
              <div className="field">
                <div className="macro-grid">
                  <span /><span className="mh">Białko</span><span className="mh">Węgle</span><span className="mh">Tłuszcz</span>
                  {(['T', 'N'] as Day[]).map(d => [
                    <span key={d} className={`md${d === day ? ' active' : ''}`}>{d === 'T' ? 'Trening.' : 'Nietren.'}</span>,
                    ...(['p', 'c', 'f'] as const).map(k => (
                      <NumField key={d + k} label={`${k === 'p' ? 'Białko' : k === 'c' ? 'Węglowodany' : 'Tłuszcz'}, ${DAY_NAME[d].toLowerCase()} (g)`} min={0} max={k === 'c' ? 1500 : 800}
                        value={v.macro![d][k]} disabled={ro} onFocus={() => setDay(d)} onCommit={n => updateVersion(x => { x.macro![d][k] = n; })} />)),
                  ])}
                </div>
                <p className="hint">{(['T', 'N'] as Day[]).map(d => { const t = targets(v, d); return (
                  <span key={d}>{d === 'T' ? 'Treningowy' : 'Nietreningowy'}: <b>{fmt(t.kcal)} kcal</b> (B {fmt(t.pct[0])}% · W {fmt(t.pct[1])}% · T {fmt(t.pct[2])}%)<br /></span>); })}
                  Gramy rozkładają się na posiłki według proporcji z bieżącego planu.</p>
              </div>
            ) : (
              <div className="field">
                <div className="kcal-grid">
                  {(['T', 'N'] as Day[]).map(d => (
                    <label key={d} className={`kcal-box${d === day ? ' active' : ''}`}><span>{DAY_NAME[d]}</span>
                      <NumField label={`Kalorie, ${DAY_NAME[d].toLowerCase()}`} min={800} max={8000} value={v.kcal[d]} disabled={ro || (d === 'N' && v.nAuto)}
                        onFocus={() => setDay(d)} onCommit={n => setKcal(d, n)} /></label>))}
                </div>
                <label className="check"><input type="checkbox" checked={v.nAuto} disabled={ro}
                  onChange={e => updateVersion(x => { x.nAuto = e.target.checked; if (x.nAuto) x.kcal.N = Math.round(x.kcal.T * D.template.restDayRatio / 10) * 10; })} /> Nietreningowy = treningowy × 96,4% (jak w planie)</label>
              </div>
            )}
          </div>

          <div className="field">
            <span className="label" id="lbl-day">Pokaż dzień</span>
            <div className="seg" role="group" aria-labelledby="lbl-day">
              <button type="button" aria-pressed={day === 'T'} onClick={() => setDay('T')}>Treningowy</button>
              <button type="button" aria-pressed={day === 'N'} onClick={() => setDay('N')}>Nietreningowy</button>
            </div>
          </div>

          {!mm && (
            <div className="field">
              <span className="label">Podział makro – {DAY_NAME[day].toLowerCase()}</span>
              <div className="split">
                <div className="split-row"><label htmlFor="pp">Białko</label><input id="pp" type="range" min={10} max={45} step={0.5} value={sp.p} disabled={ro}
                  onChange={e => updateVersion(x => { const s = x.split[day]; s.p = +e.target.value; if (s.p + s.f > 85) s.f = 85 - s.p; })} /><output>{fmt(sp.p, 1)}%</output></div>
                <div className="split-row"><label htmlFor="fp">Tłuszcz</label><input id="fp" type="range" min={5} max={45} step={0.5} value={sp.f} disabled={ro}
                  onChange={e => updateVersion(x => { const s = x.split[day]; s.f = +e.target.value; if (s.p + s.f > 85) s.p = 85 - s.f; })} /><output>{fmt(sp.f, 1)}%</output></div>
                <div className="split-row"><span>Węglowodany</span><span className="ratio-bar" aria-hidden="true">
                  <span style={{ width: `${sp.p}%`, background: 'var(--p)' }} /><span style={{ width: `${cp}%`, background: 'var(--c)' }} /><span style={{ width: `${sp.f}%`, background: 'var(--f)' }} /></span>
                  <output>{fmt(cp, 1)}%</output></div>
              </div>
              <p className="hint">Proporcje z planu: białko {fmt(ps.p, 1)}%, tłuszcz {fmt(ps.f, 1)}%, węglowodany {fmt(100 - ps.p - ps.f, 1)}%. Te same dla kobiet i mężczyzn.</p>
              <button type="button" className="btn" disabled={ro} onClick={() => updateVersion(x => { x.split[day] = { ...ps }; })}>Przywróć proporcje z planu</button>
            </div>
          )}

          {view === 'plan' && (
            <div className="field">
              <span className="label">Zamienniki</span>
              <p className="hint">Kliknij nazwę produktu, żeby wybrać zamiennik z tej samej grupy. Gramatura przelicza się po głównym makro.</p>
              <button type="button" className="btn" disabled={ro} onClick={() => updateVersion(x => { Object.keys(x.swaps).forEach(k => { if (k.startsWith(day + '|')) delete x.swaps[k]; }); })}>Cofnij zamiany w tym dniu</button>
            </div>
          )}
        </aside>

        <main>
          <div className="viewtabs" role="tablist" aria-label="Widok">
            <button type="button" role="tab" aria-selected={view === 'plan'} onClick={() => setView('plan')}>Plan z arkusza</button>
            <button type="button" role="tab" aria-selected={view === 'menu'} onClick={() => setView('menu')}>Przykładowe posiłki</button>
          </div>

          {plan && (<>
            <Summary T={plan.T} tot={plan.tot} />
            {removed.length > 0 && <div className="removed">Usunięte posiłki:{removed.map(mi => (
              <button key={mi} type="button" className="vchip" disabled={ro} onClick={() => updateVersion(x => { x.removed[day] = x.removed[day].filter(n => n !== mi); })}>↺ {tmpl[mi].meal}</button>))}</div>}
            <div className="stack">{plan.meals.map(M => (
              <article className="meal" key={M.mi}>
                <div className="meal-head"><h3>{M.meal}</h3>
                  <div className="right"><span className="mk">B {fmt(M.sum[0])} · W {fmt(M.sum[1])} · T {fmt(M.sum[2])} · <b>{fmt(M.sum[3])} kcal</b></span>
                    <button type="button" className="xbtn" disabled={ro || tmpl.length - removed.length <= 1} aria-label={`Usuń ${M.meal}`}
                      onClick={() => updateVersion(x => { (x.removed[day] ??= []).push(M.mi); })}>Usuń posiłek</button></div></div>
                <div className="tbl-wrap"><table><thead><tr><th>Produkt</th><th>Ilość</th><th>Białko</th><th>Węgle</th><th>Tłuszcz</th><th>Kcal</th></tr></thead><tbody>
                  {M.rows.map(r => (
                    <tr key={r.key}><td><div className="prod"><span className="tag" style={{ background: GROUP_COLOR[r.role] }} title={GROUP_NAME[r.role]} /><div>
                      <select aria-label={`Produkt – ${M.meal}`} className={r.prod !== r.orig ? 'swapped' : ''} disabled={ro} value={r.prod}
                        onChange={e => updateVersion(x => { if (e.target.value === r.orig) delete x.swaps[r.key!]; else x.swaps[r.key!] = e.target.value; })}>
                        {D.products.filter(p => p.group === r.role).map(p => <option key={p.name}>{p.name}</option>)}</select>
                      {r.role === 'V' && <span className="note">{VEG_NOTE}</span>}
                      {r.add && <span className="note">Tłuszcz dodany – do posiłku lub do smażenia.</span>}</div></div></td>
                      <td className="g">{qtyTxt(r, D)}</td><td className="num">{fmt(r.m[0], 1)}</td><td className="num">{fmt(r.m[1], 1)}</td><td className="num">{fmt(r.m[2], 1)}</td><td className="num">{fmt(r.m[3])}</td></tr>))}
                </tbody></table></div>
              </article>))}</div>
            <section className="notes">
              <h2>Zasady z planu</h2>
              <ul>
                <li>Wszystkie produkty ważone w stanie surowym, przed obróbką termiczną.</li>
                <li>Warzywa mają stałą porcję 150 g; można użyć dowolnych warzyw niskoskrobiowych, najlepiej zielonych.</li>
                <li>Po usunięciu posiłku jego makro rozkłada się proporcjonalnie na pozostałe posiłki.</li>
                <li>Gramatury zaokrąglone do 5 g (powyżej 300 g do 10 g, tłuszcze do 1 g).</li>
                <li>Tłuszcz dodany (olej, masło orzechowe) pojawia się tylko wtedy, gdy produktów tłuszczowych z planu nie wystarcza do celu.</li>
              </ul>
            </section>
          </>)}

          {view === 'menu' && (
            <ChefPanel prefs={prefs} disabled={ro} onChange={p => { updateVersion(x => { x.prefs = p; }); setMenuIdx({ T: 0, N: 0 }); }} />
          )}
          {view === 'menu' && !menus.length && (
            <div className="empty"><strong className="empty-t">Brak pasujących przepisów</strong>
              <p className="hint">Wykluczenia odrzuciły wszystkie dania z bazy. Odznacz któreś wykluczenie albo usuń produkt z listy „Nie je”.</p></div>
          )}
          {menu && (<>
            <Summary T={menu.T} tot={menu.tot} />
            <div className="menu-pick" role="tablist" aria-label="Propozycje dnia">{menus.map((m, i) => (
              <button key={m.id} type="button" role="tab" aria-selected={i === mIdx} onClick={() => setMenuIdx(s => ({ ...s, [day]: i }))}>
                <span className="mid">Propozycja {m.id}<span className="mtime">≈ {m.time} min</span></span><span className="mname">{m.name}</span></button>))}</div>
            <p className="menu-lead">{DAY_NAME[day]}: {menu.meals.length} posiłki. {day === 'T'
              ? 'Posiłki 3 i 4 są okołotreningowe: 2× więcej węglowodanów i minimum tłuszczu.'
              : 'Bez okna treningowego – węglowodany rozłożone równo, najwięcej tłuszczu w śniadaniu.'}
              {prefsSummary(prefs, D).length > 0 && <> Ustawienia: {prefsSummary(prefs, D).join(' · ')}.</>}</p>
            {menu.menu.notes.length > 0 && <ul className="chef-notes">{menu.menu.notes.map(n => <li key={n}>{n}</li>)}</ul>}
            <div className="stack">{menu.meals.map(M => {
              const r = M.recipe, tg = M.target.g;
              return (
                <article className="dish" key={M.slot.id}>
                  <header className="dish-head">
                    <div className="dish-title"><span className="slot">{M.slot.name} · {M.slot.label}</span><h3>{r.name}</h3>
                      <div className="chips"><span className="chip cuisine-chip">{cuisineName(r.cuisine)}</span><span className="chip">{serveLabel(r, D)}</span><span className="chip">{r.time} min</span>
                        {M.slot.periWorkout && <span className="chip peri">okołotreningowy</span>}</div></div>
                    <div className="dish-mk"><b>{fmt(M.sum[3])} kcal</b><span>B {fmt(M.sum[0])} · W {fmt(M.sum[1])} · T {fmt(M.sum[2])}</span>
                      <span className="cel">cel B {fmt(tg[0])} · W {fmt(tg[1])} · T {fmt(tg[2])}</span></div>
                  </header>
                  <div className="dish-body">
                    <ul className="ingr">{M.rows.map(x => (
                      <li key={x.prod}><span className="tag" style={{ background: GROUP_COLOR[x.role === 'X' ? (D.P[x.prod].group === 'V' ? 'V' : 'X') : x.role] }} />
                        <span className="iname">{x.prod}</span><span className="iq">{qtyTxt(x, D)}</span></li>))}</ul>
                    <div className="how"><ol>{r.steps.map(s => <li key={s}>{s}</li>)}</ol>
                      {r.tip && <p className="tip"><b>Wskazówka:</b> {r.tip}</p>}</div>
                  </div>
                </article>
              );
            })}</div>
          </>)}

          <section className="generate">
            <fieldset className="brand-pick">
              <legend>Logo i nazwa w PDF</legend>
              {BRAND_IDS.map(b => (
                <label key={b} className={b === brand ? 'on' : ''}>
                  <input type="radio" name="pdf-brand" value={b} checked={b === brand} onChange={() => setBrand(b)} />
                  <Logo brand={b} width={BRANDS[b].w * 0.62} />
                </label>))}
            </fieldset>
            <p>{genInfo || `PDF: ${person.name || 'Bez nazwy'}, wersja v${v.n}. Plan na oba dni oraz osobny dział z przykładowymi posiłkami od kucharza (3 propozycje na dzień treningowy i 3 na nietreningowy, według ustawień z zakładki posiłków), z logo ${BRANDS[brand].name}.`}</p>
            <button type="button" className="btn primary" disabled={busy} onClick={generate}>{busy ? 'Generowanie…' : 'Generuj'}</button>
          </section>
          {backupBox}
        </main>
      </div>
    </div>
  );
}
