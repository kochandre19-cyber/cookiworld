// Baut alle Seiten der Cookisoft-Webseite aus daten/anbieter.json (Anbieter) und daten/apps.json (Apps), auf Deutsch und
// unter en/ auf Englisch. Die fertigen Seiten sind reines HTML (keine Skripte, keine Cookies).
//
//   /                 CookiWorld (index, datenschutz, impressum, support) – diese Adressen stehen in App Store Connect und
//                     im Eltern-Bereich der App und dürfen sich nicht ändern
//   /cookisoft/       Übersicht aller Apps, Impressum und Datenschutz der Webseite
//   /packandgo/       Pack & Go (index, datenschutz, impressum, support)
//   /pitchd/          Pitchd – von Hand geschrieben, wird hier nicht gebaut, nur geprüft
//   /en/…             dieselbe Struktur auf Englisch (Pitchd nur auf Deutsch)
//
// Der allgemeine Teil (Verantwortlicher, Webseite/Hosting, E-Mail-Kontakt, Rechte) steht einmal in ALLGEMEIN und wird in
// jede Datenschutzseite eingesetzt.
//
// Prüfungen (bei Fehlern wird nichts geschrieben, Exit-Code 1):
//   - Anbieterdaten und Marke gegen das Spielprojekt (../weltenwerkstatt, oder WW_SPIEL=…); fehlt es, nur ein Hinweis.
//   - CookiWorld-Seiten verweisen nur auf CookiWorld-Seiten (Kinder-Kategorie: kein Weg zu anderen Apps oder zur
//     Übersicht) und nennen keine andere App.
//   - Jeder Verweis innerhalb der Webseite zeigt auf eine vorhandene Datei.
//   - Pitchd-Seiten: Hinweis (kein Fehler), wenn Anschrift, E-Mail oder Telefon von daten/anbieter.json abweichen.
//
// Aufruf: node bauen.mjs            → prüfen, dann Seiten schreiben
//         node bauen.mjs --pruefen  → nur prüfen, ob die Seiten zu den Daten passen (Exit-Code 1, wenn nicht)
//         node bauen.mjs --vorschau → Vorschau mit Prüfvermerken nach vorschau/ (nicht im Repository)
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

process.chdir(dirname(fileURLToPath(import.meta.url)));
// --vorschau: Seiten mit sichtbaren Vermerken „noch rechtlich zu prüfen“ (Feld rechtlichZuPruefen in daten/apps.json)
// nach vorschau/ schreiben. Die veröffentlichten Seiten enthalten diese Vermerke nie.
const VORSCHAU = process.argv.includes('--vorschau');
const A = JSON.parse(readFileSync('daten/anbieter.json', 'utf8'));
const APPS = JSON.parse(readFileSync('daten/apps.json', 'utf8'));
for (const k of ['name', 'studio', 'strasse', 'plz', 'ort', 'email']) if (!(A[k] ?? '').trim()) throw new Error(`Pflichtfeld ${k} in daten/anbieter.json ist leer`);
const CW = APPS.cookiworld, PG = APPS.packandgo, PD = APPS.pitchd;
const STAND_SEITE = { de: '15. November 2026', en: '15 November 2026' };
// Später, wenn CookiWorld Käufe anbietet (StoreKit, nur im Eltern-Bereich): den Absatz „Käufe“ in datenschutz.html ersetzen
// (Käufe laufen über Apple; wir erhalten keine Zahlungs- oder Personendaten, nur die Information, welches Paket
// freigeschaltet ist) und auf support.html die Frage „Käufe wiederherstellen“ ergänzen. Erst dann, nicht vorher.

const fehler = [];
const hinweise = [];

// ---------- Gegenprüfung mit dem Spielprojekt ----------
const SPIEL = process.env.WW_SPIEL ?? join(homedir(), 'Code/weltenwerkstatt');
if (existsSync(join(SPIEL, 'src/info/anbieter.ts'))) {
  const quelle = readFileSync(join(SPIEL, 'src/info/anbieter.ts'), 'utf8');
  const feld = (k) => quelle.match(new RegExp(`\\b${k}: '([^']*)'`))?.[1];
  for (const k of ['name', 'strasse', 'plz', 'ort', 'email', 'telefon']) {
    const s = feld(k);
    if (s === undefined) fehler.push(`Spielprojekt: Feld ${k} fehlt in src/info/anbieter.ts`);
    else if (s !== (A[k] ?? '')) fehler.push(`Anbieter ${k}: daten/anbieter.json „${A[k] ?? ''}“ ≠ Spielprojekt „${s}“`);
  }
  const M = JSON.parse(readFileSync(join(SPIEL, 'src/config/marke.json'), 'utf8'));
  if (M.spiel !== CW.name) fehler.push(`CookiWorld-Name: daten/apps.json „${CW.name}“ ≠ marke.json „${M.spiel}“`);
  if (M.unterzeile !== CW.unterzeile.de) fehler.push(`CookiWorld-Unterzeile: daten/apps.json „${CW.unterzeile.de}“ ≠ marke.json „${M.unterzeile}“`);
  if (M.studio !== A.studio) fehler.push(`Studio: daten/anbieter.json „${A.studio}“ ≠ marke.json „${M.studio}“`);
} else hinweise.push(`Spielprojekt nicht gefunden (${SPIEL}) – Gegenprüfung der Anbieterdaten übersprungen`);

// ---------- Bausteine ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const t = (L, de, en) => (L === 'de' ? de : en);
const mail = `<a href="mailto:${esc(A.email)}">${esc(A.email)}</a>`;
const tel = (L) => (A.telefon?.trim() ? `<br>${t(L, 'Telefon', 'Phone')}: ${esc(A.telefon)}` : '');
const anschrift = (L) => `${esc(A.name)}<br>${esc(A.strasse)}<br>${esc(A.plz)} ${esc(A.ort)}${L === 'en' ? '<br>Germany' : ''}`;
const studio = esc(A.studio);

