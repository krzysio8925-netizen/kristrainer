// Copies the PDF library into public/vendor so it is loaded only when "Generuj" is clicked.
import { copyFileSync, mkdirSync } from 'node:fs';
const out = new URL('../public/vendor/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const f of ['pdfmake.min.js', 'vfs_fonts.js']) copyFileSync(new URL(`../node_modules/pdfmake/build/${f}`, import.meta.url), new URL(f, out));
