# youtrack-userscripts

Userscriptek a [YouTrack](https://fotexnet.youtrack.cloud)-hoz.

## youtrack-branch-name.user.js

Egy kattintással git branch nevet másol a vágólapra a ticket azonosítójából és
címéből:

```
EHR-102 · "Új jelenléti ív nem hozható létre"
        → EHR-102-cannot-create-timesheet          (angol, alapból)
        → EHR-102-uj-jelenleti-iv-nem-hozhato-letre (Shift + klikk)
```

A gomb a cím melletti ikonsorba kerül, a ceruza elé. Ott van a teljes ticket
oldalon, a board overlay-en és az issue lista előnézet paneljén is, valamint a
listákban / board kártyákon / „Relates to" blokkban a ticket azonosítók mellett.

| | |
|---|---|
| **klikk** | branch név a vágólapra |
| **Alt + klikk** | `git checkout -b <branch név>` a vágólapra |

Az ékezetek NFD-normalizálással tűnnek el, tehát az `ő` és az `ű` is helyesen
`o`/`u` lesz, nem esik ki. A név 80 karakternél szóhatáron csonkolódik, az
azonosító sosem sérül.

Az azonosító pontosan úgy marad, ahogy a YouTrack adja (`EHR-102`), a cím viszont
kisbetűs lesz. Ez szándékos és nem állítható: a névkonvenció célja a YouTrack
issue ↔ branch/PR összekapcsolása, és az azonosító kisbetűsítése ezt kockáztatná.

## Angol branch nevek

A cím angolra fordítását a Gemini API végzi (`gemini-3.5-flash-lite`): nem szó
szerint fordít, hanem branch-név-formájú összefoglalót ír, ezért rövidebb és
olvashatóbb a nyers fordításnál.

Egyszer be kell állítani az API kulcsot: **Cmd + klikk** (Windows/Linux alatt
Ctrl + klikk) a branch gombon, és a felugró mezőbe illeszd be. Ugyanez elérhető a
userscript-kezelő menüjéből is (**Set Gemini API key**) ott, ahol a kezelő
támogatja — Safariban például nincs ilyen menü, ott a Cmd + klikk az egyetlen út.

A kulcs a kezelő tárolójába kerül, **nem a script fájljába** — ez azért fontos,
mert az auto-update minden frissítésnél felülírja a fájlt, tehát egy oda beírt
kulcs elveszne. Böngészőnként és gépenként külön kell megadni, nem
szinkronizálódik.

Ha nincs kulcs beállítva, vagy az API hívás elhasal, a script automatikusan a
magyar nevet adja, és a toast megírja, miért. **Shift + klikkel** bármikor
kérhető a magyar név.

A generált slugok ticketenként el vannak tárolva (alapból egy évig), szóval egy
tickethez egyszer megy kérés, és ugyanaz a név jön ki minden későbbi másolásnál.
A tároló gépenként külön él: két kollégánál elvileg eltérhet az angol slug. Ez a
YouTrack linkelést nem érinti, mert azt az azonosító végzi.

## Összekapcsolás a YouTrackkal

A branch/PR és az issue összekötése a YouTrack saját funkciója, nem a scripté. Az
azonosítót három helyen keresi:

1. a commit messageben,
2. a branch nevében — de csak akkor, ha a commit messageben nincs azonosító,
3. a pull request címében és leírásában.

Két dolog, ami könnyen elrontja:

- A branch név alapú linkeléshez be kell kapcsolni a **Check branch names for
  issue references** opciót a VCS integráció beállításaiban. E nélkül a konvenció
  önmagában nem linkel semmit, és nem is jelez hibát.
- A GitHub a PR címét a branch névből generálja, a kötőjeleket szóközre cserélve:
  `EHR-98-valami` → „EHR 98 valami", amiben az azonosító szétesik. A PR címébe
  vagy leírásába érdemes kézzel beírni az `EHR-98`-at.

## Telepítés

Kell egy userscript-kezelő, utána a script telepítése egy kattintás:

**[→ Telepítés](https://raw.githubusercontent.com/matekerges/youtrack-userscripts/main/youtrack-branch-name.user.js)**

Frissítést nem kell kézzel követni: a kezelő a `@updateURL` alapján magától
behúzza az új verziót.

### Chrome / Edge / Brave

1. [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. **Fontos:** `chrome://extensions` → jobb felül **Developer mode** bekapcsolása
   (vagy a Tampermonkey részleteinél az *Allow User Scripts* kapcsoló). E nélkül
   a Chrome újabb verziói hibaüzenet nélkül nem futtatják a userscripteket.
3. **Site access:** jobb klikk a Tampermonkey ikonon → *This can read and change
   site data* → **On all sites**. Ez két dolog miatt kell: enélkül a popupban nem
   jelennek meg a script menüpontjai, és — ami fontosabb — a `GM_xmlhttpRequest`
   sem működik, tehát a Gemini hívás elhasal, és mindig magyar nevet kapsz. Ha a
   popup tetején narancssárga *"Limited runtime host permissions"* sáv van, ez
   hiányzik.
4. Fenti telepítő link → Install.

### Zen / Firefox

1. [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/) vagy
   [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/) az AMO-ról.
2. Fenti telepítő link → Install. Itt nincs developer mode kapcsoló, egyből fut.

### Safari (macOS / iOS)

1. [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) (ingyenes,
   nyílt forrású). macOS 12+ / Safari 14.1+.
2. Első indításkor kér egy mappát, ahova a scripteket menti — válassz egyet.
3. Safari → Beállítások → Bővítmények → **Userscripts** engedélyezése, és a
   `fotexnet.youtrack.cloud`-ra **Allow**. E nélkül csendben nem fut.
4. Fenti telepítő link → Install.

## Beállítások

A script tetején a `CONFIG` blokkban:

| kulcs | alap | mit csinál |
|---|---|---|
| `maxLength` | `80` | teljes branch név max hossza, szóhatáron csonkol |
| `prefix` | `''` | fix előtag, pl. `'feature/'` vagy `'kergesmate/'` |
| `stripLeadingTags` | `false` | a cím elejéről levágja a `[Tag]` blokkot |
| `altClickTemplate` | `git checkout -b {branch}` | mit adjon Alt + klikkre |
| `ai.enabled` | `true` | angol név generálás; `false` esetén mindig magyar |
| `ai.model` | `gemini-3.5-flash-lite` | ha az API 404-et ad rá, válassz aktuálisat a [Gemini modellek](https://ai.google.dev/gemini-api/docs/models) közül |
| `ai.maxWords` | `6` | kb. ennyi szó legyen a generált slug |
| `ai.cacheDays` | `365` | meddig tartsuk el a generált slugokat (0 = örökre) |
| `colors` | `#6c707e` / `#ff008c` | ikon alap- és hover színe |

## Hogyan találja meg a helyét

Ha egy YouTrack frissítés után elcsúszik a gomb, itt érdemes kezdeni:

- Az ikonsort a `[data-test~="issue-toolbar"]` szelektor adja. Ez stabilabb, mint
  a minified class nevek (`summaryToolbar__c90a7`), de nem örök életű.
- Hogy a gomb pontosan hova kerül az ikonsoron belül, azt a `resolveIconRow()`
  dönti el — a miértje ott van kommentben.
- A ticket címét a YouTrack REST API-ból kérjük le
  (`/api/issues/EHR-102?fields=summary`, session cookie-val), nem DOM-kaparással.
  Van DOM fallback, ha az API nem elérhető.
- Ha a `data-test` attribútum eltűnne, a gomb kimarad az ikonsorból, de a ticket
  azonosítók mellé továbbra is kikerül — a script használható marad, amíg valaki
  a szelektort javítja.

A megnyitott ticket azonosítója háromféle URL-ből jöhet — ha egy negyedik nézet
is előkerül, a `ID_PARAMS` tömbbe kell felvenni a query paramétert:

```
/issue/EHR-102
/agiles/198-7/current?issue=EHR-93
/issues?preview=EHR-102
```
