1. Doel en context van CARTIS 2.0
Bron: Inleiding
Inleiding

CARTIS is de applicatie van Vlaamse Hydrografie voor de administratieve opvolging van nautische meldingen en de daaraan gekoppelde producten.

Het huidige CARTIS is een module binnen KIS (Kust Informatie Systeem), opgezet in 2014–2015.

Door loskoppeling van KIS en de snelle digitale evolutie is er nood aan een moderne, performante, sterk geautomatiseerde opvolger: “CARTIS 2.0” (definitieve naam nog te kiezen).

Focus van de nieuwe tool:

Meer automatisering, dataverwerking en data‑uitwisseling (intern en extern).

Extra functionaliteiten zoals REST‑API’s, semi‑automatische datavisualisatie/verwerking, automatische opmaak van nautische producten, ondersteuning voor verschillende bestandsformaten (import/export).

Enkel de cartografie‑gerelateerde zaken gaan mee naar de nieuwe tool; overige KIS‑functionaliteit blijft buiten scope.

Voorkeur: webapplicatie als front‑end, met migratie naar cloud in het achterhoofd.

De back‑end levert data (databases, REST‑API’s) aan de front‑end en houdt die up‑to‑date.

Het document beschrijft in het geheel:

Processen die de tool moet ondersteunen.

Functionaliteiten voor beheer van meldingen, taken en producten.

Connecties met databanken en externe systemen.

Productie‑ en publicatieprocessen voor nautische producten.

Opvolging van andere uitstromen (Nautisch Portaal, website, …).

2. Algemeen concept van de nieuwe tool
Bron: Algemeen Concept
Algemeen Concept

2.1 Vier hoofdprocessen
De nieuwe tool organiseert het werk rond vier kernprocessen die elke productielijn doorloopt:

Meldingen – inkomende nautische informatie.

Taken – uit te voeren acties op basis van meldingen.

Productversies – versies van kaarten/publicaties waarin de taken verwerkt worden.

Publicaties – het effectief publiceren van de producten (kaarten, BaZ, enz.).

Deze processen kunnen per productielijn deels geautomatiseerd worden; waar nodig blijft handmatige invoer/beslissing mogelijk.

2.2 Bijkomende (nieuwe) processen
Integratie van doorlooptijden (tijdregistratie/flow tracking).

Pushberichten van:

Wrakkendatabank.

Peilgegevens uit Poseidon en/of CARIS BDB (gml, xml, …).

Automatisering richting CARIS‑software:

Conversie naar S‑57/S‑100‑objecten.

Automatisering van productprocessen in CARIS.

Integratie van de “Lichtenlijst”.

Aanmaak van API‑data voor uitstromen naar externe partners.

2.3 Productielijnen
De tool ondersteunt meerdere productielijnen:

ZK – Zeekaartproductie (elektronische en papieren nautische kaarten).

IENC – Inland ENC (binnenvaartkaarten).

Pilot ENC – gedetailleerde bathymetrische loodskaarten.

Publ – publicaties zoals Berichten aan Zeevarenden (BaZ), Lichtenlijst, Verbeterlijst, enz.

Eventueel Hydrometeo (bv. S‑104, S‑111‑producten).

Afkortingen (ZK, IENC, Pilot ENC, Publ) worden overal gebruikt als shorthand voor de productielijnen.

2.4 Gebruikersrechten en login
Gebruikers loggen in met rechten per productielijn.

Inloggen gebeurt “per productielijn”; elke gebruiker heeft één hoofdproductielijn die standaard actief is na login.

3. Overzicht van de analyse
Bron: Overzicht
Overzicht

Deze pagina geeft een samenvattend overzicht van de analyse‑structuur:

Inleiding: situering van CARTIS, nood aan modernisering, web/cloud, automatisering, API’s.

Algemeen concept: vier hoofdprocessen, bijkomende integraties, productielijnen, rechtenstructuur.

Meldingen: definitie, bronnen, invoerkanalen, velden, procesflow, API’s.

Taken: relatie met meldingen, weergave/filtering per productielijn, velden en aanvullende informatie.

