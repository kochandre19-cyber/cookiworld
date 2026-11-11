// Baut die vier Seiten (index, datenschutz, impressum, support) aus den Daten des Spielprojekts, damit beide Stellen
// übereinstimmen: Anbieterdaten aus ../weltenwerkstatt/src/info/anbieter.ts, Name und Studio aus
// ../weltenwerkstatt/src/config/marke.json. Die fertigen Seiten sind reines HTML (keine Skripte, keine Cookies).
// Aufruf: node bauen.mjs            → Seiten schreiben
//         node bauen.mjs --pruefen  → nur prüfen, ob die Seiten zu den Daten passen (Exit-Code 1, wenn nicht)
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SPIEL = process.env.WW_SPIEL ?? join(homedir(), 'Code/weltenwerkstatt');
const quelle = readFileSync(join(SPIEL, 'src/info/anbieter.ts'), 'utf8');
const feld = (k) => { const m = quelle.match(new RegExp(`\\b${k}: '([^']*)'`)); if (!m) throw new Error(`Feld ${k} fehlt in anbieter.ts`); return m[1]; };
const A = { name: feld('name'), strasse: feld('strasse'), plz: feld('plz'), ort: feld('ort'), email: feld('email'), telefon: feld('telefon') };
for (const k of ['name', 'strasse', 'plz', 'ort', 'email']) if (!A[k].trim()) throw new Error(`Pflichtfeld ${k} ist leer`);
const M = JSON.parse(readFileSync(join(SPIEL, 'src/config/marke.json'), 'utf8'));
const STAND = '25. Oktober 2026';
// Später, wenn die App Käufe anbietet (StoreKit, nur im Eltern-Bereich): den Absatz „Käufe“ in datenschutz.html ersetzen
// (Käufe laufen über Apple; wir erhalten keine Zahlungs- oder Personendaten, nur die Information, welches Paket
// freigeschaltet ist) und auf support.html die Frage „Käufe wiederherstellen“ ergänzen. Erst dann, nicht vorher.

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mail = `<a href="mailto:${esc(A.email)}">${esc(A.email)}</a>`;
const tel = A.telefon.trim() ? `<br>Telefon: ${esc(A.telefon)}` : '';
const anschrift = `${esc(A.name)}<br>${esc(A.strasse)}<br>${esc(A.plz)} ${esc(A.ort)}`;

function seite(datei, titel, beschreibung, inhalt) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(beschreibung)}">
<meta name="robots" content="index, follow">
<link rel="stylesheet" href="stil.css">
<link rel="icon" type="image/png" href="bilder/symbol-96.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
</head>
<body>
<main>
<a class="kopf" href="./"><img src="bilder/symbol-192.png" alt="" width="64" height="64"><span><b>${esc(M.spiel)}</b><small>${esc(M.unterzeile)}</small></span></a>
${inhalt}
</main>
<footer><a href="datenschutz.html">Datenschutz</a> · <a href="impressum.html">Impressum</a> · <a href="support.html">Hilfe &amp; Kontakt</a></footer>
</body>
</html>
`;
}

const SEITEN = {
  'index.html': seite('index.html', `${M.spiel} – ${M.unterzeile}`, `${M.spiel} ist ein Spiel für Kinder: eine eigene Welt bauen, einrichten und spielen.`, `
