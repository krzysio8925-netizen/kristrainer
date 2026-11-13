# Astra Lancer – projekt gry i instrukcja implementacji

Pionowa strzelanka kosmiczna w duchu klasycznych gier „formacyjnych” z lat 80.: wrogowie wlatują w ekran po krzywych, ustawiają się w formacji u góry i nurkują na gracza. Do tego styl anime-mecha i rozwój jak w grach mobilnych: hangar ze statkami, ulepszenia, poziom pilota, drzewko umiejętności.

Wersja webowa do testów leży w `public/astra-lancer/` i działa bez budowania. Ten dokument opisuje, jak działa każda część i jak przenieść grę na iOS.

---

## 1. Architektura

| Plik | Odpowiedzialność |
| --- | --- |
| `data.js` | Czyste dane i matematyka: poziomy trudności, statki, ulepszenia, umiejętności, wrogowie, skład fal, krzywa XP, operacje na zapisie (kupno, nauka, reset). Bez DOM, testowane w Node (`scripts/astra-lancer.test.mjs`). |
| `engine.js` | Klasa `Game`: pętla gry, sterowanie, fale, formacja, nurkowania, boss, bronie, kolizje, efekty, rysowanie na Canvas 2D. Komunikuje się z UI tylko przez haki (`onHud`, `onEnd`, `onBoss`, `onHurt`). |
| `art.js` | Cała grafika rysowana w kodzie (sprite'y renderowane raz do niewidocznych płócien). |
| `audio.js` | Efekty i muzyka syntezowane w Web Audio. |
| `main.js` + `index.html` | Ekrany HTML: menu, trudność, hangar, pilot (umiejętności), HUD, pauza, wynik; zapis w `localStorage`. |

Zasada: **dane → silnik → widok**. Balans gry zmienia się wyłącznie w `data.js` – silnik czyta mnożniki, a UI je wyświetla. Dzięki temu ten sam `data.js` można 1:1 przepisać na Swift przy natywnej wersji.

Świat gry ma stałą szerokość 540 jednostek, wysokość zależy od proporcji ekranu (760–1300). Wszystkie prędkości są w jednostkach na sekundę, a krok czasu `dt` jest ograniczony do 50 ms – gra działa tak samo przy 60 i 120 Hz (ProMotion w iPhonie).

---

## 2. Rozgrywka

### 2.1 Sterowanie
- **Dotyk:** przeciąganie palcem *w dowolnym miejscu* (sterowanie względne – palec nie zasłania statku). Statek goni punkt docelowy z prędkością zależną od statystyki „Prędkość”, więc ulepszenie silników ma znaczenie także na telefonie.
- **Ogień automatyczny** – na telefonie nie trzeba drugiego kciuka.
- **Umiejętność specjalna** – okrągły przycisk w prawym dolnym rogu, ładuje się od zadanych obrażeń.
- **Klawiatura (testy):** strzałki/WASD, spacja/X – specjalna, P/Esc – pauza.
- Statek porusza się w dolnej połowie ekranu (poziomo i pionowo), co daje więcej uników niż w klasyku.

### 2.2 Fale i formacja
1. **Intro** – pasek „FALA n” (przed bossem: „OSTRZEŻENIE”), gwiazdy rozciągają się w efekt „warp”.
2. **Wlot** – wrogowie pojawiają się grupami (rząd po rzędzie) i lecą po jednym z 4 wzorów (pętla z boku, ósemka z góry, łuk od dołu, spirala). Ruch to „sterowanie z ograniczonym skrętem”: wróg ma kierunek i prędkość, w każdej klatce skręca w stronę kolejnego punktu o maks. `turn·dt`. Blisko punktu skręt rośnie, więc nie krąży w nieskończoność. Daje to płynne, organiczne krzywe bez ręcznego liczenia krzywych Béziera.
3. **Formacja** – każdy wróg ma miejsce (kolumna, rząd). Cała formacja kołysze się na boki i „oddycha” (rozszerza się i zwęża), więc nawet stojący wrogowie są w ruchu.
4. **Nurkowania** – co kilka sekund (częściej na wyższych falach i trudnościach) 1–3 wrogów wylatuje z formacji. Każdy typ ma inny tor: Tsubame robi zygzak, Kabuto leci prosto i ciężko, Hachi robi pętlę. W locie strzelają celowanymi pociskami. Po wylocie za dolną krawędź wracają od góry na swoje miejsce.
5. **Ostrzał z formacji** – losowy wróg z formacji strzela w stronę gracza; tempo zależy od trudności i numeru fali.
6. **Fala czysta** – premia kredytów i XP, kryształy same lecą do gracza.

Skład fal (`waveLayout`): od fali 2 dochodzi piąty rząd, od 3 – Kabuto, od 4 – Hebi zamiast części Tsubame; kolumn przybywa do 8. HP i prędkość wrogów rosną z falą (`waveScale`), żeby ulepszenia były potrzebne w dłuższej grze.

### 2.3 Wrogowie

| Wróg | Wygląd | Zachowanie |
| --- | --- | --- |
| Hachi | mecha-pszczoła, jedno oko | słaby, pętle przy nurkowaniu |
| Tsubame | mecha-jaskółka, czerwono-biała | agresywne zygzaki |
| Hebi | wąż z lancą | szybkie, celne serie po 3 pociski |
| Kabuto | złoty żuk-pancernik | dużo HP, wachlarz 3 pocisków |

### 2.4 Bossowie (co 5. fala)
Kurai-Oni → Ryūjin → Yami-Hime, potem cykl od nowa z większym HP. Boss krąży u góry i zmienia wzory co ~4 s:
- **spirala** – obracające się ramiona pocisków,
- **celowane wachlarze** z dwóch wieżyczek,
- **przywołanie** – 4 drony nurkujące od razu,
- **lasery** – 1 s ostrzeżenia (przerywana linia), potem pionowa wiązka; trzeba zejść z linii.

Poniżej 50% HP – „TRYB SZAŁU”: szybciej, gęściej, trzeci laser. Trafienia liczone są na kilku kołach (rdzeń, skrzydła), więc kształt kolizji odpowiada grafice.

### 2.5 Poziomy trudności

| | Kadet | Pilot | As |
| --- | --- | --- | --- |
| HP wrogów | ×0,8 | ×1 | ×1,35 |
| Tempo ostrzału | ×0,55 | ×1 | ×1,6 |
| Prędkość pocisków | ×0,8 | ×1 | ×1,2 |
| Częstość nurkowań | ×0,65 | ×1 | ×1,5 |
| Życia | 4 | 3 | 2 |
| Kredyty i XP | ×0,8 | ×1 | ×1,6 |

Wyższa trudność **daje więcej nagród** – to motywuje do przejścia na trudniejszy poziom, gdy statek jest już ulepszony. Rekord zapisuje się osobno dla każdego poziomu.

### 2.6 Życie, kadłub, znajdźki, combo
- Kadłub = liczba trafień do utraty życia. Po utracie życia: odrodzenie z nietykalnością, broń spada o 1 poziom.
- **Kryształy** (kredyty) wypadają z wrogów; magnes przyciąga je w promieniu (umiejętność „Magnes” go zwiększa).
- **P** – poziom broni +1 (maks. 4: więcej luf / szerszy wachlarz); **H** – naprawa kadłuba.
- **Combo** – zestrzelenia w odstępie < 2,2 s; mnożnik punktów do ×3 i premia XP. Napisy „COMBO ×10/25/50!”.
- Zestrzelenie wroga w trakcie nurkowania daje ×1,5 punktów (nagroda za ryzyko).

---

## 3. Grafika – styl futurystycznego anime 2D

### 3.1 Zasady stylu
- **Gruby kontur „tuszem”** (`#140b2e`) wokół każdej części – jak w rysunkach anime.
- **Cel-shading:** kolor bazowy + twardy cień po prawej stronie (światło zawsze z lewej-góry), bez gradientów na pancerzu.
- **Rim light:** jasna krawędź od strony światła (ten sam kształt obrysowany przesuniętą jasną linią w obrębie przycięcia).
- **Szkło i oczy:** gradient + ostry biały błysk – typowy „anime glint”.
- **Neonowe światła** rysowane w trybie `lighter` (sumowanie kolorów): pociski, płomienie, eksplozje.
- **Paleta:** róż `#ff3d8b`, cyjan `#2fd8ff`, mięta `#3cffd0`, złoto `#ffcf3d`, fiolet `#7b3cff` na granatowo-fioletowym tle.

### 3.2 Jak to jest zrobione (`art.js`)
- Kształty statków to listy punktów prawej połowy – `sym()` odbija je lustrzanie. Części parzyste (skrzydła) rysuje `pair()`: lewa strona jasna, prawa w cieniu.
- `cel()` robi wypełnienie, cień, rim light i kontur w jednej funkcji – nowy statek to ~10 linijek punktów.
- Każdy sprite rysowany jest **raz** do niewidocznego płótna w rozdzielczości 2–3× (ostre na Retinie), gra tylko je kopiuje. Wersja „biała” (błysk trafienia) powstaje przez `source-atop`.
- Tło: dwie warstwy mgławic przewijane z paralaksą (tekstura łączy się bez szwu), planeta z pierścieniem, 3 warstwy gwiazd. Co 5 fal zmienia się sektor (paleta tła).
- Efekty anime: **impact frame** (biała 8-ramienna gwiazda przy wybuchu), linie prędkości, pierścienie fali uderzeniowej, drżenie ekranu, krótkie spowolnienie czasu przy umiejętności specjalnej i zabiciu bossa.
- **Cut-in** – przy umiejętności specjalnej przez ekran przelatuje ukośny pas z portretem pilotki i nazwą ataku (klasyczny motyw z anime o mechach).
- Pilotka Aoi (menu i cut-in) – hełm z wizjerem, przez który widać duże anime-oczy i różową grzywkę.

### 3.3 Jak podnieść jakość grafiki dalej
Kod jest przygotowany na podmianę sprite'ów na obrazy: wystarczy, że `playerSprite()`/`enemySprite()`/`bossSprite()` zwrócą `{ img, w, h }` z wczytanego pliku WebP/PNG zamiast rysunku. Rekomendowana ścieżka:
1. Koncept-arty postaci i statków (artysta albo generator obrazów) w jednym stylu: widok z góry, czyste tło, kontur, cel-shading.
2. Wycięcie tła, eksport WebP 2× (np. statek 168×184 px).
3. Atlas sprite'ów (jeden plik + JSON z prostokątami) – mniej plików do wczytania.
4. Portrety pilotów z mimiką (spokój / trafiona / atak) do cut-inów i dialogów przed bossem.

---

## 4. Rozwój: statki, ulepszenia, doświadczenie, umiejętności

### 4.1 Waluty
- **Kredyty** (kryształy) – zbierane w locie + premie za fale i bossów, mnożone przez trudność i umiejętność „Łowca nagród”. Wydawane w hangarze.
- **Doświadczenie (XP)** – za zestrzelenia, fale i bossów, mnożone przez trudność, combo i „Mentora”. Rozwija poziom pilota.

Nagrody zapisują się po każdej grze – także po przerwaniu („Zakończ lot”), więc nawet krótka sesja coś daje.

### 4.2 Statki (hangar)

| Statek | Cena | Broń | Specjalna |
| --- | --- | --- | --- |
| Sora-01 | start | podwójne działo | **Nova** – fala kasuje pociski wroga i rani wszystkich w zasięgu |
| Kitsune | 1 800 | wachlarz (3→9 pocisków) | **Fantom** – 4,5 s nietykalności i podwójny ogień |
| Raijin | 4 500 | przebijające pociski | **Gromowy Promień** – 3 s pionowej wiązki niszczącej wszystko w linii |
| Walkiria | 9 500 | działo + rakiety samonaprowadzające | **Rój** – 18 rakiet naraz |

Każdy statek ma inne statystyki bazowe (kadłub, prędkość, obrażenia, salwy/s) i inny sposób gry – to ważniejsze niż „lepszy/gorszy”.

### 4.3 Ulepszenia (osobno dla każdego statku, 5 poziomów)
Działa (+15% obrażeń), Szybkostrzelność (+10%), Pancerz (+1 kadłuba), Silniki (+7% prędkości).
Koszt: `bazowy × (poziom+1)^1,55 × (1 + 0,35 × (tier−1))` – rośnie szybciej niż liniowo i jest droższy na lepszych statkach. W hangarze paski statystyk pokazują wartość bazową i (na złoto) zysk z ulepszeń.

### 4.4 Poziom pilota i drzewko umiejętności
- XP na następny poziom: `120 × poziom^1,45` (poziom 2: 120 XP, poziom 10: ~3 400 XP), maks. 40.
- **1 poziom = 1 punkt umiejętności.** Umiejętności są wspólne dla wszystkich statków (to „postać”, a statki to „ekwipunek”).
- Część umiejętności odblokowuje się od określonego poziomu.
- Reset drzewka jest darmowy – zachęca do eksperymentów.

| Gałąź | Umiejętność | Rangi | Efekt |
| --- | --- | --- | --- |
| Atak | Ostrzał | 5 | +6% obrażeń / rangę |
| Atak | Precyzja (poz. 3) | 4 | +5% szans na krytyk ×2 |
| Atak | Arsenał (poz. 8) | 2 | start z wyższym poziomem broni |
| Obrona | Tarcza (poz. 2) | 3 | tarcza pochłania 1 trafienie, odnowa 20 → 14 → 9 s |
| Obrona | Rezerwa (poz. 5) | 2 | +1 życie / rangę |
| Taktyka | Magnes | 3 | +45% zasięgu zbierania |
| Taktyka | Łowca nagród (poz. 2) | 5 | +10% kredytów |
| Taktyka | Overdrive (poz. 4) | 4 | specjalna ładuje się szybciej |
| Taktyka | Mentor (poz. 6) | 3 | +10% XP |

Końcowe statystyki liczy jedna funkcja `shipStats(statek, ulepszenia, umiejętności)` – silnik nie zna szczegółów sklepu ani drzewka.

### 4.5 Pętla motywacji
lot → kryształy + XP → nowy poziom / ulepszenie → dalsza fala lub wyższa trudność → więcej nagród. Pierwszy awans pojawia się już po pierwszej grze, pierwszy nowy statek po kilku-kilkunastu lotach.

Pomysły na rozbudowę: codzienne misje („zestrzel 50 Tsubame”), skórki statków, druga pilotka z innym cut-inem, tryb „Boss Rush”, ranking (Game Center), etapy specjalne bez strzelających wrogów za premię.

---

## 5. Wersja na iOS

### Krok 1 – testy na iPhonie już teraz (PWA)
Po publikacji gra jest pod `…/astra-lancer/`. W Safari: **Udostępnij → Do ekranu początkowego** – uruchamia się na pełnym ekranie z ikoną, działa w pionie, z obsługą wycięcia (safe-area).

### Krok 2 – aplikacja w App Store przez Capacitor (zalecane)
Ten sam kod HTML/JS w natywnej powłoce (WKWebView). Wymaga Maca z Xcode i konta Apple Developer.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Astra Lancer" com.twojafirma.astralancer --web-dir public/astra-lancer
npx cap add ios
npx cap sync ios
npx cap open ios
```

W Xcode: orientacja tylko *Portrait*, ukryty pasek statusu, ikona 1024×1024 (można wygenerować tak jak `icon-512.png`), podpis zespołu. Zalecane wtyczki:
- `@capacitor/preferences` – zapis postępu zamiast `localStorage` (iOS może czyścić dane WebView przy braku miejsca); wystarczy podmienić `load()`/`persist()` w `main.js`.
- `@capacitor/haptics` – wibracje przy trafieniu (Safari nie obsługuje `navigator.vibrate`).
- Game Center (wtyczka społeczności) – rankingi per trudność.
- Zakupy w aplikacji (StoreKit) – jeśli kiedyś kredyty mają być płatne; obecnie gra nie ma płatności.

Uwaga: przełącznik wyciszenia w iPhonie wycisza Web Audio – w aplikacji Capacitor można to zmienić ustawieniem `AVAudioSession` na `.playback`.

### Krok 3 (opcjonalny) – natywny SpriteKit
Jeśli kiedyś potrzebna będzie maksymalna wydajność: `data.js` przepisuje się 1:1 na struktury Swift, `engine.js` na `SKScene` (te same stany: intro/fight/clear, formacja, nurkowania), sprite'y eksportuje się do atlasu `.atlas`. Logika jest celowo oddzielona od rysowania, żeby to przejście było mechaniczne.

### Wydajność na telefonie
- Sprite'y renderowane raz, w grze tylko `drawImage`.
- Limit cząsteczek (700), proste kolizje kołowe.
- Jeśli średni czas klatki przekroczy 25 ms, gra sama obniża rozdzielczość płótna.
- Gra pauzuje się przy przejściu aplikacji w tło.

---

## 6. Testowanie
- `npm test` – testy rozwoju (ceny, XP, zakupy, umiejętności, odporność zapisu) razem z testami kalkulatora.
- `npx http-server public` → `http://localhost:8080/astra-lancer/` – gra lokalnie.
- `…/astra-lancer/?debug=1` – 50 000 kredytów, poziom 10 i 20 punktów umiejętności do sprawdzenia sklepu (wydane w tym trybie zapisują się w przeglądarce).
- W konsoli przeglądarki `__astra.game` daje dostęp do silnika (np. `__astra.game.wave = 4` przed czystą falą przeniesie do bossa).
