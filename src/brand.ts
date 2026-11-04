// Marki, którymi można podpisać PDF z dietą: logo Kris Trainer albo GabiTrainer.
import gabiBlush from './assets/gabi/logo-blush.svg';
import gabiPlum from './assets/gabi/logo-plum.svg';

export type BrandId = 'kris' | 'gabi';

export interface Brand {
  id: BrandId;
  /** Nazwa w stopce, metadanych i nazwie pliku PDF. */
  name: string;
  /** Proporcja logo (szerokość / wysokość). */
  ratio: number;
  /** Rozmiar logo w nagłówku PDF (pt) i w kafelku wyboru (px). */
  pdf: { width: number; height?: number };
  pickerHeight: number;
}

export const BRANDS: Record<BrandId, Brand> = {
  kris: { id: 'kris', name: 'Kris Trainer', ratio: 210 / 52, pdf: { width: 150 }, pickerHeight: 32 },
  // GabiTrainer-logo.zip: logo-plum.svg (jasne tło), logo-blush.svg (ciemne tło); viewBox 304,3 × 260.
  gabi: { id: 'gabi', name: 'GabiTrainer', ratio: 304.3 / 260, pdf: { width: 62 * 304.3 / 260, height: 62 }, pickerHeight: 56 },
};

export const BRAND_IDS = Object.keys(BRANDS) as BrandId[];
export const isBrandId = (x: unknown): x is BrandId => typeof x === 'string' && x in BRANDS;

/** Pliki logo GabiTrainer: plum na jasne tło, blush na ciemne. */
export const GABI_LOGO = { plum: gabiPlum, blush: gabiBlush };