Verdere secties (niet allemaal in detail uitgewerkt in de snippets) dekken o.a. Productversies, Publicaties, koppelingen met CARIS, en detailflows.

4. Meldingen (eerste hoofdproces)
Belangrijkste bronnen:

Meldingen (hoofdpagina)
Meldingen

Meldingen – Algemeen
Meldingen - Algemeen

Meldingen – Aanmaak taaknummer
Meldingen - Aanmaak taaknummer

Meldingen – Automatische invoer van nautische persberichten
Meldingen - Automatische invoer van nautische persberichten

4.1 Wat is een melding?
Een melding is een stuk binnengekomen nautische informatie, via interne of externe kanalen:

Interne berichtgeving (mail, telefoon, …).

Externe partijen: MRCC Oostende, havenbedrijven, De Vlaamse Waterweg, enz.

Niet alle berichten hoeven zichtbaar of relevant te zijn voor elke productielijn:

Er zijn algemene filters en productielijn‑specifieke filters (afzender, onderwerp, woord, zone, …).

4.2 Invoerkanalen en volume
Geschat worden 2000–3000 berichten per jaar verwerkt. Bronnen:

REST‑API (nieuw): automatische bevraging van verschillende nautische bericht‑API’s.

Mailing: automatisch inlezen uit mailbox nautinfo@mow.vlaanderen.be.

Handmatige invoer: formulier + drag‑and‑drop van mails, waarbij velden automatisch ingevuld worden vanuit de mail‑metadata; bijlagen worden mee opgeslagen.

BaZ1‑berichten (nieuw): gepubliceerde BaZ1‑artikels worden als nieuwe melding overgenomen voor het volgende jaar.

Pushberichten:

Vanuit Doorlooptijden/POSEIDON (voor peilingen die verwerkt moeten worden, vooral relevant voor Pilot ENC, deels ZK).

Vanuit de Wrakkendatabank (wrakaanpassingen, bv. minimale diepte).

Specifieke nautische persberichten die automatisch moeten kunnen worden opgenomen (via API of mailbox nautinfo):

MSI/LB (Maritime Safety Information) van MRCC Oostende.

BASS (Bekendmaking aan de Scheepvaart Scheldegebied) van VTS Scheldt.

Nautische berichten van Port of Antwerp‑Bruges (POAB).

FLARIS NtS (via EuRIS).

4.3 Weergave en tabel “Meldingen”
Bron: Meldingen – Algemeen

Per productielijn is er een lijstweergave van meldingen.

Bij inloggen ziet de gebruiker standaard de openstaande meldingen waarvoor nog geen beslissing is genomen in de actieve productielijn.

De volledige lijst (beslist + onbeslist) moet altijd opvraagbaar zijn.

Het moet visueel duidelijk zijn in welke productielijn de gebruiker werkt.

Tabelvelden omvatten o.a.:

Multi‑select voor bulkbeslissingen (nieuw).

Code van het bericht (bv. “MSI 126/25”).

Datum van het bericht (dd/mm/jjjj).

Omschrijving/titel van het bericht (bv. “KBk, licht normaal”).

En aanvullende informatie (inhoud, bijlagen, opmerkingen, lijst producten, geografisch overzicht, … – verder uitgewerkt in de detailpagina’s).

4.4 Aanmaak taaknummer vanuit meldingen
Bron: Meldingen – Aanmaak taaknummer

Taaknummers gelden over alle productielijnen heen.

Als er al een taaknummer door een andere productielijn aan een melding is gekoppeld, wordt datzelfde nummer hergebruikt.

Structuur taaknummer:

Laatste twee cijfers van het jaar + viercijferig volgnummer, bv. 250006.

Bij beslissing over meldingen:

Status “–” wordt omgezet naar “Ja” of “Nee” per productielijn.

Bij “Ja” wordt het taaknummer aangemaakt: dit bepaalt het bijbehorende CARIS‑project in CARIS HPD.