<div class="karte">
<div class="held"><img src="bilder/symbol-512.png" alt="Das Symbol von ${esc(M.spiel)}: ein rosa Häuschen und ein Baum unter einem Regenbogen" width="112" height="112">
<div><h1>${esc(M.spiel)}</h1>
<p>Ein Spiel für Kinder ab etwa 4 Jahren: Häuser einrichten, Figuren anziehen, Tiere versorgen, kochen und eigene Geschichten erfinden – ohne Zeitdruck und ohne Strafen.</p></div></div>
<p><b>Für Eltern:</b> Keine Werbung, kein Konto, keine Datenübertragung. Das Spiel braucht kein Internet.</p>
<div class="knoepfe">
<a class="knopf haupt" href="support.html">Hilfe &amp; Kontakt<small>Fragen, Wünsche, Fehler im Spiel</small></a>
<a class="knopf" href="datenschutz.html">Datenschutz<small>Was mit Daten passiert – kurz gesagt: nichts</small></a>
<a class="knopf" href="impressum.html">Impressum<small>Wer hinter ${esc(M.spiel)} steht</small></a>
</div>
</div>`),

  'datenschutz.html': seite('datenschutz.html', `Datenschutz – ${M.spiel}`, `Datenschutzerklärung für die App ${M.spiel} und diese Webseite.`, `
<div class="karte">
<h1>Datenschutz</h1>
<p>${esc(M.spiel)} ist ein Spiel für Kinder. Wir wollen keine Daten von Kindern und auch keine von Eltern.</p>
<h2>Kurz gesagt</h2>
<ul>
<li>${esc(M.spiel)} sammelt keine Daten.</li>
<li>Kein Konto, keine Anmeldung.</li>
<li>Keine Werbung, kein Tracking.</li>
<li>Kein Server: Das Spiel spricht mit niemandem im Internet.</li>
<li>Der Spielstand liegt auf dem Gerät – und in seinen Sicherungen, wenn Sie welche nutzen (z. B. iCloud).</li>
</ul>
<h2>Verantwortlich</h2>
<address>${anschrift}<br>E-Mail: ${mail}${tel}</address>
</div>

<div class="karte">
<h2>Die App</h2>
<p><b>Was wir nicht tun:</b> Wir sammeln keine Daten. Es gibt kein Konto und keine Anmeldung. Es gibt keine Werbung, keine Analyse und kein Tracking. Das Spiel schickt nichts ins Internet und lädt nichts von dort.</p>
<p><b>Wo der Spielstand liegt:</b> Die gebauten Welten, die Sterne und die Einstellungen werden auf dem Gerät gespeichert, damit man weiterspielen kann. Eine Kopie liegt als Datei in der Dateien-App (Ordner „${esc(M.spiel)}“), damit Sie den Spielstand sichern können. Wie alle Daten auf dem Gerät kann er in Sicherungen landen, die Sie selbst eingerichtet haben, zum Beispiel ein iCloud-Backup oder eine Sicherung am Computer. Wir können den Spielstand nie sehen.</p>
<p><b>Was Apple uns gibt:</b> Wenn auf dem Gerät „Mit App-Entwicklern teilen“ eingeschaltet ist (Einstellungen → Datenschutz &amp; Sicherheit → Analyse &amp; Verbesserungen), schickt Apple uns Berichte über Abstürze, ohne Namen. Sie helfen uns, Fehler zu beheben. Wer die App vorab über TestFlight testet, dessen Name und E-Mail-Adresse sowie Rückmeldungen und Absturzberichte sieht Apple und zeigt sie uns; das betrifft nur eingeladene Tester, nicht die App aus dem App Store.</p>
<p><b>Käufe:</b> Die App enthält derzeit keine Käufe.</p>
<p><b>Löschen:</b> In der App unter „Optionen → Für Eltern“ lässt sich der Spielstand löschen. Wenn die App gelöscht wird, ist auch der Spielstand auf dem Gerät weg; Kopien in Ihren eigenen Sicherungen bleiben, bis Sie sie löschen.</p>
</div>

