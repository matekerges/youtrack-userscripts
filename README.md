# youtrack-userscripts

Userscriptek a [YouTrack](https://fotexnet.youtrack.cloud)-hoz.

## youtrack-branch-name.user.js

Egy kattintással git branch nevet másol a vágólapra a ticket azonosítójából és
címéből:

```
EHR-102 · "Új jelenléti ív nem hozható létre"
        → ehr-102-uj-jelenleti-iv-nem-hozhato-letre
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
3. Fenti telepítő link → Install.

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
| `lowercaseId` | `true` | `ehr-102-…` vs `EHR-102-…` |
| `stripLeadingTags` | `false` | a cím elejéről levágja a `[Tag]` blokkot |
| `altClickTemplate` | `git checkout -b {branch}` | mit adjon Alt + klikkre |
| `colors` | `#6c707e` / `#ff008c` | ikon alap- és hover színe |

## Hogyan találja meg a helyét

Ha egy YouTrack frissítés után elcsúszik a gomb, itt érdemes kezdeni:

- Az ikonsort a `[data-test~="issue-toolbar"]` szelektor adja. Ez stabilabb, mint
  a minified class nevek (`summaryToolbar__c90a7`), de nem örök életű.
- A gomb **nem** ebbe az elembe kerül: az egy `space-between`-es flex konténer,
  abban a gomb és a többi ikon a két szélére ugrana szét. Helyette a sor első
  ikonjától (a ceruzától) felfelé keressük az első olyan őst, amiben legalább két
  ikongomb van — az a valódi ikonsor.
- A ceruza közvetlen szülője sem jó: az a Ring UI tooltip-wrappere, abban ülve a
  mi gombunk hoverére is az „Edit issue" tooltip jönne fel.
- A ticket címét a YouTrack REST API-ból kérjük le
  (`/api/issues/EHR-102?fields=summary`, session cookie-val), nem DOM-kaparással.
  Van DOM fallback, ha az API nem elérhető.
- Ha a `data-test` attribútum eltűnne, van egy heurisztikus fallback ág is, ami a
  cím mellől keresi meg az ikonsort.

A megnyitott ticket azonosítója háromféle URL-ből jöhet — ha egy negyedik nézet
is előkerül, a `ID_PARAMS` tömbbe kell felvenni a query paramétert:

```
/issue/EHR-102
/agiles/198-7/current?issue=EHR-93
/issues?preview=EHR-102
```