// Relativer Verweis von einer Seite auf eine andere (beide als Pfad ab Wurzel, z. B. „en/packandgo/support.html“).
function rel(von, nach) {
  let r = posix.relative(posix.dirname(von), nach);
  if (r === 'index.html') return './';
  if (r.endsWith('/index.html')) r = r.slice(0, -'index.html'.length);
  return r;
}
const sprachPfad = (L, pfad) => (L === 'en' ? `en/${pfad}` : pfad);

// Allgemeiner Teil jeder Datenschutzseite
const ALLGEMEIN = {
  verantwortlich: (L) => `<h2>${t(L, 'Verantwortlich', 'Controller')}</h2>
<address>${anschrift(L)}<br>${t(L, 'E-Mail', 'Email')}: ${mail}${tel(L)}</address>`,
  // kinder: Satz „Bitte keine Daten von Kindern schicken“ (CookiWorld)
  karte: (L, { kinder, stand }) => `<div class="karte">
<h2>${t(L, 'Diese Webseite', 'This website')}</h2>
<p>${t(L,
    'Diese Seiten liegen bei GitHub Pages, einem Dienst von GitHub, Inc. (USA). Beim Aufruf verarbeitet GitHub technisch bedingt Daten wie Ihre IP-Adresse, um die Seiten auszuliefern und vor Missbrauch zu schützen. Darauf haben wir keinen Zugriff. Wir selbst erheben auf dieser Webseite keine Daten: keine Cookies, keine Skripte, keine Analyse, keine eingebundenen Inhalte von anderen Anbietern. Mehr dazu in der <a href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement">Datenschutzerklärung von GitHub</a>.',
    'These pages are hosted on GitHub Pages, a service of GitHub, Inc. (USA). When you visit them, GitHub processes technically necessary data such as your IP address in order to deliver the pages and protect them against abuse. We have no access to this data. We ourselves collect no data on this website: no cookies, no scripts, no analytics, no embedded content from other providers. More in the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub Privacy Statement</a>.')}</p>
<h2>${t(L, 'Wenn Sie uns schreiben', 'If you write to us')}</h2>
<p>${t(L,
    'Schreiben Sie uns eine E-Mail, nutzen wir Ihre Adresse und Ihre Nachricht nur, um zu antworten. Unser Postfach liegt bei Gmail (Google); Google verarbeitet die Nachrichten dafür.',
    'If you send us an email, we use your address and your message only to reply. Our mailbox is hosted by Gmail (Google); Google processes the messages for this purpose.')}${kinder ? t(L, ' Bitte schicken Sie keine Daten von Kindern.', ' Please do not send us any data about children.') : ''}</p>
<h2>${t(L, 'Ihre Rechte', 'Your rights')}</h2>
<p>${t(L,
    `Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung Ihrer Daten sowie auf Widerspruch. Schreiben Sie uns dazu an ${mail}. Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren.`,
    `You have the right to access, rectification, erasure and restriction of processing of your data, and the right to object. To exercise these rights, write to us at ${mail}. You can also lodge a complaint with a data protection supervisory authority.`)}</p>
<p class="leise">${t(L, 'Stand', 'Last updated')}: ${stand[L]}</p>
</div>`,
};

// Kopf einer App-Seite (Symbol nur, wenn vorhanden)
const kopf = (L, pfad, app, ziel) => {
  const img = app.symbol ? `<img src="${rel(pfad, app.symbol.kopf)}" alt="" width="64" height="64">` : '';
  const klein = app.unterzeile ? `<small>${esc(app.unterzeile[L])}</small>` : '';
  return `<a class="kopf" href="${rel(pfad, ziel)}">${img}<span><b>${esc(app.name)}</b>${klein}</span></a>`;
};

function seite(L, pfad, { titel, beschreibung, symbol, kopfzeile, inhalt, fuss }) {
  const r = (z) => rel(pfad, z);
  const icons = symbol ? `\n<link rel="icon" type="image/png" href="${r(symbol.klein)}">\n<link rel="apple-touch-icon" href="${r(symbol.touch)}">` : '';
  const andere = L === 'de' ? `en/${pfad}` : pfad.slice(3);
  const sprache = L === 'de' ? `<a href="${r(andere)}" hreflang="en" lang="en">English</a>` : `<a href="${r(andere)}" hreflang="de" lang="de">Deutsch</a>`;
  return `<!doctype html>
<html lang="${L}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(beschreibung)}">
<meta name="robots" content="index, follow">
<link rel="stylesheet" href="${r('stil.css')}">${icons}
</head>
<body>
<main>
${kopfzeile}
${inhalt}
</main>
<footer>${fuss.map(([z, text]) => `<a href="${r(z)}">${text}</a>`).join(' · ')} · ${sprache}</footer>
</body>
</html>
`;
}

// Fußzeile einer App: nur eigene Seiten; uebersicht = Verweis auf /cookisoft/ (nie bei CookiWorld)
const appFuss = (L, app, { uebersicht }) => {
  const o = sprachPfad(L, app.ordner);
  return [
    [`${o}datenschutz.html`, t(L, 'Datenschutz', 'Privacy')],
    [`${o}impressum.html`, t(L, 'Impressum', 'Legal notice')],
    [`${o}support.html`, t(L, 'Hilfe &amp; Kontakt', 'Help &amp; contact')],
    ...(uebersicht ? [[sprachPfad(L, 'cookisoft/index.html'), t(L, `Alle Apps von ${studio}`, `All apps by ${studio}`)]] : []),
  ];
};

const SEITEN = {}; // Pfad → { app, html }
function neu(L, app, name, teile) {
  const pfad = sprachPfad(L, (app ? APPS[app].ordner : 'cookisoft/') + name);
  SEITEN[pfad] = { app, html: seite(L, pfad, teile(pfad)) };
}

