// Marki, którymi można podpisać PDF z dietą: obecne logo Kris Trainer albo GabiTrainer.

export type BrandId = 'kris' | 'gabi';

export interface Brand {
  id: BrandId;
  /** Nazwa w stopce, metadanych i nazwie pliku PDF. */
  name: string;
  /** Szerokość logo w jednostkach viewBox (wysokość zawsze 52). */
  w: number;
}

export const BRANDS: Record<BrandId, Brand> = {
  kris: { id: 'kris', name: 'Kris Trainer', w: 210 },
  gabi: { id: 'gabi', name: 'GabiTrainer', w: 236 },
};

export const BRAND_IDS = Object.keys(BRANDS) as BrandId[];
export const isBrandId = (x: unknown): x is BrandId => typeof x === 'string' && x in BRANDS;

/** Kolory logo GabiTrainer (z ikony aplikacji i panelu GabiTrainer). */
export const GABI = { bg: '#56633f', blob: '#6a7656', dot: '#ccdbb2', cream: '#f5ead8', ink: '#201e1d', accent: '#c67139' };
