# Inneslutning av produktionstjänster i Quadlet

Kravhanterings tillståndslösa produktionstjänster `app-runtime` och nginx körs
rootless med nekande grundläge: alla Linux-förmågor tas bort, nya privilegier
förhindras och rotfilsystemen är skrivskyddade. Endast uttryckligen storleksatta
temporära filsystem eller en validerad privat exportkatalog är skrivbara.
Validerade tjänstegränser för minne, CPU, processer och loggtakt måste kunna
verkställas av värdens cgroup- och systemd-konfiguration; installationen
avbryts annars innan aktiva enheter ersätts. Kompatibilitetsundantag är
tjänstespecifika och kräver dokumenterad orsak och verifieringsbevis.

Produktionsnätverken skiljer kant-, identitets-, databas- och
applikationsutgående trafik. Endast nginx publicerar en värdport, medan
destinationsstyrning som Podmans bryggnät inte kan uttrycka ägs av värdens
brandvägg, utgående proxy och motpartens åtkomstregler. SQL Server och Keycloak
använder dessa nätverksgränser, men deras leverantörsspecifika inneslutning ägs
av det separata arbetet för tillståndsbevarande tjänster.

PR- och releasevalidering installerar samma versionssatta produktionsarkiv som
en operatör använder och kör den riktiga Quadlet-livscykeln på en fullständig
Ubuntu-runner. HSA-flödet verifieras genom en separat CI-only Quadlet-overlay
med Kong, adaptern och katalogmocken; overlayen ingår inte i
produktionsarkivet eller produktionstopologin. HSA-gränsen och de separata
stödtjänsterna ägs fortsatt av
[ADR 0029](0029-hsa-personuppslag-som-restgrans-mot-integrationsplattform.md).
RHEL-kvalificering kompletterar detta med SELinux, firewalld, RHEL:s
Podman-version och verklig omstartsbeständighet. Compose är endast ett lokalt
utvecklingskontrakt. Tjänsternas loggtak begränsar tillväxt men är
förlustbringande vid extrem överlast; plattformens säkerhetslogg får därför
inte beskrivas som fullständig, medan den databaslagrade åtgärdsloggen förblir
den varaktiga beviskanalen.