// ---------- CookiWorld ----------
for (const L of ['de', 'en']) {
  const N = esc(CW.name);
  const k = (pfad) => kopf(L, pfad, CW, sprachPfad(L, 'index.html'));
  const basis = { symbol: CW.symbol, fuss: appFuss(L, CW, { uebersicht: false }) };

  neu(L, 'cookiworld', 'index.html', (p) => ({ ...basis, kopfzeile: k(p),
    titel: `${CW.name} – ${CW.unterzeile[L]}`,
    beschreibung: t(L, `${CW.name} ist ein Spiel für Kinder: eine eigene Welt bauen, einrichten und spielen.`, `${CW.name} is a game for children: build, furnish and play in your own world.`),
    inhalt: `
<div class="karte">
<div class="held"><img src="${rel(p, CW.symbol.gross)}" alt="${t(L, `Das Symbol von ${N}: ein rosa Häuschen und ein Baum unter einem Regenbogen`, `The ${N} icon: a pink little house and a tree under a rainbow`)}" width="112" height="112">
<div><h1>${N}</h1>
<p>${t(L, 'Ein Spiel für Kinder ab etwa 4 Jahren: Häuser einrichten, Figuren anziehen, Tiere versorgen, kochen und eigene Geschichten erfinden – ohne Zeitdruck und ohne Strafen.', 'A game for children from about 4 years: furnish houses, dress up characters, look after animals, cook and invent your own stories – without time pressure and without penalties.')}</p></div></div>
<p>${t(L, '<b>Für Eltern:</b> Keine Werbung, kein Konto, keine Datenübertragung. Das Spiel braucht kein Internet.', '<b>For parents:</b> No ads, no account, no data transfer. The game does not need the internet.')}</p>
<div class="knoepfe">
<a class="knopf haupt" href="${rel(p, sprachPfad(L, 'support.html'))}">${t(L, 'Hilfe &amp; Kontakt<small>Fragen, Wünsche, Fehler im Spiel</small>', 'Help &amp; contact<small>Questions, wishes, bugs in the game</small>')}</a>
<a class="knopf" href="${rel(p, sprachPfad(L, 'datenschutz.html'))}">${t(L, 'Datenschutz<small>Was mit Daten passiert – kurz gesagt: nichts</small>', 'Privacy<small>What happens to data – in short: nothing</small>')}</a>
<a class="knopf" href="${rel(p, sprachPfad(L, 'impressum.html'))}">${t(L, `Impressum<small>Wer hinter ${N} steht</small>`, `Legal notice<small>Who is behind ${N}</small>`)}</a>
</div>
</div>` }));

  neu(L, 'cookiworld', 'datenschutz.html', (p) => ({ ...basis, kopfzeile: k(p),
    titel: `${t(L, 'Datenschutz', 'Privacy')} – ${CW.name}`,
    beschreibung: t(L, `Datenschutzerklärung für die App ${CW.name} und diese Webseite.`, `Privacy policy for the app ${CW.name} and this website.`),
    inhalt: `
<div class="karte">
<h1>${t(L, 'Datenschutz', 'Privacy')}</h1>
<p>${t(L, `${N} ist ein Spiel für Kinder. Wir wollen keine Daten von Kindern und auch keine von Eltern.`, `${N} is a game for children. We do not want any data from children, nor from parents.`)}</p>
<h2>${t(L, 'Kurz gesagt', 'In short')}</h2>
<ul>
${t(L, `<li>${N} sammelt keine Daten.</li>
<li>Kein Konto, keine Anmeldung.</li>
<li>Keine Werbung, kein Tracking.</li>
<li>Kein Server: Das Spiel spricht mit niemandem im Internet.</li>
<li>Der Spielstand liegt auf dem Gerät – und in seinen Sicherungen, wenn Sie welche nutzen (z. B. iCloud).</li>`, `<li>${N} collects no data.</li>
<li>No account, no sign-in.</li>
<li>No ads, no tracking.</li>
<li>No server: the game does not talk to anyone on the internet.</li>
<li>The game progress stays on the device – and in its backups, if you use any (e.g. iCloud).</li>`)}
</ul>
${ALLGEMEIN.verantwortlich(L)}
</div>

<div class="karte">
<h2>${t(L, 'Die App', 'The app')}</h2>
${t(L, `<p><b>Was wir nicht tun:</b> Wir sammeln keine Daten. Es gibt kein Konto und keine Anmeldung. Es gibt keine Werbung, keine Analyse und kein Tracking. Das Spiel schickt nichts ins Internet und lädt nichts von dort.</p>
<p><b>Wo der Spielstand liegt:</b> Die gebauten Welten, die Sterne und die Einstellungen werden auf dem Gerät gespeichert, damit man weiterspielen kann. Eine Kopie liegt als Datei in der Dateien-App (Ordner „${N}“), damit Sie den Spielstand sichern können. Wie alle Daten auf dem Gerät kann er in Sicherungen landen, die Sie selbst eingerichtet haben, zum Beispiel ein iCloud-Backup oder eine Sicherung am Computer. Wir können den Spielstand nie sehen.</p>
<p><b>Was Apple uns gibt:</b> Wenn auf dem Gerät „Mit App-Entwicklern teilen“ eingeschaltet ist (Einstellungen → Datenschutz &amp; Sicherheit → Analyse &amp; Verbesserungen), schickt Apple uns Berichte über Abstürze, ohne Namen. Sie helfen uns, Fehler zu beheben. Wer die App vorab über TestFlight testet, dessen Name und E-Mail-Adresse sowie Rückmeldungen und Absturzberichte sieht Apple und zeigt sie uns; das betrifft nur eingeladene Tester, nicht die App aus dem App Store.</p>
<p><b>Käufe:</b> Die App enthält derzeit keine Käufe.</p>
<p><b>Löschen:</b> In der App unter „Optionen → Für Eltern“ lässt sich der Spielstand löschen. Wenn die App gelöscht wird, ist auch der Spielstand auf dem Gerät weg; Kopien in Ihren eigenen Sicherungen bleiben, bis Sie sie löschen.</p>`,
`<p><b>What we don’t do:</b> We collect no data. There is no account and no sign-in. There are no ads, no analytics and no tracking. The game sends nothing to the internet and loads nothing from it.</p>
<p><b>Where the game progress is stored:</b> The worlds you build, the stars and the settings are saved on the device so that you can keep playing. A copy is kept as a file in the Files app (folder “${N}”) so that you can back up the game progress. Like all data on the device, it can end up in backups you have set up yourself, for example an iCloud backup or a backup on your computer. We can never see the game progress.</p>
<p><b>What Apple shares with us:</b> If “Share With App Developers” is turned on on the device (Settings → Privacy &amp; Security → Analytics &amp; Improvements), Apple sends us crash reports without names. They help us fix bugs. If you test the app in advance via TestFlight, Apple sees your name and email address as well as your feedback and crash reports and shows them to us; this only applies to invited testers, not to the app from the App Store.</p>
<p><b>Purchases:</b> The app currently contains no purchases.</p>
<p><b>Deleting:</b> The game progress can be deleted in the app under “Optionen → Für Eltern” (Options → For parents). When the app is deleted, the game progress on the device is gone too; copies in your own backups remain until you delete them.</p>`)}
</div>

${ALLGEMEIN.karte(L, { kinder: true, stand: CW.stand })}` }));

  neu(L, 'cookiworld', 'impressum.html', (p) => ({ ...basis, kopfzeile: k(p),
    titel: `${t(L, 'Impressum', 'Legal notice')} – ${CW.name}`,
    beschreibung: t(L, `Impressum von ${CW.name}.`, `Legal notice for ${CW.name}.`),
    inhalt: `
<div class="karte">
<h1>${t(L, 'Impressum', 'Legal notice')}</h1>
<p>${t(L, `${N} ist ein Spiel von ${studio}.`, `${N} is a game by ${studio}.`)}</p>
<h2>${t(L, 'Angaben gemäß § 5 DDG', 'Information according to § 5 DDG (German Digital Services Act)')}</h2>
<address>${anschrift(L)}</address>
<h2>${t(L, 'Kontakt', 'Contact')}</h2>
<p>${t(L, 'E-Mail', 'Email')}: ${mail}${tel(L)}</p>
</div>` }));

  neu(L, 'cookiworld', 'support.html', (p) => ({ ...basis, kopfzeile: k(p),
    titel: `${t(L, 'Hilfe & Kontakt', 'Help & contact')} – ${CW.name}`,
    beschreibung: t(L, `Hilfe zu ${CW.name}: Kontakt und häufige Fragen.`, `Help for ${CW.name}: contact and frequently asked questions.`),
    inhalt: t(L, `
<div class="karte">
<h1>Hilfe &amp; Kontakt</h1>
<p>Fragen, Wünsche oder ein Fehler im Spiel? Schreiben Sie uns: ${mail}${tel(L)}</p>
<p class="leise">Bitte keine Daten von Kindern schicken. Hilfreich sind: Gerät (zum Beispiel iPad 10. Generation), iOS-Version und was vorher passiert ist.</p>
</div>

<div class="karte">
<h2>Häufige Fragen</h2>
<p><b>Wie sichere ich den Spielstand?</b><br>Die App legt den Spielstand zusätzlich als Datei „spielstand.json“ ab. Sie finden sie in der Dateien-App unter „Auf meinem iPad“ bzw. „Auf meinem iPhone“ im Ordner „${N}“. Von dort lässt sie sich zum Beispiel in iCloud Drive kopieren. Die Datei enthält alle drei Welten, die Sterne und die Rezepte.</p>
<p><b>Wie benenne ich eine Welt um oder lösche sie?</b><br>Auf dem Startbildschirm „Spielstände“ antippen. Bei jeder Welt gibt es einen Stift (umbenennen) und einen Papierkorb (löschen). Beides geht erst nach einer kleinen Rechenaufgabe, damit Kinder nichts aus Versehen löschen.</p>
<p><b>Wie lösche ich alles?</b><br>„Optionen → Für Eltern“ öffnen (Rechenaufgabe), dann „Spielstand löschen“. Danach sind alle drei Welten, die Sterne und die Rezepte gelöscht. Das lässt sich nicht rückgängig machen.</p>
<p><b>Braucht das Spiel Internet?</b><br>Nein. ${N} läuft ohne Internet und schickt nichts weg.</p>
</div>`, `
<div class="karte">
<h1>Help &amp; contact</h1>
<p>Questions, wishes or a bug in the game? Write to us: ${mail}${tel(L)}</p>
<p class="leise">Please do not send any data about children. Helpful details: device (for example iPad 10th generation), iOS version and what happened before.</p>
</div>

<div class="karte">
<h2>Frequently asked questions</h2>
<p><b>How do I back up the game progress?</b><br>The app also saves the game progress as a file “spielstand.json”. You can find it in the Files app under “On My iPad” or “On My iPhone” in the folder “${N}”. From there you can copy it, for example, to iCloud Drive. The file contains all three worlds, the stars and the recipes.</p>
<p><b>How do I rename or delete a world?</b><br>On the start screen, tap “Spielstände” (saved games). Each world has a pencil (rename) and a bin (delete). Both only work after a small sum, so that children don’t delete anything by accident.</p>
<p><b>How do I delete everything?</b><br>Open “Optionen → Für Eltern” (Options → For parents, after a small sum), then “Spielstand löschen” (delete game progress). All three worlds, the stars and the recipes are then deleted. This cannot be undone.</p>
<p><b>Does the game need the internet?</b><br>No. ${N} runs without the internet and sends nothing anywhere.</p>
</div>`) }));
}

