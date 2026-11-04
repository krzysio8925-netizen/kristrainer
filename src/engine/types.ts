// Data model of the Kris Trainer diet calculator.

export type Day = 'T' | 'N';                 // T – dzień treningowy, N – nietreningowy
export type Group = 'P' | 'C' | 'F' | 'V' | 'X'; // białko, węglowodany, tłuszcz, warzywa, dodatki
export type Role = 'P' | 'C' | 'F' | 'X' | 'V';
export type Macro4 = [number, number, number, number]; // B, W, T (g), kcal
/** Typ posiłku: S śniadanie, W do pracy, O okołotreningowy, K obiad/kolacja. */
export type Kind = 'S' | 'W' | 'O' | 'K';

export interface Product {
  name: string; group: Group; category: string;
  p: number; c: number; f: number; kcal: number; // na 100 g
  unitG?: number; unitName?: string; source: string;
}

export interface TemplateItem { p: string; g: number; add?: boolean }
export interface PlanTemplate {
  planKcal: Record<Day, number>;
  planSplit: Record<Day, { p: number; f: number }>;
  restDayRatio: number;
  days: Record<Day, { meal: string; items: TemplateItem[] }[]>;
}

export interface Slot {
  id: string; name: string; label: string; requirement: string;
  weights: { p: number; c: number; f: number }; periWorkout: boolean;
  kind: Kind; portable: boolean;
}
export interface MealRules { principles: string[]; days: Record<Day, { name: string; slots: Slot[] }> }

export interface Recipe {
  name: string; serve: string; time: number; cuisine: string; slots: Kind[];
  ingredients: { p: string; g: number; r: Role }[];
  steps: string[]; tip?: string;
}
/** Propozycja dnia ułożona przez kucharza: przepisy po kolei dla posiłków dnia. */
export interface Menu { id: string; name: string; meals: string[]; cuisines: string[]; time: number; notes: string[] }
export interface Recipes { serveLabels: Record<string, string>; recipes: Record<string, Recipe> }

export interface Cuisine { id: string; name: string }
export interface Exclusion { id: string; label: string; products: string[] }
export interface ChefData { expressMaxMin: number; cuisines: Cuisine[]; diets: string[]; exclusions: Exclusion[] }

/** Preferencje do propozycji posiłków (zapisywane w wersji planu). */
export interface MenuPrefs {
  cuisines: string[];   // wybrane kuchnie (puste = wszystkie)
  express: boolean;     // maksymalna oszczędność czasu
  exclude: string[];    // id grup wykluczeń
  avoid: string[];      // pojedyncze produkty, których osoba nie je
  like: string[];       // produkty lubiane
  seed: number;         // „Wymieszaj” – inne propozycje przy tych samych ustawieniach
}

export interface Data {
  products: Product[]; P: Record<string, Product>;
  template: PlanTemplate; rules: MealRules; recipes: Recipes; chef: ChefData;
}

/** One saved version of a person's plan. */
export interface PlanVersion {
  n: number; createdAt: string; note: string;
  mode: 'kcal' | 'macro';
  kcal: Record<Day, number>; nAuto: boolean;
  split: Record<Day, { p: number; f: number }>;
  macro?: Record<Day, { p: number; c: number; f: number }>;
  swaps: Record<string, string>;          // "T|posiłek|składnik" → produkt
  removed: Record<Day, number[]>;         // indeksy usuniętych posiłków
  prefs?: MenuPrefs;                      // preferencje do propozycji posiłków
}

export interface Person { id: string; name: string; sex: 'M' | 'K'; createdAt: string }

export interface Target { g: [number, number, number]; kcal: number; pct: [number, number, number] }

export interface Row {
  prod: string; base: number; role: Role; g: number; m: Macro4;
  meal?: string; mi?: number; key?: string; orig?: string; add?: boolean;
}
export interface PlanMeal { meal: string; mi: number; rows: Row[]; sum: Macro4 }
export interface PlanResult { T: Target; meals: PlanMeal[]; tot: Macro4 }
export interface MenuMeal { slot: Slot; recipeId: string; recipe: Recipe; target: { g: [number, number, number]; kcal: number }; rows: Row[]; sum: Macro4 }
export interface MenuResult { T: Target; menu: Menu; meals: MenuMeal[]; tot: Macro4 }