<div class="karte">
<h2>Diese Webseite</h2>
<p>Diese Seiten liegen bei GitHub Pages, einem Dienst von GitHub, Inc. (USA). Beim Aufruf verarbeitet GitHub technisch bedingt Daten wie Ihre IP-Adresse, um die Seiten auszuliefern und vor Missbrauch zu schützen. Darauf haben wir keinen Zugriff. Wir selbst erheben auf dieser Webseite keine Daten: keine Cookies, keine Skripte, keine Analyse, keine eingebundenen Inhalte von anderen Anbietern. Mehr dazu in der <a href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement">Datenschutzerklärung von GitHub</a>.</p>
<h2>Wenn Sie uns schreiben</h2>
<p>Schreiben Sie uns eine E-Mail, nutzen wir Ihre Adresse und Ihre Nachricht nur, um zu antworten. Unser Postfach liegt bei Gmail (Google); Google verarbeitet die Nachrichten dafür. Bitte schicken Sie keine Daten von Kindern.</p>
<h2>Ihre Rechte</h2>
<p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung Ihrer Daten sowie auf Widerspruch. Schreiben Sie uns dazu an ${mail}. Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren.</p>
<p class="leise">Stand: ${STAND}</p>
</div>`),

  'impressum.html': seite('impressum.html', `Impressum – ${M.spiel}`, `Impressum von ${M.spiel}.`, `
<div class="karte">
<h1>Impressum</h1>
<p>${esc(M.spiel)} ist ein Spiel von ${esc(M.studio)}.</p>
<h2>Angaben gemäß § 5 DDG</h2>
<address>${anschrift}</address>
<h2>Kontakt</h2>
<p>E-Mail: ${mail}${tel}</p>
</div>`),

  'support.html': seite('support.html', `Hilfe & Kontakt – ${M.spiel}`, `Hilfe zu ${M.spiel}: Kontakt und häufige Fragen.`, `
<div class="karte">
<h1>Hilfe &amp; Kontakt</h1>
<p>Fragen, Wünsche oder ein Fehler im Spiel? Schreiben Sie uns: ${mail}${tel}</p>
<p class="leise">Bitte keine Daten von Kindern schicken. Hilfreich sind: Gerät (zum Beispiel iPad 10. Generation), iOS-Version und was vorher passiert ist.</p>
</div>

<div class="karte">
<h2>Häufige Fragen</h2>
<p><b>Wie sichere ich den Spielstand?</b><br>Die App legt den Spielstand zusätzlich als Datei „spielstand.json“ ab. Sie finden sie in der Dateien-App unter „Auf meinem iPad“ bzw. „Auf meinem iPhone“ im Ordner „${esc(M.spiel)}“. Von dort lässt sie sich zum Beispiel in iCloud Drive kopieren. Die Datei enthält alle drei Welten, die Sterne und die Rezepte.</p>
<p><b>Wie benenne ich eine Welt um oder lösche sie?</b><br>Auf dem Startbildschirm „Spielstände“ antippen. Bei jeder Welt gibt es einen Stift (umbenennen) und einen Papierkorb (löschen). Beides geht erst nach einer kleinen Rechenaufgabe, damit Kinder nichts aus Versehen löschen.</p>
<p><b>Wie lösche ich alles?</b><br>„Optionen → Für Eltern“ öffnen (Rechenaufgabe), dann „Spielstand löschen“. Danach sind alle drei Welten, die Sterne und die Rezepte gelöscht. Das lässt sich nicht rückgängig machen.</p>
<p><b>Braucht das Spiel Internet?</b><br>Nein. ${esc(M.spiel)} läuft ohne Internet und schickt nichts weg.</p>
</div>`),
};

const pruefen = process.argv.includes('--pruefen');
let falsch = 0;
for (const [datei, html] of Object.entries(SEITEN)) {
  if (pruefen) { let alt = ''; try { alt = readFileSync(datei, 'utf8'); } catch { /* fehlt */ } if (alt !== html) { console.error(`✗ ${datei} passt nicht zu den Daten – node bauen.mjs ausführen`); falsch++; } }
  else writeFileSync(datei, html);
}
if (pruefen) { if (falsch) process.exit(1); console.log('✓ Seiten passen zu anbieter.ts und marke.json'); }
else console.log(`${Object.keys(SEITEN).length} Seiten geschrieben (${A.name}, ${A.email}${A.telefon ? ', Telefon' : ', ohne Telefon'})`);