// ---------- Pack & Go ----------
for (const L of ['de', 'en']) {
  const N = esc(PG.name);
  const k = (pfad) => kopf(L, pfad, PG, sprachPfad(L, `${PG.ordner}index.html`));
  const basis = { symbol: PG.symbol, fuss: appFuss(L, PG, { uebersicht: true }) };
  const o = sprachPfad(L, PG.ordner);
  // Sichtbarer Vermerk an Absätzen, die noch nicht rechtlich geprüft sind; nach der Prüfung in daten/apps.json
  // „rechtlichZuPruefen“ auf false setzen.
  const vermerk = VORSCHAU && PG.rechtlichZuPruefen ?` <span class="pruefen">${t(L, 'noch rechtlich zu prüfen', 'legal review pending')}</span>` : '';
  const analyse = PG.analyse?.length
    ? `<p><b>${t(L, 'Analyse:', 'Analytics:')}</b> ${t(L, 'Wir setzen folgende Analyse-Dienste ein:', 'We use the following analytics services:')}</p>
<ul>
${PG.analyse.map((d) => `<li><b>${esc(d.name)}</b> (${esc(d.anbieter)}): ${esc(d.zweck[L])}${d.datenschutz ? ` <a href="${esc(d.datenschutz)}">${t(L, 'Datenschutzerklärung', 'Privacy policy')}</a>` : ''}</li>`).join('\n')}
</ul>`
    : `<p><b>${t(L, 'Analyse:', 'Analytics:')}</b> ${t(L, 'Derzeit setzen wir keine Analyse-Dienste ein.', 'We currently use no analytics services.')}</p>`;
  // Die App ist nur auf Deutsch: in der englischen Fassung deutsche Bezeichnungen mit Übersetzung in Klammern
  const loeschen = t(L,
    'In der App: Zahnrad (Einstellungen) → „Spielstand zurücksetzen“. Alternativ die App löschen, alle Daten liegen nur auf dem Gerät. Käufe bleiben bei Apple und lassen sich über „Käufe wiederherstellen“ zurückholen.',
    'In the app: gear icon (Settings) → “Spielstand zurücksetzen” (Reset progress). Alternatively delete the app, all data is stored only on the device. Purchases stay with Apple and can be restored via “Käufe wiederherstellen” (Restore purchases).');

  neu(L, 'packandgo', 'index.html', (p) => ({ ...basis, kopfzeile: k(p),
    titel: PG.name,
    beschreibung: PG.beschreibung[L],
    inhalt: `
<div class="karte">
<div class="held"><img src="${rel(p, PG.symbol.gross)}" alt="${t(L, `Das Symbol von ${N}`, `The ${N} icon`)}" width="112" height="112">
<div><h1>${N}</h1>
<p>${esc(PG.beschreibung[L])}</p>
<p class="leise">${t(L, `Eine App von ${studio}.`, `An app by ${studio}.`)}</p></div></div>
<div class="knoepfe">
<a class="knopf haupt" href="${rel(p, `${o}support.html`)}">${t(L, 'Hilfe &amp; Kontakt<small>Fragen, Wünsche, Fehler</small>', 'Help &amp; contact<small>Questions, wishes, bugs</small>')}</a>
<a class="knopf" href="${rel(p, `${o}datenschutz.html`)}">${t(L, 'Datenschutz<small>Was mit Daten passiert</small>', 'Privacy<small>What happens to data</small>')}</a>
<a class="knopf" href="${rel(p, `${o}impressum.html`)}">${t(L, `Impressum<small>Wer hinter ${N} steht</small>`, `Legal notice<small>Who is behind ${N}</small>`)}</a>
</div>
</div>` }));

  neu(L, 'packandgo', 'datenschutz.html', (p) => ({ ...basis, kopfzeile: k(p),
    titel: `${t(L, 'Datenschutz', 'Privacy')} – ${PG.name}`,
    beschreibung: t(L, `Datenschutzerklärung für die App ${PG.name} und diese Webseite.`, `Privacy policy for the app ${PG.name} and this website.`),
    inhalt: `
<div class="karte">
<h1>${t(L, 'Datenschutz', 'Privacy')}</h1>
<h2>${t(L, 'Kurz gesagt', 'In short')}</h2>
<ul>
${t(L, `<li>Kein Benutzerkonto, keine Anmeldung, kein eigener Server.</li>
<li>Spielstand, Münzen und Einstellungen werden nur auf dem Gerät gespeichert.</li>
<li>Werbung über Google AdMob, nur nicht-personalisiert. In der EU wird vorher nach Ihrer Einwilligung gefragt.</li>
<li>Keine Abfrage nach App-Tracking-Transparenz, keine Nutzung der Werbe-ID (IDFA).</li>
<li>Käufe laufen vollständig über Apple. Wir erhalten keine Zahlungsdaten.</li>`, `<li>No user account, no sign-in, no server of our own.</li>
<li>Game progress, coins and settings are stored only on the device.</li>
<li>Ads via Google AdMob, non-personalised only. In the EU, you are asked for your consent first.</li>
<li>No App Tracking Transparency prompt, no use of the advertising identifier (IDFA).</li>
<li>Purchases are handled entirely by Apple. We receive no payment data.</li>`)}
</ul>
${ALLGEMEIN.verantwortlich(L)}
</div>

<div class="karte">
<h2>${t(L, 'Die App', 'The app')}</h2>
${t(L, `<p><b>Wo Ihre Daten liegen:</b> ${N} hat kein Benutzerkonto, keine Anmeldung und keinen eigenen Server. Spielstand, Münzen und Einstellungen werden nur lokal auf dem Gerät gespeichert.</p>
<p><b>Werbung:</b> ${N} zeigt Werbung über Google AdMob, einen Dienst der Google Ireland Limited: Belohnungsvideos, die Sie freiwillig ansehen, und Zwischenwerbung. Die App fordert ausschließlich nicht-personalisierte Werbung an. Google erhält dafür Daten, um die Werbung auszuliefern, ihre Reichweite zu messen und vor Betrug zu schützen, unter anderem Ihre IP-Adresse, Informationen über Gerät und App sowie Ihre Interaktionen mit der Werbung. Mehr dazu bei Google: <a href="https://policies.google.com/technologies/partner-sites?hl=de">Wie Google Daten von Websites und Apps verwendet, die Google-Dienste nutzen</a>.</p>
<p><b>Ihre Einwilligung:</b> Auch für nicht-personalisierte Werbung werden Informationen auf Ihrem Gerät gespeichert oder ausgelesen, zum Beispiel um zu begrenzen, wie oft dieselbe Werbung erscheint, und für zusammengefasste Auswertungen. Dafür fragt die App in der EU vorher über den Einwilligungsdialog von Google (User Messaging Platform, UMP) nach Ihrer Einwilligung. Der Einwilligungsdialog ist Googles Standarddialog (IAB TCF) und nennt allgemeine Zwecke, unter anderem personalisierte Werbung. ${N} fordert unabhängig von Ihrer Auswahl ausschließlich nicht-personalisierte Anzeigen an. Ohne diese Einwilligung liefert Google höchstens eingeschränkte Werbung aus, ohne Funktionen, die eine Kennung auf dem Gerät brauchen. Ihre Einwilligung können Sie jederzeit in der App unter „Einstellungen → Datenschutz-Einstellungen“ ändern.</p>
<p><b>Rechtsgrundlage:</b>${vermerk} Für Werbung, in die Sie eingewilligt haben, ist Ihre Einwilligung die Rechtsgrundlage (Art. 6 Abs. 1 lit. a DSGVO); soweit dafür Informationen auf Ihrem Gerät gespeichert oder ausgelesen werden, ebenfalls Ihre Einwilligung (§ 25 Abs. 1 TDDDG). Sie können die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, wie oben beschrieben.</p>
<p><b>Übermittlung in die USA:</b>${vermerk} Google kann Daten auch in die USA übermitteln und dort verarbeiten. Einzelheiten nennt Google in seiner <a href="https://policies.google.com/privacy?hl=de">Datenschutzerklärung</a>.</p>
<p><b>Werbe-ID:</b> Die App fragt nicht nach App-Tracking-Transparenz und nutzt die Werbe-ID Ihres Geräts (IDFA) nicht.</p>
<p><b>Käufe:</b> Münzpakete und „Werbung entfernen“ laufen vollständig über Apple. Wir erhalten keine Zahlungsdaten.</p>
<p><b>Spielstand löschen:</b> ${loeschen}</p>
${analyse}
<p><b>Was Apple uns gibt:</b> Wenn auf dem Gerät „Mit App-Entwicklern teilen“ eingeschaltet ist (Einstellungen → Datenschutz &amp; Sicherheit → Analyse &amp; Verbesserungen), stellt Apple uns anonyme Absturz- und Nutzungsdaten bereit. Sie helfen uns, Fehler zu beheben.</p>`,
`<p><b>Where your data is stored:</b> ${N} has no user account, no sign-in and no server of our own. Game progress, coins and settings are stored only locally on the device.</p>
<p><b>Ads:</b> ${N} shows ads via Google AdMob, a service of Google Ireland Limited: rewarded videos, which you watch voluntarily, and interstitial ads. The app requests non-personalised ads only. For this, Google receives data to deliver the ads, measure their reach and protect against fraud, including your IP address, information about the device and the app, and your interactions with the ads. More from Google: <a href="https://policies.google.com/technologies/partner-sites?hl=en">How Google uses information from sites or apps that use its services</a>.</p>
<p><b>Your consent:</b> Even non-personalised ads require information to be stored on or read from your device, for example to limit how often the same ad appears and for aggregated reporting. For this, in the EU the app first asks for your consent via Google’s consent dialog (User Messaging Platform, UMP). The consent dialog is Google’s standard dialog (IAB TCF) and lists general purposes, including personalised advertising. Regardless of your choices, ${N} requests non-personalised ads only. Without this consent, Google delivers limited ads at most, without features that need an identifier on the device. You can change your consent at any time in the app under “Einstellungen → Datenschutz-Einstellungen” (Settings → Privacy settings).</p>
<p><b>Legal basis:</b>${vermerk} For ads you have consented to, the legal basis is your consent (Art. 6(1)(a) GDPR); where information is stored on or read from your device for this purpose, it is also your consent (§ 25(1) TDDDG, German Telecommunications Digital Services Data Protection Act). You can withdraw your consent at any time with effect for the future, as described above.</p>
<p><b>Transfer to the USA:</b>${vermerk} Google may also transfer data to the USA and process it there. Google gives details in its <a href="https://policies.google.com/privacy?hl=en">Privacy Policy</a>.</p>
<p><b>Advertising identifier:</b> The app does not show the App Tracking Transparency prompt and does not use your device’s advertising identifier (IDFA).</p>
<p><b>Purchases:</b> Coin packs and “Werbung entfernen” (Remove ads) are handled entirely by Apple. We receive no payment data.</p>
<p><b>Deleting your progress:</b> ${loeschen}</p>
${analyse}
<p><b>What Apple shares with us:</b> If “Share With App Developers” is turned on on the device (Settings → Privacy &amp; Security → Analytics &amp; Improvements), Apple provides us with anonymous crash and usage data. It helps us fix bugs.</p>`)}
</div>

${ALLGEMEIN.karte(L, { kinder: false, stand: PG.stand })}` }));

  neu(L, 'packandgo', 'impressum.html', (p) => ({ ...basis, kopfzeile: k(p),
    titel: `${t(L, 'Impressum', 'Legal notice')} – ${PG.name}`,
    beschreibung: t(L, `Impressum von ${PG.name}.`, `Legal notice for ${PG.name}.`),
    inhalt: `
<div class="karte">
<h1>${t(L, 'Impressum', 'Legal notice')}</h1>
<p>${t(L, `${N} ist eine App von ${studio}.`, `${N} is an app by ${studio}.`)}</p>
<h2>${t(L, 'Angaben gemäß § 5 DDG', 'Information according to § 5 DDG (German Digital Services Act)')}</h2>
<address>${anschrift(L)}</address>
<h2>${t(L, 'Kontakt', 'Contact')}</h2>
<p>${t(L, 'E-Mail', 'Email')}: ${mail}${tel(L)}</p>
</div>` }));

  neu(L, 'packandgo', 'support.html', (p) => ({ ...basis, kopfzeile: k(p),
    titel: `${t(L, 'Hilfe & Kontakt', 'Help & contact')} – ${PG.name}`,
    beschreibung: t(L, `Hilfe zu ${PG.name}: Kontakt.`, `Help for ${PG.name}: contact.`),
    inhalt: `
<div class="karte">
<h1>${t(L, 'Hilfe &amp; Kontakt', 'Help &amp; contact')}</h1>
<p>${t(L, 'Fragen, Wünsche oder ein Fehler? Schreiben Sie uns:', 'Questions, wishes or a bug? Write to us:')} ${mail}${tel(L)}</p>
<p class="leise">${t(L, 'Hilfreich sind: Gerät (zum Beispiel iPhone 15), iOS-Version und was vorher passiert ist.', 'Helpful details: device (for example iPhone 15), iOS version and what happened before.')}</p>
</div>

<div class="karte">
<h2>${t(L, 'Häufige Fragen', 'Frequently asked questions')}</h2>
<p><b>${t(L, 'Wie lösche ich meinen Spielstand?', 'How do I delete my progress?')}</b><br>${loeschen}</p>
</div>` }));
}

