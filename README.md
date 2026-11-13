# Kris Trainer — kalkulator doboru diety

Aplikacja webowa trenera (React + Vite + TypeScript) do układania planów żywieniowych: osoby, wersje planów, zapotrzebowanie w kcal lub makro, plan z arkusza z zamiennikami, przykładowe posiłki układane przez „kucharza” (3 propozycje na dzień treningowy i 3 na nietreningowy – kuchnia osobno dla każdej propozycji: wybrana, losowa z „Losuj” albo miks; tryb ekspres, dieta, wykluczenia, ulubione i szejki zamiast wybranych posiłków; baza ok. 300 przepisów) i PDF z logo do wyboru: Kris Trainer albo GabiTrainer; przy każdej propozycji w PDF jest lista zakupów na cały dzień (produkty zsumowane i pogrupowane według działów sklepu).

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
| `src/data/*.json` | Produkty, plan bazowy z arkusza, zasady rozkładu makro na posiłki, baza przepisów (10 kuchni) i słownik kucharza (`kuchnie.json`: kuchnie, tryb ekspres, grupy wykluczeń) |
| `src/engine/` | Silnik obliczeń, kucharz układający propozycje (`kucharz.ts`) i lista zakupów (`zakupy.ts`) – czysty TypeScript, bez React i bazy, + testy |
| `src/backend/` | Firebase: logowanie, zapis osób i wersji, kopia danych |
| `src/views/` | Ekrany: logowanie, kalkulator |
| `src/pdf.ts` | PDF (biblioteka pdfmake ładowana dopiero po kliknięciu „Generuj”) |
| `src/brand.ts` | Marki do wyboru w PDF (Kris Trainer, GabiTrainer) |

Dane w bazie: `kris_clients/{id}` (osoba) i `kris_clients/{id}/versions/{vN}` (wersja planu) — osobno od danych GabiTrainer.

## Dodanie przepisu

Dopisz przepis w `src/data/przepisy.json`:

- `cuisine` – id kuchni z `src/data/kuchnie.json` (szejk: `"cuisine": "szejk"` i `"shake": true` – kucharz wstawia go tylko zamiast posiłków wybranych w „Szejk zamiast posiłku”),
- `slots` – typy posiłków: `S` śniadanie (na ciepło), `W` do pracy (na zimno / z mikrofali), `O` okołotreningowy (mało tłuszczu), `K` obiad / kolacja,
- `serve`, `time` (minuty – do 10 min danie liczy się do trybu ekspres),
- składniki z `produkty.json` z rolą P/C/F/X (P, C, F są skalowane do makro posiłku, X to stały dodatek).

Kucharz sam włączy przepis do propozycji. `npm test` sprawdzi spójność danych, to, że każda kuchnia ma danie na każdy posiłek, oraz trafienie propozycji w makro.

## Jak kucharz układa propozycje

1. Odrzuca przepisy niezgodne z dietą (wege, pescetariańska), grupami wykluczeń i listą „Nie je”. „Lubi” i „Nie je” to dowolny tekst (produkt, danie albo grupa, np. „łosoś”, „curry”, „grzyby”) dopasowywany do nazw dań i składników.
2. Na każdy posiłek bierze dania pasujące do jego typu (śniadanie na ciepło, posiłki do pracy bez dań tylko na ciepło).
3. Każda propozycja (A, B, C) ma swoją kuchnię: wybraną, dietę z listy (np. ziemniaczano-twarogową – tylko przepisy oznaczone `"programs": ["ziemniak-twarog"]`), wylosowaną (różną od pozostałych; „Losuj” losuje od nowa tylko tę propozycję, ta sama kuchnia w obu dniach) albo miks. Kuchnię i tryb ekspres traktuje jako warunek – odstępuje od nich tylko, gdy nie ma żadnego pasującego dania, i zapisuje o tym notatkę (przy kuchni wylosowanej ekspres ma pierwszeństwo). Na posiłki wybrane w „Szejk zamiast posiłku” (maks. 2 na dzień) wstawia szejk – w każdej propozycji inny.
4. Spośród reszty wybiera dania najlepiej trafiające w makro posiłku po przeskalowaniu, z karą za powtórki (to samo danie, białko lub węglowodan). Każda propozycja ma swoją „gwiazdę” z listy „Lubi” (A – pierwsza pozycja, B – druga…), która trafia do niej nawet kosztem dokładności posiłku; wtedy kucharz zostawia notatkę.
5. Na koniec wyrównuje cały dzień: to, czego jedno danie nie zmieściło, przechodzi na pozostałe posiłki.

Preferencje zapisują się w wersji planu (pole `prefs`), więc PDF zawiera te same propozycje co ekran. Zmiany w panelu kucharza są szkicem – stosuje je przycisk „Przelicz propozycje”; przy każdej pozycji „Lubi” / „Nie je” widać, czy została uwzględniona. „Wymieszaj” daje inne propozycje przy tych samych ustawieniach.

## Prehistoric Rush (gra)

W `public/prehistoric-rush/` leży osobna, samodzielna gra 2D na telefon (pionowy ekran, płótno Canvas, bez bibliotek, bez budowania i bez płatności). Po publikacji jest pod adresem `…/prehistoric-rush/`; na iPhonie można ją dodać do ekranu początkowego (Udostępnij → Do ekranu początkowego) i grać na pełnym ekranie. Lokalnie: `npx http-server public/prehistoric-rush`.

Grafiki postaci, bossów i otoczenia (`img/*.webp`) pochodzą z koncept-artów i z obrazów wygenerowanych w ich stylu (Artificial Studio, Seedream 4.0), z wyciętym tłem. `sprites.js` wczytuje pliki, a `game.js` rysuje świat na płótnie 2D z perspektywą drogi (droga z malowanej tekstury, wiersz po wierszu) i dodaje ruch: podskoki, kołysanie, błyski trafień. Bossowie: Chomper T-Rex, Grg Olbrzym, Mamut Bojowy i Pterodaktyl Bombowiec. Pociski przelatują przez bramki z bonusami – ładują je i lecą dalej.

## Astra Lancer (gra)

W `public/astra-lancer/` leży druga samodzielna gra na telefon: pionowa strzelanka kosmiczna w stylu anime-mecha (formacje wrogów, nurkowania, bossowie co 5 fal), z trzema poziomami trudności, hangarem (4 statki do kupienia, ulepszenia), poziomem pilota i drzewkiem umiejętności. Canvas 2D, grafika i dźwięk generowane w kodzie, bez bibliotek i bez płatności. Po publikacji: `…/astra-lancer/` (na iPhonie: Udostępnij → Do ekranu początkowego). Lokalnie: `npx http-server public` i `/astra-lancer/`.

Projekt gry, opis mechanik i instrukcja przeniesienia na iOS (Capacitor / SpriteKit): `docs/astra-lancer.md`. Testy rozwoju: `scripts/astra-lancer.test.mjs` (uruchamiane w `npm test`).

