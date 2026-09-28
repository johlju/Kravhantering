# AI-klienter: instruktioner, filer och JSON Schema

<!-- cspell:words specen promptfiler promptfil repot repon promptverktyg -->
<!-- cspell:words promptverktyget Kodtolken kodtolken XPIA makare -->
<!-- cspell:words repoinstruktioner sökvägsspecifika molnagenten Promptfiler -->
<!-- cspell:words Instruktionsfiler instruktionsfiler sidtexten sidtexterna -->
<!-- cspell:words kunskapsfiler dokumentfiler obetrott schemafil -->

Forskningsunderlag för
[#1552](https://github.com/viscalyx/Kravhantering/issues/1552) under kartan
[#1550](https://github.com/viscalyx/Kravhantering/issues/1550). Underlaget
beskriver hur Microsoft 365 Copilot, GitHub Copilot och (i undantagsfall)
ChatGPT hanterar beständiga instruktioner, bifogade Markdown- och JSON-filer,
tvingande JSON Schema och export av rent JSON. Det ska räcka för att välja
format och reservläge för AI-anropsmallen, men fattar inga beslut.

Alla källor hämtades 2026-09-28. Leverantörerna ändrar funktioner och gränser
ofta, så siffrorna bör kontrolleras igen innan specen låses.

## Sammanfattning

<!-- markdownlint-disable MD013 -->

| Fråga | Microsoft 365 Copilot | GitHub Copilot | ChatGPT (undantag) |
| --- | --- | --- | --- |
| Beständig instruktion | Agent (Agent Builder): fältet Instructions, max 8 000 tecken. Personliga anpassade instruktioner finns, men ingen dokumenterad gräns. | Repo-, sökvägs- och personliga instruktioner, `AGENTS.md`, promptfiler (`.prompt.md`) och anpassade agenter (`.agent.md`). Ingen dokumenterad teckengräns. | Anpassade instruktioner (1 500 eller 5 000 tecken beroende på plan), projektinstruktioner och GPT-instruktioner. |
| Bifoga `.md` och `.json` i chatt | Ja, båda finns i listan över format som stöds. Gränsen är 50 MB (supportsidan). | VS Code: arbetsytans filer som kontext. github.com-chatten: uppladdning bara för bilder och PDF. I Spaces: textfiler. | Ja. 512 MB per fil och 2 miljoner token per textfil. |
| Bifoga `.md` och `.json` som agentkunskap | Nej, varken `.md` eller `.json` står i listan (bara `.txt`, Office och PDF). | Inte tillämpligt: filen ligger i repot. | GPT-kunskap: upp till 20 filer. |
| Tvingande JSON Schema i klienten | Nej. Copilot Studios promptverktyg har en exempelbaserad JSON-utdata, men schemat går inte att redigera. | Nej, ingen dokumenterad funktion. | Nej i ChatGPT-gränssnittet. Bara via API:et (Structured Outputs). |
| Rent JSON ut | Kodblock. Kodtolken kan ge nedladdningsbara filer, men de finns bara kvar under sessionen. | Kodblock. I agentläge kan Copilot skriva filen direkt till arbetsytan och köra en validator. | Kodblock med kopieringsknapp. Canvas kan ladda ned kod med rätt filändelse, men canvas håller på att fasas ut för nyare modeller. |

<!-- markdownlint-enable MD013 -->

**Slutsats:** Ingen av målklienterna kan tvinga svaret mot ett JSON Schema i
det gränssnitt som vanliga användare har. Schemat blir alltså alltid en
instruktion till modellen, och appen måste validera svaret vid import.

## Microsoft 365 Copilot

### Beständiga instruktioner – M365 Copilot

- **Agenter i Agent Builder** (Microsoft 365 Copilot, "New agent" →
  "Configure"): fältet **Instructions** rymmer högst 8 000 tecken. Name rymmer
  30 tecken och Description 1 000 tecken. Man kan lägga till upp till 20
  kunskapskällor.
  Källa: [Build agents with Agent Builder](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agent-builder-build-agents)
  (ms.date 2026-08-19).
- **Deklarativt agentmanifest**: `instructions` rymmer högst 8 000 tecken.
  Andra strängar rymmer som standard 4 000 tecken. Manifestet har ingen
  egenskap för svarsformat eller svarsschema. De egenskaper som finns är
  `capabilities`, `actions`, `behavior_overrides`, `disclaimer` och några
  till.
  Källa: [Declarative agent schema 1.6](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-manifest-1.6).
  Den senaste schemaversionen är 1.8. Den granskades inte i detalj, men inget
  i ändringsloggen för 1.6 pekar på ett svarsschema.
- **Viktigt för mallen:** Microsoft varnar för att lägga agentinstruktioner i
  kunskapskällor för att komma runt gränsen på 8 000 tecken. Enligt Microsoft
  räknas innehåll i kunskapskällor inte som betrodd instruktion. Det
  kontrolleras av XPIA-klassificerare, och språk som liknar direktiv kan
  "blockeras, trunkeras eller saneras".
  Källa: [Write effective instructions for declarative agents](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-instructions)
  (ms.date 2026-08-11).
- Microsoft beskriver indirekt promptinjektion som instruktioner i "text
  files, images, code, files". Källa:
  [Microsoft Copilot prompt defense in depth](https://learn.microsoft.com/en-us/microsoft-365/copilot/copilot-prompt-defense-in-depth)
  (ms.date 2026-09-10). Microsoft dokumenterar inte om en uppladdad `.md`-fil
  med en systeminstruktion i vanlig Copilot Chat behandlas som betrodd eller
  som indirekt innehåll. **Detta är inte verifierat och bör testas manuellt.**
- **Personliga anpassade instruktioner** (Settings → Personalization → Custom
  instructions) gäller för framtida konversationer. Supportsidan anger ingen
  teckengräns och säger inte om instruktionerna också gäller agenter.
  Källa: [Customize how Microsoft Copilot responds to you](https://support.microsoft.com/en-us/microsoft-365-copilot/customize-how-microsoft-365-copilot-responds-to-you).
  De passar inte som bärare för AI-anropsmallen, eftersom de gäller alla
  användarens chattar.
- **Längd på inklistrad prompt:** Det finns ingen officiell gräns i
  Microsofts dokumentation. Uppgifter i Microsoft Q&A varierar mellan cirka
  2 000 och 16 000 tecken beroende på licens och tidpunkt, men de kommer från
  användare och inte från Microsoft (se till exempel
  [Q&A 2006445](https://learn.microsoft.com/en-us/answers/questions/2006445/do-prompt-character-limits-change-based-on-your-m3)).
  **Detta är inte verifierat.** En systeminstruktion på flera tusen tecken
  plus ett JSON Schema kan överskrida gränsen för inklistrad text i vissa
  licenser.

### Filer – M365 Copilot

- **Format i Copilot Chat:** `.md` finns under dokument och `.json` under
  "Configuration & Markup". Listan gäller Copilot Chat, Pages, Notebooks och
  Create.
  Källa: [File formats supported by Microsoft Copilot](https://support.microsoft.com/en-us/microsoft-365-copilot/file-formats-supported-by-microsoft-365-copilot).
- **Gränser:** Upp till 20 filer per konversation och 50 MB per fil.
  Formaten TXT, JSON, CSV och MD nämns uttryckligen.
  Källa: [File upload in Microsoft Copilot](https://support.microsoft.com/en-us/topic/file-upload-in-microsoft-copilot-8b7bf432-9576-4b16-9dee-6c19a4169e62).
  Uppgifter om 512 MB och en dygnsgräns för olicensierade användare finns bara
  i Q&A-svar från användare och moderatorer, så de har lägre tillit.
- **Agentkunskap (inbäddade filer):** Upp till 20 filer. Tabellen över
  filtyper tar bara upp `.doc`, `.docx`, `.pdf`, `.ppt`, `.pptx`, `.txt`
  (512 MB) och `.xls`/`.xlsx` (30 MB). **Varken `.md` eller `.json` finns med.**
  Källa: [Add knowledge sources in Agent Builder](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agent-builder-add-knowledge)
  (ms.date 2026-09-25). I manifestet är gränsen 1 MB per inbäddad fil och 10
  filer ([manifest 1.6](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-manifest-1.6)).
- Microsoft rekommenderar korta dokument, eftersom modellen prioriterar
  början och slutet av en fil. Källa:
  [How reference and document lengths affect Copilot responses](https://support.microsoft.com/topic/keep-it-short-and-sweet-a-guide-on-the-length-of-documents-that-you-provide-to-copilot-66de2ffd-deb2-4f0c-8984-098316104389).

### Strukturerad utdata – M365 Copilot

- Varken Copilot Chat eller agenter i Agent Builder har någon dokumenterad
  funktion som tvingar svaret mot ett JSON Schema. Microsoft rekommenderar i
  stället ett instruktionsbaserat "Output Contract" där formatet kan vara
  `JSON` (mönster 4 i
  [declarative agent instructions](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-instructions)).
  Samma sida varnar för att modellbyten sker automatiskt och kan ändra
  beteendet "particularly in structured or step-by-step scenarios".
- **Copilot Studio (promptverktyget, för makare)** har JSON-utdata med ett
  automatiskt identifierat eller eget JSON-*exempel*. Man kan se det
  genererade schemat, men **inte redigera det**. Toppnivålistor utan
  fältnycklar stöds inte. Källa:
  [JSON output – Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/process-responses-json-output).
  Funktionen är till för flöden och appar och inte för slutanvändarens chatt.
  Den kan därför inte ta emot ett nedladdat schema från Kravhantering.

### Rent JSON ut – M365 Copilot

- Svaret kommer i praktiken som ett kodblock i chatten. Hur kodblock och
  kopieringsknapp beter sig i Copilot Chat har inte verifierats i
  dokumentationen.
- **Kodtolken** ("Create documents, charts, and code", som är på som
  standard i Agent Builder) kan skapa nedladdningsbara filer och visar
  automatiskt en nedladdningslänk. Filerna finns **bara kvar under den
  aktiva sessionen**. Kodtolken är tillgänglig för licensierade användare och
  för Copilot Chat-användare utan debiterad användning. Källa:
  [Code interpreter](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/code-interpreter)
  (ms.date 2026-06-18). Exemplen visar Office-, PDF- och bildfiler. Att en
  `.json`-fil kan laddas ned är troligt men **inte uttryckligen dokumenterat**.

## GitHub Copilot

### Beständiga instruktioner – GitHub Copilot

- **Typer:** personliga instruktioner (bara github.com),
  repoinstruktioner i `.github/copilot-instructions.md`, sökvägsspecifika
  instruktioner i `.github/instructions/*.instructions.md` och
  agentinstruktioner i `AGENTS.md`, `CLAUDE.md` eller `GEMINI.md`.
  Organisationsinstruktioner kräver Business eller Enterprise och gäller i
  github.com-chatten, kodgranskning och molnagenten. Promptfiler
  (`*.prompt.md`) finns i VS Code, Visual Studio och JetBrains.
  Företrädesordningen är personlig, sedan repo och sist organisation. GitHub
  påpekar att Copilot "may not always follow your custom instructions in
  exactly the same way every time". Ingen teckengräns anges.
  Källa: [About customizing GitHub Copilot responses](https://docs.github.com/en/copilot/concepts/prompting/response-customization).
- **VS Code:** Instruktionsfiler gäller för chatten men inte för inline-förslag.
  `*.instructions.md` kopplas automatiskt när `applyTo` matchar. Microsoft
  rekommenderar korta instruktioner.
  Källa: [Custom instructions in VS Code](https://code.visualstudio.com/docs/copilot/customization/custom-instructions).
- **Promptfiler** (`.github/prompts/*.prompt.md` eller användarprofilen) har
  YAML-frontmatter (`description`, `name`, `argument-hint`, `agent`, `model`,
  `tools`). De körs med `/namn` och kan referera till filer med
  Markdown-länkar eller `#file:`. De stöder variabler som `${input:namn}` och
  `${selection}`.
  Källa: [Prompt files](https://code.visualstudio.com/docs/copilot/customization/prompt-files).
  Formatet passar AI-anropsmallens platshållare för behov, sammanhang och
  antal kandidater bra.
- **Anpassade agenter** (`.github/agents/*.agent.md`) består av frontmatter
  (`tools`, `model`, `handoffs`) och en Markdown-kropp med instruktioner som
  läggs före användarens prompt. Det finns inget alternativ för utdataschema.
  Källa: [Custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents).
- **Copilot Spaces** (github.com): Här finns ett fritextfält för
  instruktioner och källor som repon, filer, uppladdningar och text. Alla med
  Copilot-licens, även Free, kan använda Spaces. Bifogade filer laddas i sin
  helhet in i kontextfönstret. Samtidigt har Spaces "defined size limits", och
  bara en del av innehållet används. Inga siffror anges.
  Källor: [About Copilot Spaces](https://docs.github.com/en/copilot/concepts/context/spaces),
  [Creating Copilot Spaces](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/copilot-spaces/create-copilot-spaces),
  [Application card: Copilot Spaces](https://docs.github.com/en/copilot/responsible-use/copilot-spaces).

### Filer – GitHub Copilot

- **github.com-chatten:** Uppladdning från datorn stöds bara för JPEG, PNG,
  GIF, WEBP, PDF, HEIC och HEIF. **`.md` och `.json` kan inte laddas upp
  direkt.** Ingen storleksgräns anges.
  Källa: [Chat in GitHub](https://docs.github.com/en/copilot/how-tos/copilot-on-github/chat-with-copilot/chat-in-github).
  Textfiler kan i stället användas via Spaces eller klistras in.
- **VS Code:** Filer och mappar kan läggas till som kontext med `#`, "Add
  Context" eller dra-och-släpp. Bilder stöds också. Storleksgränser,
  trunkering och filer utanför arbetsytan beskrivs inte.
  Källa: [Manage context](https://code.visualstudio.com/docs/copilot/chat/copilot-chat-context).
  I praktiken kan en `.md`- och en `.json`-fil i arbetsytan refereras direkt.

### Strukturerad utdata – GitHub Copilot

- Ingen dokumenterad funktion i Copilot Chat (github.com, VS Code, agenter
  eller promptfiler) tvingar svaret mot ett JSON Schema. JSON-formatet styrs
  bara av instruktioner.

### Rent JSON ut – GitHub Copilot

- I chatt kommer svaret som kodblock.
- **I agentläge i VS Code** kan agenten "edit files, run commands, and
  iterate on results", och användaren granskar ändringarna eller ångrar dem.
  Källa: [Local agents](https://code.visualstudio.com/docs/copilot/agents/local-agents).
  Mallen kan därför be agenten skriva svaret till en `.json`-fil och validera
  den mot schemafilen i arbetsytan, till exempel med en validator i
  terminalen. Det ger ett rent JSON-resultat utan kopiering, men kräver en
  arbetsyta och verktygsbehörighet. Det är inte ett tvingande schema, bara en
  kontroll i efterhand som agenten själv gör.

## ChatGPT (undantagsfall)

> help.openai.com gav HTTP 403 för automatisk hämtning. Uppgifterna nedan
> kommer från sökträffar på help.openai.com (OpenAI:s egna sidor) och inte
> från hela sidtexten. Tilliten är därför något lägre än för Microsoft och
> GitHub. API-dokumentationen på developers.openai.com lästes i sin helhet.

### Beständiga instruktioner – ChatGPT

- **Anpassade instruktioner:** upp till 1 500 tecken för Free och Go, och
  upp till 5 000 tecken för Plus, Pro, Business, Enterprise och Edu.
  Källa: [ChatGPT Custom Instructions](https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions).
- **Projekt:** Projektinstruktioner gäller bara inom projektet och **ersätter
  de globala anpassade instruktionerna**. Projekt kan delas, även med grupper
  i Business, Enterprise och Edu.
  Källa: [Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt).
  Antal filer per projekt beror på planen, och exakta siffror har inte
  verifierats.
- **GPT:er:** Instruktionerna gäller varje konversation, och OpenAI
  rekommenderar att regler ligger i instruktionerna och inte i kunskapsfiler.
  Man kan ha upp till 20 kunskapsfiler på upp till 512 MB var.
  Källa: [Creating and editing GPTs](https://help.openai.com/en/articles/8554397-creating-a-gpt).
  Teckengränsen för GPT-instruktioner (ofta angiven som 8 000) **kunde inte
  verifieras** i OpenAI:s dokumentation.

### Filer – ChatGPT

- 512 MB per fil. Text- och dokumentfiler begränsas till 2 miljoner token
  per fil. Kalkylark får vara cirka 50 MB och bilder 20 MB. Man kan ladda upp
  80 filer per 3 timmar, men Free-användare bara 3 filer per dag. Lagringen
  är 25 GB per användare och 100 GB per organisation.
  Källa: [File Uploads FAQ](https://help.openai.com/en/articles/8555545-file-uploads-faq).

### Strukturerad utdata – ChatGPT

- **Structured Outputs finns i API:et, inte i ChatGPT-gränssnittet.** Med
  `text.format: { type: "json_schema", strict: true, schema }` garanteras att
  svaret följer schemat. JSON-läget garanterar bara giltig JSON.
  Källa: [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
  Ingen funktion i ChatGPT (chatt, projekt eller GPT) kopplar svaret till ett
  JSON Schema. GPT Actions använder OpenAPI-scheman för verktygsanrop och inte
  för svarsformatet
  ([Configuring actions in GPTs](https://help.openai.com/en/articles/9442513-configuring-actions-in-gpts)).
- Följande **begränsningar i strikt läge** är relevanta om mallen ska
  återanvända den strikta schemavarianten som finns i
  `lib/ai/requirement-prompt.ts` (`buildRequirementImportResponseFormatSchema`):
  - roten måste vara ett objekt och inte `anyOf`
  - alla fält måste vara `required`
  - `additionalProperties: false` krävs i varje objekt
  - `allOf`, `not`, `if`, `then`, `else`, `dependentRequired` och
    `dependentSchemas` stöds inte
  - högst 5 000 egenskaper, 10 nivåer och 1 000 enum-värden
  - högst 120 000 tecken i namn och värden totalt
  - `$defs` och rekursion stöds.

  OpenAI påpekar också att "Structured Outputs can still contain mistakes".

### Rent JSON ut – ChatGPT

- Kodblock har kopieringsknapp
  ([Working with writing blocks and code blocks](https://help.openai.com/en/articles/20001246-working-with-writing-blocks-and-code-blocks-in-chatgpt)).
- Canvas kan ladda ned kod med rätt filändelse. Enligt OpenAI är canvas dock
  inte längre tillgängligt i GPT-5.5 Instant och Thinking, där skriv- och
  kodblock i chatten ersätter det
  ([canvas](https://help.openai.com/en/articles/9930697)). Canvas bör därför
  inte vara en förutsättning i mallen.

## Osäkerheter och det som inte kunde verifieras

- Den officiella längdgränsen för inklistrade prompter i Microsoft 365
  Copilot Chat. Bara användaruppgifter finns, och de varierar med licens.
- Om Microsoft 365 Copilot Chat följer eller neutraliserar direktiv i en
  uppladdad `.md`-fil (XPIA). Beteendet är dokumenterat för agentkunskap men
  inte för chattuppladdning.
- Filstorleksgränsen i Microsoft 365 Copilot Chat. Supportsidan anger 50 MB
  och Q&A-svar anger 512 MB. Dygnsgränser för olicensierade användare nämns
  bara i Q&A.
- Om kodtolken i Microsoft 365 Copilot kan leverera en `.json`-fil för
  nedladdning.
- Storleks- och trunkeringsgränser för filer som kontext i GitHub Copilot
  (VS Code, Spaces) och eventuella teckengränser för instruktionsfiler.
- Teckengränsen för ChatGPT GPT-instruktioner och antal filer per projekt per
  plan.
- Hela sidtexterna på help.openai.com, eftersom automatisk hämtning
  blockerades.

## Konsekvenser för AI-anropsmallens format och reservläge

Nedan följer fakta och alternativ. Beslutet tas i kartans beslutsärenden.

1. **Schemat kan inte tvingas i någon målklient.** I alla tre klienter
   fungerar JSON Schema bara som instruktion till modellen. Mallen behöver
   därför:
   - be om **enbart JSON**, gärna i ett enda kodblock
   - peka ut schemat som kontrakt
   - lita på att appen validerar vid import, vilket den redan gör med
     importkontraktet som kanonisk källa.

   Reparationssteget (`ai.prompt.repair`) blir mer värdefullt i det här
   läget. Det är en öppen punkt i kartan.
2. **Storlek och uppdelning.** Instruktionsfält har en tydlig gräns på
   8 000 tecken i Microsoft 365-agenter. Längden på inklistrad text i Copilot
   Chat är okänd och kan vara låg för vissa licenser. Möjliga alternativ:
   - (a) en kort systeminstruktion under cirka 8 000 tecken med schemat som
     separat fil
   - (b) allt i en fil som laddas upp
   - (c) en kompakt variant utan schema, där schemat ersätts med ett exempel
     och en fältlista.
3. **Filformat per klient.**
   - `.md` och `.json` fungerar i Copilot Chat-uppladdning, ChatGPT och
     VS Code.
   - De fungerar **inte** som agentkunskap i Agent Builder, där bara `.txt`
     och Office/PDF stöds.
   - De fungerar inte som direktuppladdning i github.com-chatten, där bara
     bilder och PDF stöds.

   Om mallen ska kunna användas som kunskap i en Microsoft 365-agent behövs
   en `.txt`-variant, eller så får användaren klistra in instruktionen i
   agentens Instructions-fält.
4. **Instruktion i fil jämfört med i prompten.** Microsoft behandlar innehåll
   i kunskapskällor som obetrott, och direktiv kan saneras bort. Mallens
   regelhierarki och regler som inte får åsidosättas bör därför ligga i en
   *betrodd* kanal, alltså agentens Instructions-fält eller texten i
   användarens prompt. De bör inte bara ligga i en bifogad fil. Om det
   fungerar att ladda upp mallen som fil i Copilot Chat behöver ett manuellt
   testfall visa.
5. **Möjliga reservlägen.**
   - **Primärt läge (alla klienter):** klistra in systeminstruktionen och
     användarmeddelandet, bifoga schemat som `.json` eller klistra in det,
     och be om svar i ett enda JSON-kodblock.
   - **GitHub Copilot (VS Code):** Mallen levereras som promptfil
     (`.prompt.md`) med `${input:...}`-platshållare och schemafil. Agenten
     skriver svaret till en `.json`-fil och validerar det själv. Detta ger
     det renaste resultatet utan kopiering.
   - **Microsoft 365 Copilot-agent:** Instruktionen klistras in i fältet
     Instructions (högst 8 000 tecken). Schemat läggs som `.txt`-kunskap
     eller i prompten, och man är medveten om XPIA-risken.
   - **ChatGPT:** Projektinstruktioner (som ersätter de anpassade
     instruktionerna) plus schemafil. Strikt Structured Outputs kräver
     API-åtkomst och ligger utanför vanlig användning. Den befintliga strikta
     schemavarianten är relevant bara om en API-väg blir aktuell.
6. **Kvar att testa manuellt innan specen låses:**
   - teckengränsen för inklistrad text i Copilot Chat med typiska licenser
   - om instruktioner följs när de ligger i en uppladdad `.md`-fil i Copilot
     Chat
   - om kodtolken kan ge `.json` för nedladdning.