// ---------- Cookisoft-Übersicht ----------
for (const L of ['de', 'en']) {
  const o = sprachPfad(L, 'cookisoft/');
  const k = (p) => `<a class="kopf" href="${rel(p, `${o}index.html`)}"><span><b>${studio}</b><small>${t(L, `Apps von ${esc(A.name)}`, `Apps by ${esc(A.name)}`)}</small></span></a>`;
  const fuss = [[`${o}datenschutz.html`, t(L, 'Datenschutz', 'Privacy')], [`${o}impressum.html`, t(L, 'Impressum', 'Legal notice')]];
  // Pitchd gibt es nur auf Deutsch
  const ziel = { cookiworld: sprachPfad(L, 'index.html'), packandgo: sprachPfad(L, `${PG.ordner}index.html`), pitchd: `${PD.ordner}index.html` };
  const dsZiel = { cookiworld: sprachPfad(L, 'datenschutz.html'), packandgo: sprachPfad(L, `${PG.ordner}datenschutz.html`), pitchd: `${PD.ordner}datenschutz.html` };
  const nurDe = (id) => (L === 'en' && APPS[id].handgeschrieben ? ' (in German)' : '');

  neu(L, null, 'index.html', (p) => ({ symbol: null, kopfzeile: k(p), fuss,
    titel: t(L, `${A.studio} – Apps von ${A.name}`, `${A.studio} – apps by ${A.name}`),
    beschreibung: t(L, `Die Apps von ${A.studio}: ${Object.values(APPS).map((a) => a.name).join(', ')}.`, `The apps by ${A.studio}: ${Object.values(APPS).map((a) => a.name).join(', ')}.`),
    inhalt: `
<div class="karte">
<h1>${studio}</h1>
<p>${t(L, `Hinter ${studio} steht ${esc(A.name)} aus ${esc(A.ort)}. Hier finden Sie die Apps und zu jeder App Hilfe, Datenschutz und Impressum.`, `${studio} is ${esc(A.name)} from ${esc(A.ort)}, Germany. Here you will find the apps and, for each app, help, privacy and legal notice.`)}</p>
<h2>${t(L, 'Die Apps', 'The apps')}</h2>
<div class="knoepfe">
${Object.entries(APPS).map(([id, a]) => {
    const unter = a.beschreibung?.[L] ?? a.unterzeile?.[L];
    const bild = a.symbol?.kopf ? `<img src="${rel(p, a.symbol.kopf)}" alt="" width="56" height="56">` : '';
    return `<a class="knopf mit-bild" href="${rel(p, ziel[id])}">${bild}<span>${esc(a.name)}${nurDe(id)}${unter ? `<small>${esc(unter)}</small>` : ''}</span></a>`;
  }).join('\n')}
</div>
</div>` }));

  neu(L, null, 'impressum.html', (p) => ({ symbol: null, kopfzeile: k(p), fuss,
    titel: `${t(L, 'Impressum', 'Legal notice')} – ${A.studio}`,
    beschreibung: t(L, `Impressum von ${A.studio}.`, `Legal notice for ${A.studio}.`),
    inhalt: `
<div class="karte">
<h1>${t(L, 'Impressum', 'Legal notice')}</h1>
<h2>${t(L, 'Angaben gemäß § 5 DDG', 'Information according to § 5 DDG (German Digital Services Act)')}</h2>
<address>${anschrift(L)}</address>
<h2>${t(L, 'Kontakt', 'Contact')}</h2>
<p>${t(L, 'E-Mail', 'Email')}: ${mail}${tel(L)}</p>
</div>` }));

  neu(L, null, 'datenschutz.html', (p) => ({ symbol: null, kopfzeile: k(p), fuss,
    titel: `${t(L, 'Datenschutz', 'Privacy')} – ${A.studio}`,
    beschreibung: t(L, `Datenschutzerklärung für die Webseite von ${A.studio}.`, `Privacy policy for the ${A.studio} website.`),
    inhalt: `
<div class="karte">
<h1>${t(L, 'Datenschutz', 'Privacy')}</h1>
<p>${t(L, 'Diese Erklärung gilt für die Webseite. Für jede App gibt es eine eigene Datenschutzerklärung:', 'This policy applies to the website. Each app has its own privacy policy:')}</p>
<ul>
${Object.entries(APPS).map(([id, a]) => `<li><a href="${rel(p, dsZiel[id])}">${esc(a.name)}</a>${nurDe(id)}</li>`).join('\n')}
</ul>
${ALLGEMEIN.verantwortlich(L)}
</div>

${ALLGEMEIN.karte(L, { kinder: false, stand: STAND_SEITE })}` }));
}

