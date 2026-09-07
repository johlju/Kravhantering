# Aktörskvoter för exporter och rapporter

Status: Antagen 2026-09-07. Implementering följer
[#1310](https://github.com/viscalyx/Kravhantering/issues/1310).

Alla autentiserade exporter och rapporter ska omfattas av en aktörskvot för
både starttakt och samtidiga arbeten. Omfattningen inkluderar RFI-frågelistans
CSV, behörighetsöversynens JSON och arkivexport, även när de inte använder
befintlig kapacitetsstyrning för genererade filer. Kvoten följer personens
normaliserade HSA-id över sessioner och appnoder och gäller även
administratörer. En aktör ska inte ensam kunna belägga all tillgänglig
kapacitet i den konfiguration som verifierar samtidig användning.

Standardkvoten är tio starter under varje rullande period om 60 sekunder
och ett samtidigt arbete per person, gemensamt för alla exporter och
rapporter. Misslyckade och avbrutna arbeten räknas som starter men släpper
sin samtidighetsplats. Nekade anrop förbrukar ingen start. Administratörer
kan ändra aktörsgränserna genom befintliga granskade och loggade
applikationsinställningar. Verifiering av samtidig användning kräver minst
två platser i den berörda kapacitetspoolen; en konfiguration med en enda
plats kan fortfarande vara upptagen.

SQL Server samordnar aktörskvoterna. Ett överskridande ger HTTP 429. Om
samordningen inte kan genomföras startar inget nytt skyddat arbete och
anropet får HTTP 503. Ingen processlokal reservkvot får kringgå gränsen.
Befintliga processlokala kapacitetsgränser och gränser för minne, tid,
filstorlek och disk behålls.

Användaren ska få ett tydligt lokaliserat meddelande om orsaken och nästa
steg. Egen förbrukad kvot, upptagen gemensam kapacitet och otillgänglig
kvotkontroll ska kunna skiljas åt. Samordningsfel ska förklaras som ett
tillfälligt tjänstfel utan att visa interna databasfel eller felaktigt påstå
att användaren har överskridit sin kvot.

Meddelandena ska finnas på svenska och engelska och fungera även för
direkta nedladdningslänkar och inloggningssidor. Vägledning om återförsök
får inte lova att ett tjänstfel har upphört vid en viss tidpunkt.

Inloggning och API-trafik ska få generösa anropsgränser i ingressen med den
befintliga betrodda klientadresskedjan. Aktörskvoten skiljer personer bakom
samma företagsproxy åt; en IP-gräns kan bara styra deras sammanlagda trafik.
Ytterligare aktörskvoter för AI och kravimport ligger utanför detta beslut.

Operatörer styr ingressgränserna genom driftsättningskonfigurationen.
Startvärden är 50 API-anrop per sekund och klientadress med en tillåten
anropstopp om 200, samt fem inloggningsstarter per sekund och klientadress
med en tillåten anropstopp om 50. Värdena ska verifieras och anpassas till
driftmiljön; de är inte uppmätt produktionskapacitet. Prov av separata
aktörskvoter bakom samma proxy ska hålla sig under IP-gränsen. Om den
sammanlagda trafiken överskrider IP-gränsen kan alla bakom adressen få
HTTP 429.

Beslutet kompletterar
[ADR 0020](./0020-kapacitetsobserverbarhet-via-plattformen.md),
[ADR 0042](./0042-begransade-synkrona-exporter-och-rapporter.md) och
[ADR 0057](./0057-sql-server-samordnad-hsa-verifieringskvot.md).

## Övervägda alternativ

- Enbart gräns för starttakt: väljs inte eftersom långvariga arbeten kan
  belägga alla samtidighetsplatser innan tidskvoten tar slut.
- Enbart IP-gränser: väljs inte eftersom personer bakom samma företagsproxy
  behöver separata aktörskvoter.
- Processlokala aktörskvoter: väljs inte eftersom fler appnoder då ökar en
  persons tillåtna förbrukning av gemensamma resurser.
- Fortsätta vid samordningsfel: väljs inte eftersom nya arbeten då kan
  kringgå den gemensamma gränsen.
