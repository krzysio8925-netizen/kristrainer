import type { Data, Day, Group, Recipe, Row } from './engine/types';

export const DAY_NAME: Record<Day, string> = { T: 'Dzień treningowy', N: 'Dzień nietreningowy' };
export const VEG_NOTE = 'Możesz użyć dowolnego rodzaju warzyw niskoskrobiowych, najlepiej zielonych.';
export const GROUP_NAME: Record<Group, string> = { P: 'Białko', C: 'Węglowodany', F: 'Tłuszcz', V: 'Warzywa', X: 'Dodatki' };
export const GROUP_COLOR: Record<Group, string> = { P: 'var(--p)', C: 'var(--c)', F: 'var(--f)', V: 'var(--v)', X: 'var(--muted)' };

export const fmt = (x: number, d = 0) => x.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });
export const qtyTxt = (r: Row, D: Data) => { const u = D.P[r.prod].unitG; return u ? `${fmt(r.g / u)} szt.` : `${fmt(r.g)} g`; };
export const serveLabel = (r: Recipe, D: Data) => D.recipes.serveLabels[r.serve] ?? r.serve;