// ---------- Prüfungen ----------
const BASIS = 'https://seite.invalid/';
const EIGENE_HOSTS = ['kochandre19-cyber.github.io', 'pitchd-app.de', 'www.pitchd-app.de'];
const cwSeiten = new Set(Object.entries(SEITEN).filter(([, s]) => s.app === 'cookiworld').map(([p]) => p));
const cwDateien = (z) => cwSeiten.has(z) || z === 'stil.css' || z === 'apple-touch-icon.png' || z.startsWith('bilder/');
const andereApps = Object.entries(APPS).filter(([id]) => id !== 'cookiworld').map(([, a]) => a.name);

for (const [pfad, { app, html }] of Object.entries(SEITEN)) {
  for (const [, ziel] of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    const u = new URL(ziel.replace(/&amp;/g, '&'), BASIS + pfad);
    if (u.protocol === 'mailto:') continue;
    if (u.origin + '/' !== BASIS) {
      if (app === 'cookiworld' && EIGENE_HOSTS.includes(u.hostname)) fehler.push(`${pfad}: CookiWorld-Seite verweist auf eigene Webseite über volle Adresse (${ziel})`);
      continue;
    }
    let z = decodeURIComponent(u.pathname.slice(1));
    if (z === '' || z.endsWith('/')) z += 'index.html';
    const erzeugt = Object.values(APPS).some((a) => a.symbol?.quelle && ['klein', 'touch', 'kopf', 'gross'].some((g) => a.symbol[g] === z));
    if (!SEITEN[z] && !existsSync(z) && !erzeugt) fehler.push(`${pfad}: Verweis auf fehlende Datei ${ziel} (${z})`);
    if (app === 'cookiworld' && !cwDateien(z)) fehler.push(`${pfad}: CookiWorld-Seite verweist auf ${z} – erlaubt sind nur CookiWorld-Seiten`);
  }
  if (app === 'cookiworld') for (const n of andereApps) if (html.includes(n) || html.includes(esc(n))) fehler.push(`${pfad}: CookiWorld-Seite nennt ${n}`);
  if (/CookiSoft/.test(html)) fehler.push(`${pfad}: Schreibweise „CookiSoft“ – richtig ist „Cookisoft“`);
}

