# Avstegsgodkännande skilt från gällande tillåtelse

Status: Beslutad för implementation i
[#1325](https://github.com/viscalyx/Kravhantering/issues/1325), enligt
bekräftad precisering efter #1323.

Ett avstegsgodkännande är ett bevarat beslut som tillåter ett avsteg
från ett bestämt granskat kravinnehåll. Beslutet är skilt från den
tillåtelse som fortfarande gäller. Granskaren kan ange valfria
textvillkor och antingen ett slutdatum eller ingen tidsbegränsning.

Giltighetstiden räknas från beslutet. Ett slutdatum är inkluderande
enligt Europe/Stockholm. Avtalsstart styr inte avstegets giltighetstid
och jämförs inte med slutdatum som en särskild avtalskontroll.
Ändrat avtalsdatum förskjuter inte beslutets giltighetstid.

Modellen bygger på fullständiga avtal och granskat innehåll enligt
[ADR 0063](0063-fullstandiga-avtal-i-kravunderlag.md). Ett vanligt
avtalsbyte för vidare samma avsteg för oförändrat innehåll, med
oförändrade villkor och slutdatum. Ett uttryckligt registrerat
avtalsavslut gör däremot avstegen inaktuella och avslutar deras
tillåtelse. Ett senare avtal återaktiverar inte avslutade avsteg.

Ändrat kravinnehåll behöver ett nytt beslut om avsteget fortfarande
behövs. Att förbereda ändringen i ett avtalsutkast avslutar inte
tillåtelsen för nuvarande innehåll. Planerade och faktiska avslut
följer den befintliga processen och bevaras som separata händelser.

Förnyelse sker genom en ny länkad begäran och ett nytt granskarbeslut.
Ett nytt godkännande ersätter omedelbart det föregående för det
gemensamma avsteget. Ett ersatt godkännande återupplivas inte när dess
efterföljare upphör. En obeslutad förnyelse förlänger inte tillåtelsen;
ett avslag upphäver inte ett tidigare godkännande som fortfarande gäller.

Endast tilldelad Kravunderlagsansvarig får uttryckligen avsluta ett
godkänt avsteg. Motivering, aktör, tidpunkt och originalbeslut bevaras.
En obeslutad förnyelse måste först uttryckligen avbrytas. Automatisk
utgång kräver inget manuellt godkännande och sker även under förnyelse.

Förnyelse och manuellt avslut gäller det gemensamma avsteget, även
när åtgärden inleds från ett avtalsutkast. Berörda avtal visas före
bekräftelse. Att ta bort utkastet ångrar inte en åtgärd som även gäller
nuvarande avtal. Historiska beslut och frysta tillstånd bevaras;
senare händelser visas separat.

Användningsstatusen Avviken beskriver att kravet avviker i praktiken
och behålls när tillåtelsen upphör. En separat åtgärdsflagga visar
uppföljningsbehov när ingen gällande tillåtelse finns och kravet inte
är Verifierad i det aktuella sammanhanget. Verifierad släcker flaggan;
Pågående och Implementerad gör det inte. Ingen separat attestfunktion
införs. Avtalsavslut lämnar beslut och olöst uppföljning som historik,
utan aktuella arbetsuppgifter för det avslutade avtalet.

Historiskt beslutsutfall, gällande tillåtelse och faktisk uppfyllelse
hålls isär. Aktivt avsteg behåller betydelsen obeslutat avsteg.
Avstegshistorik och Senare händelser bevarar beslutsförloppet utan
att dubblera kravets kompakta innehållshistorik. Utgång och avslut
utlöser ingen gallring och ändrar inte bevaranderegler.
