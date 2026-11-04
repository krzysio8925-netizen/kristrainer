// Dane kalkulatora: produkty, plan bazowy z arkusza, zasady posiłków i przepisy (pliki JSON obok).
import { makeData } from '../engine/silnik';
import type { MealRules, PlanTemplate, Product, Recipes } from '../engine/types';
import produkty from './produkty.json';
import przepisy from './przepisy.json';
import szablon from './szablon-planu.json';
import zasady from './zasady-posilkow.json';

export const DATA = makeData(produkty as { products: Product[] }, szablon as PlanTemplate, zasady as MealRules, przepisy as Recipes);