// Pitchd (von Hand geschrieben): nur Hinweise
for (const [datei, erwartet] of [
  ['datenschutz.html', { 'E-Mail': A.email, Straße: A.strasse, Ort: `${A.plz} ${A.ort}` }],
  ['impressum.html', { 'E-Mail': A.email, Straße: A.strasse, Ort: `${A.plz} ${A.ort}`, Telefon: A.telefon }],
  ['support.html', { 'E-Mail': A.email }],
]) {
  const p = `${PD.ordner}${datei}`;
  let html = '';
  try { html = readFileSync(p, 'utf8'); } catch { hinweise.push(`${p} fehlt`); continue; }
  for (const [was, wert] of Object.entries(erwartet)) if (wert && !html.includes(esc(wert)) && !html.includes(wert)) hinweise.push(`${p}: ${was} „${wert}“ aus daten/anbieter.json fehlt – Seite von Hand angleichen`);
}

for (const h of hinweise) console.warn(`Hinweis: ${h}`);
if (fehler.length) { for (const f of fehler) console.error(`✗ ${f}`); process.exit(1); }

// ---------- App-Symbole ----------
// Aus der Quelle (symbol.quelle, 1024 × 1024) werden die üblichen Größen erzeugt (macOS „sips“). Austausch des Symbols:
// nur die Quelldatei ersetzen und node bauen.mjs ausführen. --pruefen prüft nur, ob die Größen vorhanden sind und stimmen.
const GROESSEN = { klein: 96, touch: 180, kopf: 192, gross: 512 };
const pixel = (f) => execFileSync('sips', ['-g', 'pixelWidth', f], { encoding: 'utf8' }).match(/pixelWidth: (\d+)/)?.[1];
for (const app of Object.values(APPS)) {
  const q = app.symbol?.quelle;
  if (!q) continue;
  if (!existsSync(q)) { console.error(`✗ Symbol-Quelle ${q} fehlt`); process.exit(1); }
  for (const [k, px] of Object.entries(GROESSEN)) {
    const ziel = app.symbol[k];
    if (process.argv.includes('--pruefen')) {
      if (!existsSync(ziel) || pixel(ziel) !== String(px)) { console.error(`✗ ${ziel} fehlt oder hat nicht ${px} px – node bauen.mjs ausführen`); process.exit(1); }
    } else execFileSync('sips', ['-z', String(px), String(px), q, '--out', ziel], { stdio: 'ignore' });
  }
}