De geselecteerde producten voor de productielijn worden automatisch aan de taak gelinkt en verschijnen bij Taken met initiële status “Te Verwerken”.

5. Taken (tweede hoofdproces)
Belangrijkste bronnen:

Taken (sectie in Overzicht):
Overzicht

Taken – Aanvullende informatie:
Taken - Aanvullende informatie

5.1 Definitie en rol van taken
Taken zijn de concrete werkitems die voortkomen uit meldingen.

Elke productielijn bekijkt en filtert zijn eigen takenlijst.

Tabelvelden (zoals uit de Overzicht‑pagina):

Taaknummer.

Tijd/doorlooptijd.

Omschrijving van de taak.

Status per productielijn.

BaZ‑nummer.

Aanduiding of een MSI nog van kracht is.

Aanduiding of een taak moet worden opgevolgd of dat er extra info nodig is.

Aanvullende info bij een taak:

Toelichting (vrij tekstveld).

Gerelateerde taken.

Gelinkte meldingen.

Statussen in de verschillende producten.

Geografisch overzicht.

Mogelijkheid om CARIS‑projecten te openen.

5.2 Geografisch overzicht en CARIS‑koppeling
Bron: Taken – Aanvullende informatie

Geografisch overzicht:

Toont geografische info van meldingen t.o.v. productomtrekken.

Gebruiker kan nog producten toevoegen aan de te‑verwerken lijst zolang het HPD Source taakproject niet is afgesloten.

Extra nautische achtergrondinformatie kan worden getoond.

CARIS Project openen:

Een knop opent rechtstreeks het HPD‑project in CARIS, inclusief eventuele bijlagen uit meldingen (hob3, h2o, gml, shp, …).

Hiervoor wordt de CARIS‑API gebruikt.

6. Productversies en gekoppelde taken
Bron: Productversies – Aanvullende informatie
Productversies - Aanvullende informatie

Per productversie is er een tabel van gekoppelde taken:

Alle taken die na de laatst gepubliceerde versie aan het product zijn gelinkt.

Plus taken die in de vorige productversie nog niet waren voltooid.

Velden:

Taaknummer (naar definitie bij Meldingen/Taaknummer).

Omschrijving (idem als taakomschrijving).

Taakstatus onder het product:

Hoog te verwerken.

Te verwerken.

In inspectie.

Voltooid.

Niet van toepassing.

Logica bij publicatie:

Taken met status “Voltooid” worden bij de huidige productversie opgeslagen.

Taken met státus “Hoog te verwerken”, “Te verwerken” of “In inspectie” worden doorgeschoven naar de volgende productversie.

Taken met “Niet van toepassing” gaan niet mee naar de volgende versie.

Extra velden:

BaZ nr. (koppeling naar BaZ‑nummer).

“BaZ‑nr in HPD‑S” – mogelijk overbodig door automatisatie.

Toelichting (WYSIWYG‑editor).

Bijlagen bij productversies (PDF, DOCX, XLS, …).

Er moet gefilterd kunnen worden op de tabel; filters op taken in deze tabel moeten ook de lijst van producten dynamisch aanpassen (en omgekeerd bij filteren op taaknummer).

7. CARTIS – Analyse (lege pagina)
Bron: CARTIS – Analyse
CARTIS - Analyse

Deze pagina bevat momenteel enkel de titel en nog geen inhoud.

De eigenlijke analyse is dus verspreid over de andere pagina’s (Inleiding, Algemeen Concept, Overzicht, Meldingen‑, Taken‑, Productversies‑*, …).

8. Samenvattend in één zin
CARTIS 2.0 wordt opgezet als een webgebaseerde, cloud‑gerichte opvolger van het huidige CARTIS/KIS‑systeem, die alle nautische meldingen via API’s, mailboxen en pushberichten centraliseert, deze omzet in taken, die taken koppelt aan productversies en publicaties, en via sterke integratie met CARIS en externe databronnen (Poseidon, wrakkendatabank, doorlooptijden, BaZ, MSI, enz.) het volledige productie‑ en publicatieproces van nautische kaarten en publicaties grotendeels automatiseert.





