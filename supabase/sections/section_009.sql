--
-- PostgreSQL database dump
--


-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--

-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (49, 'BE-AVURNAV-2026-001', 'Baggerwerken Schelde ter hoogte van Bath', '<p><strong>Gebied:</strong> Schelde - Bath</p>
<p><strong>Type:</strong> Baggerwerken</p>
<p><strong>Positie:</strong> 51°22''N 004°09''E</p>
<p><strong>Details:</strong> Onderhoudsbaggerwerken worden uitgevoerd in het vaarwater ter hoogte van Bath. 
Verminderde doorvaartbreedte. Scheepvaart dient rekening te houden met aanwezige baggervaartuigen en 
sleephopperzuigers.</p>
<p><strong>Duur:</strong> 3 weken (vanaf 1 maart 2026)</p>
<p><strong>Contact:</strong> Waterwegen en Zeekanaal NV</p>', 'AVURNAV', NULL, '2026-03-01', '2026-03-01 16:13:50.268988', '{"type":"Point","coordinates":[4.15,51.3667]}', NULL, 4, '2026-03-01 16:13:50.268988', '2026-03-01 16:13:50.268988', NULL);
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (50, 'BE-NOTMAR-2026-002', 'Nieuwe ligplaats operationeel - Deurganckdok', '<p><strong>Gebied:</strong> Haven Antwerpen - Deurganckdok</p>
<p><strong>Type:</strong> Nieuwe infrastructuur</p>
<p><strong>Positie:</strong> 51°17''N 004°17''E</p>
<p><strong>Details:</strong> Nieuwe containerligplaats aan de noordkade van het Deurganckdok is operationeel. 
Maximale scheepsafmetingen: 400m lengte, 59m breedte, 16.5m diepgang.</p>
<p><strong>Cartografische update vereist:</strong> Update voor producten Haven Antwerpen en Schelde nautische kaarten.</p>', 'NOTMAR', NULL, '2026-03-02', '2026-03-01 16:13:50.268988', '{"type":"Point","coordinates":[4.2833,51.2833]}', NULL, 4, '2026-03-01 16:13:50.268988', '2026-03-01 16:13:50.268988', NULL);
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (51, 'BE-EGC-2026-003', 'Defect licht Zeebrugge Oostdam', '<p><strong>Gebied:</strong> Haven Zeebrugge - Oostdam</p>
<p><strong>Type:</strong> Defect licht</p>
<p><strong>Positie:</strong> 51°21''N 003°12''E</p>
<p><strong>Details:</strong> Het licht op de Oostdam (Fl.R.5s) is defect. Herstelwerkzaamheden zijn in uitvoering. 
Binnenvarende schepen dienen extra waakzaam te zijn.</p>
<p><strong>Verwachte hersteldatum:</strong> 5 maart 2026</p>
<p><strong>Verantwoordelijke:</strong> Vlaamse Hydrografie - DAB Vlaamse Waterweg</p>', 'EGC', NULL, '2026-03-03', '2026-03-01 16:13:50.268988', '{"type":"Point","coordinates":[3.2,51.35]}', NULL, 4, '2026-03-01 16:13:50.268988', '2026-03-01 16:13:50.268988', NULL);
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (52, 'BE-MRCC-2026-004', 'Wrakverwijdering ten noorden van Oostende', '<p><strong>Gebied:</strong> Belgische territoriale wateren - Noordelijk van Oostende</p>
<p><strong>Type:</strong> Wrakverwijdering</p>
<p><strong>Positie:</strong> 51°19''48"N 002°53''00"E</p>
<p><strong>Details:</strong> Verwijdering van wrak op positie 51°19''48"N 002°53''00"E. 
Werkgebied afgezet met kardinale boeien. Vaarverbod binnen straal van 500 meter rond werkgebied.</p>
<p><strong>Periode:</strong> 1 maart t/m 15 maart 2026</p>
<p><strong>Betrokken schepen:</strong> Kraanschip "Rambiz" en bergingsvaartuigen</p>', 'MRCC', NULL, '2026-03-04', '2026-03-01 16:13:50.268988', '{"type":"Point","coordinates":[3.05,51.33]}', NULL, 4, '2026-03-01 16:13:50.268988', '2026-03-01 16:13:50.268988', NULL);
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (53, 'BE-AVURNAV-2026-005', 'Onderhoudswerkzaamheden Thorntonbank windpark', '<p><strong>Gebied:</strong> Thorntonbank windmolenpark</p>
<p><strong>Type:</strong> Onderhoudswerkzaamheden windturbines</p>
<p><strong>Positie:</strong> 51°33''N 002°56''E (centrum windpark)</p>
<p><strong>Details:</strong> Onderhoudswerkzaamheden aan windturbines C05 t/m C12. 
Jack-up platform "Zeebries" gestationeerd in het gebied. Scheepvaart dient veiligheidszone van 500m rond platform te respecteren.</p>
<p><strong>Duur:</strong> 1 t/m 20 maart 2026</p>
<p><strong>VHF contact:</strong> Kanaal 74 voor coördinatie</p>', 'AVURNAV', NULL, '2026-03-05', '2026-03-01 16:13:50.268988', '{"type":"Point","coordinates":[2.9333,51.55]}', NULL, 4, '2026-03-01 16:13:50.268988', '2026-03-01 16:13:50.268988', NULL);
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (54, 'BE-NOTMAR-2026-006', 'Nieuwe dieptelodingen Pas van Terneuzen', '<p><strong>Gebied:</strong> Westerschelde - Pas van Terneuzen</p>
<p><strong>Type:</strong> Bathymetrische update</p>
<p><strong>Positie:</strong> 51°26''24"N 003°34''48"E</p>
<p><strong>Details:</strong> Nieuwe hydrografische opname toont verdieping van het vaarwater. 
Nieuwe minimum diepte: 16.8 meter (was 15.5 meter). Update voor Westerschelde kaarten vereist.</p>
<p><strong>Survey datum:</strong> 25 februari 2026</p>
<p><strong>Bronvermelding:</strong> Vlaamse Hydrografie</p>', 'NOTMAR', NULL, '2026-03-06', '2026-03-01 16:13:50.268988', '{"type":"Point","coordinates":[3.58,51.44]}', NULL, 4, '2026-03-01 16:13:50.268988', '2026-03-01 16:13:50.268988', NULL);
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (55, 'BE-EGC-2026-007', 'Tijdelijke havensluitingen Nieuwpoort wegens sluiswerkzaamheden', '<p><strong>Gebied:</strong> Haven Nieuwpoort - Noordelijke sluis</p>
<p><strong>Type:</strong> Sluiswerkzaamheden</p>
<p><strong>Positie:</strong> 51°10''N 002°44''E</p>
<p><strong>Details:</strong> Onderhoudswerkzaamheden aan noordelijke zeesluis. Haven ontoegankelijk tijdens volgende periodes:
- 3 maart: 06:00-12:00
- 5 maart: 08:00-14:00  
- 8 maart: 06:00-18:00 (volledige dag)</p>
<p><strong>Alternatieven:</strong> Zuidelijke sluis blijft operationeel (max. 80m LOA)</p>
<p><strong>Contact:</strong> Havenmeester Nieuwpoort VHF kanaal 69</p>', 'EGC', NULL, '2026-03-07', '2026-03-01 16:13:50.268988', '{"type":"Point","coordinates":[2.7333,51.1667]}', NULL, 4, '2026-03-01 16:13:50.268988', '2026-03-01 16:13:50.268988', NULL);
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (56, 'BE-NAVTEX-2026-008', 'Drijvende constructie voor Blankenberge - nieuwe golfbreker', '<p><strong>Gebied:</strong> Voor de kust van Blankenberge</p>
<p><strong>Type:</strong> Constructiewerkzaamheden golfbreker</p>
<p><strong>Positie:</strong> 51°19''N 003°08''E</p>
<p><strong>Details:</strong> Aanleg nieuwe golfbreker. Werkgebied gemarkeerd met gele speciale boeien. 
Drijvende kraan en werkplatforms aanwezig. Scheepvaart dient gebied te mijden.</p>
<p><strong>Afmetingen werkgebied:</strong> 300m x 150m</p>
<p><strong>Periode:</strong> Maart-augustus 2026</p>
<p><strong>Verantwoordelijke:</strong> Afdeling Kust - Maritieme Dienstverlening</p>', 'NAVTEX', NULL, '2026-03-08', '2026-03-01 16:13:50.268988', '{"type":"Point","coordinates":[3.1333,51.3167]}', NULL, 4, '2026-03-01 16:13:50.268988', '2026-03-01 16:13:50.268988', NULL);
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (57, 'BE-MRCC-2026-009', 'Militaire oefening Vlakte van de Raan - Schietoefeningen', '<p><strong>Gebied:</strong> Vlakte van de Raan - Belgische territoriale wateren</p>
<p><strong>Type:</strong> Militaire oefening met scherpe munitie</p>
<p><strong>Centrum positie:</strong> 51°30''N 003°15''E</p>
<p><strong>Details:</strong> Marine schietoefeningen. Oefengebied afgebakend met tijdelijke gevaarboeien. 
VAARVERBOD binnen aangeduid gebied tijdens actieve oefeningen.</p>
<p><strong>Data en tijden:</strong>
- 4 maart: 09:00-17:00
- 6 maart: 09:00-17:00
- 11 maart: 09:00-17:00</p>
<p><strong>Waarschuwing:</strong> Nautische publicatie 3007 - Belgische gevarenzones</p>
<p><strong>Contact:</strong> Belgische Marine Operations - VHF kanaal 16/67</p>', 'MRCC', NULL, '2026-03-09', '2026-03-01 16:13:50.268988', '{"type":"Point","coordinates":[3.25,51.5]}', NULL, 4, '2026-03-01 16:13:50.268988', '2026-03-01 16:13:50.268988', NULL);
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (58, 'BE-AVURNAV-2026-010', 'Kabellegging Scheur - Energiekabel Nederland-België', '<p><strong>Gebied:</strong> Scheur vaargeul</p>
<p><strong>Type:</strong> Legging onderzeese energiekabel</p>
<p><strong>Traject:</strong> Van 51°25''N 003°24''E naar Nederlandse grens</p>
<p><strong>Details:</strong> Legging van 220kV energiekabel België-Nederland. Kabelleggingsschip "Living Stone" 
actief in gebied met begeleidingsvaartuigen. Manoeuvreerbaarheid beperkt - geef ruim vrij pad.</p>
<p><strong>Minimale doorvaarthoogte boven kabel:</strong> Kabel wordt begraven op 3 meter diepte</p>
<p><strong>Periode:</strong> 1 maart t/m 30 april 2026</p>
<p><strong>VHF monitoring:</strong> Kanaal 11 voor passage coördinatie</p>
<p><strong>Ankerverbod:</strong> Na voltooiing binnen 250m kabelcorridor</p>', 'AVURNAV', NULL, '2026-03-10', '2026-03-01 16:13:50.268988', '{"type":"Point","coordinates":[3.4,51.4167]}', NULL, 4, '2026-03-01 16:13:50.268988', '2026-03-01 16:13:50.268988', NULL);
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (59, 'VH_BackerWe20260312', 'Nieuwe melding', 'test', 'Manual', 'Vlaamse Hydrografie', '2026-03-12', '2026-03-12 12:55:47.749623', '{"type":"Point","coordinates":[3.206497,51.345918]}', NULL, 4, '2026-03-12 12:55:47.749623', '2026-03-12 12:55:47.749623', '');
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (72, 'VH_BackersW_20260426_02', 'Nieuwe test melding', 'test melding', 'Manual', 'Vlaamse Hydrografie', '2026-04-26', '2026-04-26 12:41:44.277985', '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[2.922363,51.274078],[2.888031,51.282239],[2.861252,51.265057],[2.882538,51.233252],[2.93335,51.254314],[2.922363,51.274078]]]},"properties":{"name":"testzone","description":"testzone"}}]}', NULL, 4, '2026-04-26 12:41:44.277985', '2026-04-26 12:41:44.277985', '');
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (73, 'VH_BackersW_20260428_01', 'Nieuwe boeien uitgelegd', 'Twee boeien:

aKust100 : 51.302108°N, 3.052826°E
aKust101: 51.279837°N, 2.991714°E', 'Manual', 'Vlaamse Hydrografie', '2026-04-28', '2026-04-28 11:19:18.23137', '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[2.991714,51.279837]},"properties":{"name":"aKust101"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[3.052826,51.302108]},"properties":{"name":"aKust100"}}]}', NULL, 4, '2026-04-28 11:19:18.23137', '2026-04-28 11:19:18.23137', '');
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (74, 'VH_BackersW_20260428_02', 'test melding voor input mail', '<!--
/* Font Definitions */
@font-face
	{font-family:"Cambria Math";
	panose-1:2 4 5 3 5 4 6 3 2 4;}
@font-face
	{font-family:Aptos;}
@font-face
	{font-family:Tahoma;
	panose-1:2 11 6 4 3 5 4 4 2 4;}
@font-face
	{font-family:Webdings;
	panose-1:5 3 1 2 1 5 9 6 7 3;}
/* Style Definitions */
p.MsoNormal, li.MsoNormal, div.MsoNormal
	{margin:0cm;
	font-size:12.0pt;
	font-family:"Aptos",sans-serif;
	mso-ligatures:standardcontextual;
	mso-fareast-language:EN-US;}
span.E-mailStijl17
	{mso-style-type:personal-compose;
	font-family:"Aptos",sans-serif;
	color:windowtext;}
.MsoChpDefault
	{mso-style-type:export-only;
	mso-fareast-language:EN-US;}
@page WordSection1
	{size:612.0pt 792.0pt;
	margin:70.85pt 70.85pt 70.85pt 70.85pt;}
div.WordSection1
	{page:WordSection1;}
-->





 
Wesly Backers
Hoofddeskundige Cartografische producten
Vlaamse overheid
AGENTSCHAP
MARITIEME DIENSTVERLENING en KUST
AFDELING KUST
M
+32 (0)473 30 95 78

 
wesly.backers@mow.vlaanderen.be
Vrijhavenstraat 3, 8400 Oostende
www.afdelingkust.be
 
/////////////////////////////////////////////////////////////////////////////
 

P
Alvorens te printen, denk aan het leefmilieu
Dit bericht met eventuele bijlage(n) verbindt de afdeling KUST (MOW-MDK) op geen enkele wijze. Enkel officieel ondertekende briefwisseling kan dat. Noch de afdeling
 KUST, noch de auteur van dit bericht kan bijgevolg aansprakelijk gesteld worden voor de inhoud ervan en van zijn eventuele bijlage(n).', 'Vlaamse Hydrografie', 'Backers Wesly <wesly.backers@mow.vlaanderen.be>', '2026-04-28', '2026-04-28 15:40:31.38787', '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[3.194275,51.342337]},"properties":{"name":"test","description":"testje"}}]}', NULL, 4, '2026-04-28 15:40:31.38787', '2026-04-28 15:40:31.38787', '');
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (60, 'VH_TEST', 'VH_BackersW_20260401', 'Dit is een testmelding', 'Manual', '', '2026-04-01', '2026-04-01 20:04:35.241416', '{"type":"Point","coordinates":[3.089309,51.376264]}', NULL, 4, '2026-04-01 20:04:35.241416', '2026-04-04 12:44:07.564357', 'niet gebruiken aub');
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (61, 'VH_BackersW_20260407', 'Boeien uitgelegd', 'Boeien uitgelegd op posities: zie kaart', 'Manual', 'Vlaamse Hydrografie', '2026-04-07', '2026-04-07 16:46:52.864985', '{"type":"Point","coordinates":[2.823486,51.771169]}', NULL, 4, '2026-04-07 16:46:52.864985', '2026-04-07 16:46:52.864985', '');
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (62, 'VH_BackersW_20260407_01', 'Uitleggen boeien 14 en 13', 'boeien 14 en 13 uitgelegd voor Zeebrugge', 'Manual', 'Vlaamse Hydrografie', '2026-04-07', '2026-04-07 16:59:00.060588', '{"type":"Point","coordinates":[3.18243,51.365936]}', NULL, 4, '2026-04-07 16:59:00.060588', '2026-04-07 16:59:00.060588', '');
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (63, 'VH_BackersW_20260426_01', 'Nieuwe boeien Hydrometeo uitgelegd', 'Volgende boeien zijn uitgelegd:
aKust32
aKust33', 'Manual', 'Vlaamse Hydrografie', '2026-04-26', '2026-04-26 11:28:24.047902', '{"type":"Point","coordinates":[3.141289,51.398398]}', NULL, 4, '2026-04-26 11:28:24.047902', '2026-04-26 11:28:24.047902', '');
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (71, 'VH_BackersW_20260426', 'Nieuw ankergebied ''Oostdyck2''', 'Nieuw ankergebied ''Oostdyck2'' volgens MRP2026 §99', 'Mail', 'Vlaamse Hydrografie', '2026-04-26', '2026-04-26 12:11:01.517248', '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[2.521191,51.339985],[2.521877,51.326256],[2.462139,51.326256],[2.461796,51.340306],[2.521191,51.339985]]]},"properties":{"name":"Oostdyck2","description":"MRP2026§9: Nieuw ankergebied Oostdyck 2"}}]}', NULL, 4, '2026-04-26 12:11:01.517248', '2026-04-26 12:11:01.517248', '');
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (75, 'VH_Desnouri_20260430', 'FW: Anker St Clemens', 'Dag Kaatje,
 
Nee.
 
MSI 134/26 Verloren anker en ketting ST.Clemens werd gepubliceerd op 29/03/2026.
Daar is niks mee gedaan.
Was voorlopig wel opgenomen achteraan in lijst MSI van kracht in 2w-BaZ boekje (Nr. 2026-08 van 9 APRIL 2026 en Nr. 2026-09 van 23 APRIL 2026).
Op 26/04/2026 hebben we in nautinfo van MRCC mail gekregen dat anker geborgen is, zie 3de bijlage, en cancel bericht met reden: geborgen, zie 4de bijlage.
Zal dus in het volgende 2w-BaZ boekje (Nr. 2026-10 van 7 MEI 2026) ook niet meer in lijst MSI van kracht komen.
 
Groeten,
Ria
 


Van:
 Vandaele Kaatje <kaatje.vandaele@mow.vlaanderen.be> 
Verzonden: 29-Apr-26 09:59
Aan: Nautinfo <nautinfo@mow.vlaanderen.be>
Onderwerp: FW: Anker St Clemens


 
Ria,

is dat die ene die we net toegevoegd hebben?
 
Groetjes,
Kaatje
 
 

 


Van:
 Lucas Niek <niek.lucas@mow.vlaanderen.be>

Verzonden: 29-Apr-26 09:07
Aan: Vandaele Kaatje <kaatje.vandaele@mow.vlaanderen.be>
Onderwerp: Anker St Clemens


 
Dag Kaatje
 
Ter info:
Het anker van de St Clemens (MSI134 26) werd recent verloren en is ondertussen effectief geborgen.
 
Mvg,
Niek
 
Niek Lucas
Nautisch Coördinator aSB
 
Vlaamse overheid
AGENTSCHAP MARITIEME DIENSTVERLENING en KUST
afd.SCHEEPVAARTBEGELEIDING
G +32(0)471 55 95 01
niek.lucas@mow.vlaanderen.be
Maritiem Plein 3, 8400 Oostende
www.scheepvaartbegeleiding.be
 
 
/////////////////////////////////////////////////////////////////////////////', 'Vlaamse Hydrografie', 'DESNOUCK Ria <ria.desnouck@mow.vlaanderen.be>', '2026-04-30', '2026-04-30 08:53:55.915613', '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[2.6595,51.406666666666666]},"properties":{"name":"M/V ST. CLEMENS","description":"ANKER EN KETTING VERLOREN"}}]}', NULL, 4, '2026-04-30 08:53:55.915613', '2026-04-30 08:53:55.915613', '');
INSERT INTO public.notifications (id, code, title, content, source, source_detail, notification_date, received_date, geometry, metadata, created_by, created_at, updated_at, opmerkingen) VALUES (76, 'VH_LanckackerT_20260430', 'RE: Extra gegevens Strekdam Blankenberge', '<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=us-ascii">
<meta name="Generator" content="Microsoft Word 15 (filtered medium)">
<!--[if !mso]><![endif]--><!--[if gte mso 9]><xml>
<o:shapedefaults v:ext="edit" spidmax="1026" />
</xml><![endif]--><!--[if gte mso 9]><xml>
<o:shapelayout v:ext="edit">
<o:idmap v:ext="edit" data="1" />
</o:shapelayout></xml><![endif]-->
</head>
<body lang="NL-BE" link="blue" vlink="purple" style="word-wrap:break-word">
<div class="WordSection1">
<p class="MsoNormal"><span style="mso-fareast-language:EN-US">Dag Timothy,<o:p></o:p></span></p>
<p class="MsoNormal"><span style="mso-fareast-language:EN-US"><o:p>&nbsp;</o:p></span></p>
<p class="MsoNormal"><span style="mso-fareast-language:EN-US">Wat betreft de as-built, ontbreekt bij ons nog het overzichtsplan conform de richtlijnen van het GRB platform. Dit plan hebben we opgevraagd bij de aannemer, maar hebben we voorlopig nog niet ontvangen.
 Normaal gezien zou op dat overzichtsplan de landzijde duidelijk vermeld moeten staan.<o:p></o:p></span></p>
<p class="MsoNormal"><span style="mso-fareast-language:EN-US"><o:p>&nbsp;</o:p></span></p>
<p class="MsoNormal"><span style="mso-fareast-language:EN-US">Voor de L-muren (B) zal de situatie zeer dicht bij de ontwerpplannen liggen, maar voor de strandhelling (C-D) en de aansluiting op de lage dam zijn er wel wat wijzigingen gebeurd ten opzichte van
 het oorspronkelijke ontwerp.<o:p></o:p></span></p>
<p class="MsoNormal"><span style="mso-fareast-language:EN-US"><o:p>&nbsp;</o:p></span></p>
<p class="MsoNormal"><span style="mso-fareast-language:EN-US">Zodra we het overzichtsplan van de aannemer hebben ontvangen, breng ik je meteen op de hoogte.<o:p></o:p></span></p>
<p class="MsoNormal"><span style="mso-fareast-language:EN-US"><o:p>&nbsp;</o:p></span></p>
<p class="MsoNormal"><span style="mso-fareast-language:EN-US">mvg,<o:p></o:p></span></p>
<p class="MsoNormal"><span style="mso-fareast-language:EN-US">Elias<o:p></o:p></span></p>
<p class="MsoNormal"><span style="mso-fareast-language:EN-US"><o:p>&nbsp;</o:p></span></p>
<div>
<div style="border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm">
<p class="MsoNormal"><b><span lang="NL" style="font-size:11.0pt;font-family:&quot;Calibri&quot;,sans-serif">Van:</span></b><span lang="NL" style="font-size:11.0pt;font-family:&quot;Calibri&quot;,sans-serif"> Lanckacker Timothy &lt;timothy.lanckacker@mow.vlaanderen.be&gt;
<br>
<b>Verzonden:</b> donderdag 26 maart 2026 14:19<br>
<b>Aan:</b> DE VOLDER Johan &lt;johan.devolder@mow.vlaanderen.be&gt;; Van Quickelborne Elias &lt;elias.vanquickelborne@mow.vlaanderen.be&gt;<br>
<b>CC:</b> DESNOUCK Ria &lt;ria.desnouck@mow.vlaanderen.be&gt;; Nautinfo &lt;nautinfo@mow.vlaanderen.be&gt;<br>
<b>Onderwerp:</b> Re: Extra gegevens Strekdam Blankenberge<o:p></o:p></span></p>
</div>
</div>
<p class="MsoNormal"><o:p>&nbsp;</o:p></p>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black">Dag Elias,<o:p></o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black"><o:p>&nbsp;</o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black">Even een vriendelijke herinnering aan onderstaande mails. Zou je ons een dwg of shapefile kunnen bezorgen van de buitenste omtrek van de Westelijke Strekdam op land? Het zeewaarts gedeelte hebben
 we reeds ontvangen, maar de verbinding met de bestaande infrastructuur op land ontbreekt nog. Het gaat met name om het verlengde van de roze lijnen op onderstaande figuur, ongeveer tot de punten C en D.&nbsp;<o:p></o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black"><o:p>&nbsp;</o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black"><a id="OWAAM126189" href="mailto:johan.devolder@mow.vlaanderen.be"><span style="font-family:&quot;Aptos&quot;,sans-serif;text-decoration:none">@DE VOLDER Johan</span></a>&nbsp;Bedankt voor de dwg, dit lost inderdaad
 al vele zaken op<o:p></o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black"><o:p>&nbsp;</o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black">Groeten,<o:p></o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black">Timothy<o:p></o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black"><o:p>&nbsp;</o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black"><img border="0" width="610" height="422" style="width:6.3583in;height:4.3916in" id="image_0" src="cid:image001.png@01DCBDD5.C0ED4090"></span><span style="font-size:11.0pt;color:black"><o:p></o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black"><o:p>&nbsp;</o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-size:11.0pt;color:black"><o:p>&nbsp;</o:p></span></p>
</div>
<div>
<p class="MsoNormal"><o:p>&nbsp;</o:p></p>
</div>
<div>
<p class="MsoNormal"><span style="font-family:&quot;Calibri&quot;,sans-serif;color:black"><o:p>&nbsp;</o:p></span></p>
</div>
<div class="MsoNormal" align="center" style="text-align:center">
<hr size="2" width="98%" align="center">
</div>
<div>
<p class="MsoNormal"><b><span style="font-family:&quot;Calibri&quot;,sans-serif;color:black">Van:</span></b><span style="font-family:&quot;Calibri&quot;,sans-serif;color:black">&nbsp;DE VOLDER Johan &lt;<a href="mailto:johan.devolder@mow.vlaanderen.be">johan.devolder@mow.vlaanderen.be</a>&gt;<br>
<b>Verzonden:</b>&nbsp;Dinsdag, 17 Maart, 2026 09:13<br>
<b>Aan:</b>&nbsp;Lanckacker Timothy &lt;<a href="mailto:timothy.lanckacker@mow.vlaanderen.be">timothy.lanckacker@mow.vlaanderen.be</a>&gt;; Van Quickelborne Elias &lt;<a href="mailto:elias.vanquickelborne@mow.vlaanderen.be">elias.vanquickelborne@mow.vlaanderen.be</a>&gt;<br>
<b>CC:</b>&nbsp;DESNOUCK Ria &lt;<a href="mailto:ria.desnouck@mow.vlaanderen.be">ria.desnouck@mow.vlaanderen.be</a>&gt;; Nautinfo &lt;<a href="mailto:nautinfo@mow.vlaanderen.be">nautinfo@mow.vlaanderen.be</a>&gt;<br>
<b>Onderwerp:</b>&nbsp;RE: Extra gegevens Strekdam Blankenberge <o:p></o:p></span></p>
</div>
<div>
<p class="MsoNormal"><span style="font-family:&quot;Calibri&quot;,sans-serif;color:black"><o:p>&nbsp;</o:p></span></p>
</div>
<p>Timothy,<o:p></o:p></p>
<p>&nbsp;<o:p></o:p></p>
<p>In bijlage de dwg met de meeste antwoorden op uw vragen.<o:p></o:p></p>
<p>De buitenste omtrek en verlengde van de dijkkern heb ik niet. Elias ??<o:p></o:p></p>
<p>&nbsp;<o:p></o:p></p>
<p>De tekening staat in Lambert-72.<o:p></o:p></p>
<p>&nbsp;<o:p></o:p></p>
<p>Mvg<o:p></o:p></p>
<p>&nbsp;<o:p></o:p></p>
<p>Johan<o:p></o:p></p>
<p>&nbsp;<o:p></o:p></p>
<div style="border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm">
<p><b><span style="font-size:11.0pt;font-family:&quot;Calibri&quot;,sans-serif">Van:</span></b><span style="font-size:11.0pt;font-family:&quot;Calibri&quot;,sans-serif">&nbsp;Lanckacker Timothy &lt;<a href="mailto:timothy.lanckacker@mow.vlaanderen.be">timothy.lanckacker@mow.vlaanderen.be</a>&gt;<br>
<b>Verzonden:</b>&nbsp;maandag 16 maart 2026 16:20<br>
<b>Aan:</b>&nbsp;Van Quickelborne Elias &lt;<a href="mailto:elias.vanquickelborne@mow.vlaanderen.be">elias.vanquickelborne@mow.vlaanderen.be</a>&gt;; DE VOLDER Johan &lt;<a href="mailto:johan.devolder@mow.vlaanderen.be">johan.devolder@mow.vlaanderen.be</a>&gt;<br>
<b>CC:</b>&nbsp;DESNOUCK Ria &lt;<a href="mailto:ria.desnouck@mow.vlaanderen.be">ria.desnouck@mow.vlaanderen.be</a>&gt;; Nautinfo &lt;<a href="mailto:nautinfo@mow.vlaanderen.be">nautinfo@mow.vlaanderen.be</a>&gt;<br>
<b>Onderwerp:</b>&nbsp;Extra gegevens Strekdam Blankenberge</span><o:p></o:p></p>
</div>
<p>&nbsp;<o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">Dag Elias en Johan,</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">&nbsp;</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">We zoeken nog bijkomende gegevens voor de Westelijke Strekdam in Blankenberge. De dwg''s die we reeds ontvingen stellen ons in staat om het zeewaarts uitgebouwde deel van de strekdam in te tekenen, maar om de verbinding
 te maken met de bestaande infrastructuur aan land komen we nog enkele zaken tekort.</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">&nbsp;</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">Ik heb een plan en twee overzichtsfoto''s toegevoegd in bijlage, om onderstaande vragen te verduidelijken.</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">We zijn nog op zoek naar opmetingen van:</span><o:p></o:p></p>
<ul style="margin-top:0cm" type="disc">
<li class="MsoNormal" style="color:black;mso-list:l0 level1 lfo1"><span style="font-size:11.0pt">De buitenste omtrek van het dijklichaam (roze lijn) tussen A en D (kant havengeul)</span><o:p></o:p></li><li class="MsoNormal" style="color:black;mso-list:l0 level1 lfo1"><span style="font-size:11.0pt">De buitenste omtrek van het dijklichaam (roze lijn) tussen A en C (kant strand)</span><o:p></o:p></li><li class="MsoNormal" style="color:black;mso-list:l0 level1 lfo1"><span style="font-size:11.0pt">Het verlengde van de ''dijkkern'' (zwarte lijn) tussen A en B</span><o:p></o:p></li><li class="MsoNormal" style="color:black;mso-list:l0 level1 lfo1"><span style="font-size:11.0pt">Het wandelpad tussen B en C, indien dit kan beschouwd worden als het verlengde van de dijkkern</span><o:p></o:p></li><li class="MsoNormal" style="color:black;mso-list:l0 level1 lfo1"><span style="font-size:11.0pt">Het muurtje dat het wandelpad aan westelijke zijde flankeert tussen B en C</span><o:p></o:p></li><li class="MsoNormal" style="color:black;mso-list:l0 level1 lfo1"><span style="font-size:11.0pt">De muurtjes aan weerszijden van de weg tussen C en E</span><o:p></o:p></li><li class="MsoNormal" style="color:black;mso-list:l0 level1 lfo1"><span style="font-size:11.0pt">De omtrek van de twee gebouwen (bistro en bunker) bij F</span><o:p></o:p></li></ul>
<p><span style="font-size:11.0pt;color:black">&nbsp;</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">Alvast bedankt,</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">Vriendelijke groeten,</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">Timothy</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">&nbsp;</span><o:p></o:p></p>
<p>&nbsp;<o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">&nbsp;</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">&nbsp;</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">&nbsp;</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">&nbsp;</span><o:p></o:p></p>
<p><span style="font-size:11.0pt;color:black">&nbsp;</span><o:p></o:p></p>
</div>
</body>
</html>', 'Vlaamse Hydrografie', 'Van Quickelborne Elias <elias.vanquickelborne@mow.vlaanderen.be>', '2026-04-30', '2026-04-30 09:04:18.378812', '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[3.105612,51.315806]},"properties":{}}]}', NULL, 4, '2026-04-30 09:04:18.378812', '2026-04-30 09:04:18.378812', '');


--
