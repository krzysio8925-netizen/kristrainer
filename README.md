# Kris Trainer — kalkulator doboru diety

Aplikacja webowa trenera (React + Vite + TypeScript) do układania planów żywieniowych: osoby, wersje planów, zapotrzebowanie w kcal lub makro, plan z arkusza z zamiennikami, przykładowe posiłki (3 propozycje na dzień treningowy i 3 na nietreningowy) i PDF z logo Kris Trainer.

Adres po publikacji: `https://krzysio8925-netizen.github.io/<repozytorium>/`. Dostęp ma tylko jedno konto (`src/backend/config.ts` i `isKris()` w `firebase/firestore.rules`).

## Publikacja

Każda zmiana wysłana na gałąź `main` publikuje się sama (`.github/workflows/deploy.yml`, zakładka *Actions*). W ustawieniach repozytorium: *Settings → Pages → Source: GitHub Actions*.

## Baza danych

Projekt Firebase `gabitrainer` (wspólny z aplikacją GabiTrainer), osobna kolekcja `kris_clients`. Reguły w `firebase/firestore.rules` obejmują oba projekty – w konsoli Firebase wklejaj zawsze cały plik.

## Uruchomienie

```bash
npm install
npm run dev     # podgląd na http://localhost:5173
npm test        # testy silnika obliczeń
npm run build   # wersja do publikacji w dist/
```

## Struktura

| Folder / plik | Co zawiera |
| --- | --- |
| `src/data/*.json` | Produkty, plan bazowy z arkusza, zasady rozkładu makro na posiłki, przepisy i propozycje dni |
| `src/engine/` | Silnik obliczeń (czysty TypeScript, bez React i bazy) + testy |
| `src/backend/` | Firebase: logowanie, zapis osób i wersji, kopia danych |
| `src/views/` | Ekrany: logowanie, kalkulator |
| `src/pdf.ts` | PDF (biblioteka pdfmake ładowana dopiero po kliknięciu „Generuj”) |

Dane w bazie: `kris_clients/{id}` (osoba) i `kris_clients/{id}/versions/{vN}` (wersja planu) — osobno od danych GabiTrainer.

## Dodanie przepisu

Dopisz przepis w `src/data/przepisy.json` (składniki z `produkty.json`, rola P/C/F/X) i wstaw jego id do propozycji w `menus`. `npm test` sprawdzi spójność danych.
