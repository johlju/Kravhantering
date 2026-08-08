# Separata SQL-identiteter och explicit runtime-manifest

Status: Antagen 2026-08-08.

Applikationens runtime och databasjobb använder separata SQL
Server-identiteter i samma databas och med `dbo` som standardschema.
Databasjobbet har `db_owner`
för TypeORM-migrering och obligatorisk seedning. Runtime får den stabila
projektrollen `kravhantering_runtime`; de äldre rollerna `db_datareader` och
`db_datawriter` behålls tillfälligt till #485.

Den versionssatta manifestfilen
`typeorm/runtime-permission-manifest.mjs` är auktoritativ för varje
fullständigt kvalificerat objekt, tillåten operation och eventuell
kolumnbegränsad uppdatering. Nya objekt får ingen implicit runtime-behörighet.
Databasjobbet kör avstämning efter lyckad migrering, tar bort oväntade direkta
behörigheter från projektrollen och verifierar manifestets digest samt
deklarerade runtime-användares medlemskap.

Avstämningen ändrar inte andra roller, direkta användarbehörigheter eller
lokalt ägda tilläggsroller. Extern DBA äger login, användare, lösenord och initialt
medlemskap; självförsörjande topologier automatiserar samma principalsteg.
`DB_RUNTIME_USER` är endast ett icke-hemligt verifieringsnamn och ger varken
behörighet att ansluta som användaren eller rotera dess autentiseringsuppgifter.