// ---------- Schreiben bzw. Vergleichen ----------
if (VORSCHAU) {
  // Lokale Vorschau mit Prüfvermerken in vorschau/ (nicht im Repository), dazu die festen Dateien
  rmSync('vorschau', { recursive: true, force: true });
  for (const f of ['stil.css', 'apple-touch-icon.png', 'bilder', 'pitchd', 'packandgo/bilder']) cpSync(f, `vorschau/${f}`, { recursive: true });
  for (const [datei, { html }] of Object.entries(SEITEN)) { mkdirSync(dirname(`vorschau/${datei}`), { recursive: true }); writeFileSync(`vorschau/${datei}`, html); }
  const offen = Object.entries(SEITEN).filter(([, s]) => s.html.includes('class="pruefen"')).map(([p]) => p);
  console.log(`Vorschau in vorschau/ geschrieben (${Object.keys(SEITEN).length} Seiten). Ansehen: python3 -m http.server 8000 --bind 127.0.0.1 -d vorschau`);
  console.log(offen.length ? `Noch rechtlich zu prüfen: ${offen.join(', ')}` : 'Keine offenen Prüfvermerke.');
  process.exit(0);
}
const pruefen = process.argv.includes('--pruefen');
let falsch = 0;
for (const [datei, { html }] of Object.entries(SEITEN)) {
  if (html.includes('class="pruefen"')) { console.error(`✗ ${datei}: Prüfvermerk in veröffentlichter Seite`); process.exit(1); }
  if (pruefen) { let alt = ''; try { alt = readFileSync(datei, 'utf8'); } catch { /* fehlt */ } if (alt !== html) { console.error(`✗ ${datei} passt nicht zu den Daten – node bauen.mjs ausführen`); falsch++; } }
  else { mkdirSync(dirname(datei), { recursive: true }); writeFileSync(datei, html); }
}
if (pruefen) { if (falsch) process.exit(1); console.log(`✓ ${Object.keys(SEITEN).length} Seiten passen zu daten/anbieter.json und daten/apps.json`); }
else console.log(`${Object.keys(SEITEN).length} Seiten geschrieben (${A.name}, ${A.email}${A.telefon ? ', Telefon' : ', ohne Telefon'})`);
