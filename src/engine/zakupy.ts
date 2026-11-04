// Lista zakupów: sumuje produkty ze wszystkich posiłków dnia i układa je według działów sklepu.
import type { Data, Row } from './types.ts';

/** Działy sklepu w kolejności zakupów i kategorie produktów, które do nich trafiają. */
export const SECTIONS: { name: string; categories: string[] }[] = [
  { name: 'Warzywa', categories: ['Warzywa', 'Warzywa skrobiowe'] },
  { name: 'Owoce', categories: ['Owoce'] },
  { name: 'Mięso i ryby', categories: ['Mięso', 'Ryby'] },
  { name: 'Nabiał, jaja i sery', categories: ['Nabiał', 'Jaja', 'Sery'] },
  { name: 'Pieczywo, kasze i makarony', categories: ['Pieczywo', 'Zboża'] },
  { name: 'Strączki i tofu', categories: ['Strączki', 'Roślinne'] },
  { name: 'Tłuszcze, orzechy i pasty', categories: ['Tłuszcze'] },
  { name: 'Odżywki', categories: ['Odżywka'] },
  { name: 'Sosy, przyprawy i dodatki', categories: ['Cukry', 'Dodatki'] },
];
// Produkty z kategorii „Dodatki”, które w sklepie leżą przy nabiale.
const DAIRY_EXTRAS = new Set(['Jogurt naturalny 0%', 'Mleko 2%', 'Kefir 2%']);

export interface ShopItem { prod: string; g: number; units?: number; unitName?: string }
export interface ShopSection { name: string; items: ShopItem[] }

/** Lista zakupów z wierszy posiłków (gramatury jak w planie, produkty na surowo). */
export function shoppingList(rows: Row[], data: Data): ShopSection[] {
  const sum = new Map<string, number>();
  rows.forEach(r => { if (r.g > 0) sum.set(r.prod, (sum.get(r.prod) ?? 0) + r.g); });
  const sectionOf = (prod: string) => {
    if (DAIRY_EXTRAS.has(prod)) return 'Nabiał, jaja i sery';
    const cat = data.P[prod]?.category ?? '';
    return SECTIONS.find(s => s.categories.includes(cat))?.name ?? SECTIONS[SECTIONS.length - 1].name;
  };
  return SECTIONS.map(s => ({
    name: s.name,
    items: [...sum.entries()].filter(([prod]) => sectionOf(prod) === s.name)
      .sort((a, b) => a[0].localeCompare(b[0], 'pl'))
      .map(([prod, g]) => {
        const P = data.P[prod];
        return P?.unitG ? { prod, g, units: Math.round(g / P.unitG), unitName: P.unitName ?? 'szt.' } : { prod, g };
      }),
  })).filter(s => s.items.length);
}
