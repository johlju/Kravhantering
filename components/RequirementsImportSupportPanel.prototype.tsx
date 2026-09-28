'use client'

// PROTOTYPE — throwaway (wayfinder ticket #1556).
// Question: how should the import dialog separate the narrow
// Importinstruktion (+ JSON Schema) from the ready-made AI request template
// for an external AI agent, and what should the template be called?
// Four structurally different support panels on the existing import dialog,
// switchable via `?variant=A|B|C|D`, plus `?term=1..4` for the visible name.
// Template and reference-data downloads are stubs; the real builders do not
// exist yet. Schema and Importinstruktion use the real routes.

import {
  Bot,
  Check,
  ChevronDown,
  ClipboardCopy,
  Code2,
  Download,
  FileJson,
  FileText,
  MessageSquare,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'
import PrototypeSwitcher, {
  type PrototypeAxis,
  usePrototypeParam,
} from '@/components/PrototypeSwitcher.prototype'

type Locale = 'en' | 'sv'
type Mode = 'library' | 'specification-local'

const VARIANT_AXIS: PrototypeAxis = {
  param: 'variant',
  values: ['A', 'B', 'C', 'D'],
  labels: {
    A: 'Två spår sida vid sida',
    B: 'Stegguide, gamla filer infällda',
    C: 'Kopiera först',
    D: 'Flikar per arbetssätt',
  },
}

const TERMS = {
  '1': {
    sv: 'AI-anropsmall',
    en: 'AI request template',
    slugSv: 'ai-anropsmall',
    slugEn: 'ai-request-template',
  },
  '2': {
    sv: 'AI-prompt för kravimport',
    en: 'AI prompt for requirement import',
    slugSv: 'ai-prompt',
    slugEn: 'ai-prompt',
  },
  '3': {
    sv: 'Promptmall för extern AI',
    en: 'Prompt template for external AI',
    slugSv: 'promptmall',
    slugEn: 'prompt-template',
  },
  '4': {
    sv: 'Färdig AI-prompt',
    en: 'Ready-made AI prompt',
    slugSv: 'fardig-ai-prompt',
    slugEn: 'ready-made-ai-prompt',
  },
} as const
type TermKey = keyof typeof TERMS

const TERM_AXIS: PrototypeAxis = {
  param: 'term',
  values: Object.keys(TERMS),
  labels: Object.fromEntries(
    Object.entries(TERMS).map(([key, term]) => [
      key,
      `${term.sv} / ${term.en}`,
    ]),
  ),
}

export interface SupportPanelPrototypeProps {
  canDownloadDestinationFiles: boolean
  destinationName?: string
  locale: Locale
  mode: Mode
  onDownloadInstruction: () => void
  onDownloadSchema: () => void
  specificationId?: number
  titleId: string
}

function useModel(props: SupportPanelPrototypeProps) {
  const termKey = usePrototypeParam(TERM_AXIS) as TermKey
  const term = TERMS[termKey]
  const sv = props.locale === 'sv'
  const name = sv ? term.sv : term.en
  const isLibrary = props.mode === 'library'
  const destinationSlug = isLibrary
    ? sv
      ? 'kravbibliotek'
      : 'requirements-library'
    : sv
      ? 'kravunderlag'
      : 'requirements-specification'
  const templateFile = sv
    ? `kravimport-${term.slugSv}-${destinationSlug}.md`
    : `requirement-import-${term.slugEn}-${destinationSlug}.md`
  const referenceFile = sv
    ? `kravimport-referensdata-${destinationSlug}${isLibrary ? '' : `-${props.specificationId ?? 'x'}`}.json`
    : `requirement-import-reference-data-${destinationSlug}${isLibrary ? '' : `-${props.specificationId ?? 'x'}`}.json`
  const destinationLabel = isLibrary
    ? sv
      ? 'kravbiblioteket'
      : 'the requirements library'
    : sv
      ? `kravunderlaget ${props.destinationName ?? ''}`.trim()
      : `the requirements specification ${props.destinationName ?? ''}`.trim()
  const startMarker = sv
    ? '===== BÖRJAN PÅ AI-ANROPSMALL FÖR KRAVIMPORT ====='
    : '===== START OF AI REQUEST TEMPLATE FOR REQUIREMENT IMPORT ====='
  const endMarker = sv
    ? '===== SLUT PÅ AI-ANROPSMALL ====='
    : '===== END OF AI REQUEST TEMPLATE ====='
  const templateText = `${startMarker}\n(PROTOTYP – ${name}. Rollintro, regelordning, AI-instruktion, Importinstruktionens regler och minifierat schema byggs av mallens sammansättare.)\n${endMarker}\n`
  const referenceJson = JSON.stringify({
    generatedAt: new Date().toISOString(),
    schemaVersion: 'PROTOTYPE',
    locale: props.locale,
    destination: isLibrary
      ? { type: 'requirements_library' }
      : {
          type: 'requirements_specification',
          id: props.specificationId,
          name: props.destinationName,
        },
    note: 'PROTOTYPE stub – real reference data comes from the shared builder',
  })
  return {
    destinationLabel,
    downloadReference: () =>
      stubDownload(referenceFile, referenceJson, 'application/json'),
    downloadTemplate: () =>
      stubDownload(templateFile, templateText, 'text/markdown'),
    inlineName: name.startsWith('AI')
      ? name
      : name[0].toLowerCase() + name.slice(1),
    isLibrary,
    name,
    referenceFile,
    sv,
    templateFile,
    templateText,
  }
}

function stubDownload(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const linkButton =
  'inline-flex min-h-8 items-center gap-2 rounded text-left text-sm underline underline-offset-4 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-primary-300'
const primaryButton =
  'btn-primary inline-flex w-full items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm font-medium text-secondary-800 hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-secondary-700 dark:bg-secondary-900 dark:text-secondary-100 dark:hover:bg-secondary-800'
const fileCaption =
  'font-mono text-[11px] text-secondary-500 dark:text-secondary-400'

function FileName({ children }: { children: string }) {
  return <span className={fileCaption}>{children}</span>
}

function ExternalSteps({
  model,
  withClientHint = true,
}: {
  model: ReturnType<typeof useModel>
  withClientHint?: boolean
}) {
  return model.sv ? (
    <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed">
      <li>
        Skriv behovet i{' '}
        {withClientHint
          ? 'Microsoft 365 Copilot Chat eller Copilot Chat i din IDE'
          : 'chatten'}
        , gärna med önskat antal krav.
      </li>
      <li>Klistra in {model.inlineName} före eller efter behovet.</li>
      <li>
        Bifoga referensdatafilen
        {withClientHint ? ' (i IDE:n: lägg till den som kontext)' : ''}.
      </li>
      <li>Spara svaret som .json och lägg in det här.</li>
    </ol>
  ) : (
    <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed">
      <li>
        Write the need in{' '}
        {withClientHint
          ? 'Microsoft 365 Copilot Chat or Copilot Chat in your IDE'
          : 'the chat'}
        , optionally with the number of requirements.
      </li>
      <li>Paste the {model.inlineName} before or after the need.</li>
      <li>
        Attach the reference data file
        {withClientHint ? ' (in the IDE: add it as context)' : ''}.
      </li>
      <li>Save the response as .json and add it here.</li>
    </ol>
  )
}

function ReferenceFreshness({ model }: { model: ReturnType<typeof useModel> }) {
  return (
    <p className="text-xs leading-relaxed">
      {model.sv
        ? `Referensdatafilen gäller ${model.destinationLabel} just nu. Ladda ner en ny om normreferenser, kravpaket${model.isLibrary ? '' : ' eller behovsreferenser'} har ändrats.`
        : `The reference data file reflects ${model.destinationLabel} right now. Download a new one if norm references, requirement packages${model.isLibrary ? '' : ' or needs references'} have changed.`}
    </p>
  )
}

/* ---------------- Variant A: two tracks side by side ---------------- */
function VariantA(props: SupportPanelPrototypeProps) {
  const model = useModel(props)
  return (
    <>
      <h3
        className="text-sm font-semibold text-secondary-800 dark:text-secondary-200"
        id={`${props.titleId}-support`}
      >
        {model.sv ? 'Ta fram importfilen' : 'Produce the import file'}
      </h3>
      <section className="space-y-2 rounded-lg border border-primary-200 bg-white p-3 dark:border-primary-900 dark:bg-secondary-950">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-secondary-900 dark:text-secondary-100">
          <Bot aria-hidden="true" className="h-4 w-4" />
          {model.sv ? 'Med extern AI-agent' : 'With an external AI agent'}
        </h4>
        <div className="flex flex-col items-start gap-1">
          <button
            className={linkButton}
            disabled={!props.canDownloadDestinationFiles}
            onClick={model.downloadTemplate}
            type="button"
          >
            <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
            {model.sv
              ? `Ladda ner ${model.inlineName}`
              : `Download ${model.inlineName}`}
          </button>
          <FileName>{model.templateFile}</FileName>
          <button
            className={linkButton}
            disabled={!props.canDownloadDestinationFiles}
            onClick={model.downloadReference}
            type="button"
          >
            <FileJson aria-hidden="true" className="h-4 w-4 shrink-0" />
            {model.sv
              ? 'Ladda ner referensdatafil'
              : 'Download reference data file'}
          </button>
          <FileName>{model.referenceFile}</FileName>
        </div>
        <ExternalSteps model={model} />
        <ReferenceFreshness model={model} />
      </section>
      <section className="space-y-2 rounded-lg border border-secondary-200 p-3 dark:border-secondary-800">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-secondary-900 dark:text-secondary-100">
          <Wrench aria-hidden="true" className="h-4 w-4" />
          {model.sv
            ? 'Med egen prompt eller eget verktyg'
            : 'With your own prompt or tool'}
        </h4>
        <div className="flex flex-col items-start gap-1">
          <button
            className={linkButton}
            onClick={props.onDownloadSchema}
            type="button"
          >
            <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
            {model.sv ? 'Ladda ner schema' : 'Download schema'}
          </button>
          <button
            className={linkButton}
            disabled={!props.canDownloadDestinationFiles}
            onClick={props.onDownloadInstruction}
            type="button"
          >
            <FileJson aria-hidden="true" className="h-4 w-4 shrink-0" />
            {model.sv
              ? 'Ladda ner importinstruktion'
              : 'Download import instruction'}
          </button>
        </div>
        <p className="text-xs leading-relaxed">
          {model.sv
            ? 'Schemat validerar filen. Importinstruktionen innehåller bara formatregler och referensdata. Du skriver själv resten av prompten.'
            : 'The schema validates the file. The import instruction only holds format rules and reference data. You write the rest of the prompt yourself.'}
        </p>
      </section>
    </>
  )
}

/* ------- Variant B: guided stepper, legacy files tucked away ------- */
function VariantB(props: SupportPanelPrototypeProps) {
  const model = useModel(props)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const stepBadge =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white'
  return (
    <>
      <h3
        className="text-sm font-semibold text-secondary-800 dark:text-secondary-200"
        id={`${props.titleId}-support`}
      >
        {model.sv
          ? 'Låt en extern AI ta fram krav'
          : 'Let an external AI draft requirements'}
      </h3>
      <ol className="space-y-4">
        <li className="flex gap-3">
          <span className={stepBadge}>1</span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
              {model.sv ? 'Hämta två filer' : 'Get two files'}
            </p>
            <button
              className={primaryButton}
              disabled={!props.canDownloadDestinationFiles}
              onClick={model.downloadTemplate}
              type="button"
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
              {model.name}
            </button>
            <FileName>{model.templateFile}</FileName>
            <button
              className={secondaryButton}
              disabled={!props.canDownloadDestinationFiles}
              onClick={model.downloadReference}
              type="button"
            >
              <FileJson aria-hidden="true" className="h-4 w-4" />
              {model.sv ? 'Referensdata' : 'Reference data'}
            </button>
            <FileName>{model.referenceFile}</FileName>
          </div>
        </li>
        <li className="flex gap-3">
          <span className={stepBadge}>2</span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
              {model.sv ? 'Fråga AI-agenten' : 'Ask the AI agent'}
            </p>
            <p className="text-xs leading-relaxed">
              {model.sv
                ? `Skriv behovet i chatten hos din AI-assistent. Klistra in innehållet i ${model.inlineName} och bifoga referensdatafilen, eller lägg till den som kontext.`
                : `Write the need in your AI assistant chat. Paste the contents of the ${model.inlineName} and attach the reference data file, or add it as context.`}
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className={stepBadge}>3</span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
              {model.sv ? 'Lägg in svaret här' : 'Add the response here'}
            </p>
            <p className="text-xs leading-relaxed">
              {model.sv
                ? 'Spara JSON-svaret som fil och släpp det i fältet, eller klistra in det.'
                : 'Save the JSON response as a file and drop it in the field, or paste it.'}
            </p>
          </div>
        </li>
      </ol>
      <ReferenceFreshness model={model} />
      <div className="border-t border-secondary-200 pt-2 dark:border-secondary-800">
        <button
          aria-expanded={advancedOpen}
          className="inline-flex items-center gap-1 text-xs font-medium text-secondary-700 hover:text-secondary-950 dark:text-secondary-300"
          onClick={() => setAdvancedOpen(open => !open)}
          type="button"
        >
          <ChevronDown
            aria-hidden="true"
            className={`h-3 w-3 transition-transform ${advancedOpen ? '' : '-rotate-90'}`}
          />
          {model.sv
            ? 'Egen prompt eller validering'
            : 'Own prompt or validation'}
        </button>
        {advancedOpen ? (
          <div className="mt-2 flex flex-col items-start gap-1">
            <button
              className={linkButton}
              onClick={props.onDownloadSchema}
              type="button"
            >
              <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
              {model.sv ? 'Ladda ner schema' : 'Download schema'}
            </button>
            <button
              className={linkButton}
              disabled={!props.canDownloadDestinationFiles}
              onClick={props.onDownloadInstruction}
              type="button"
            >
              <FileJson aria-hidden="true" className="h-4 w-4 shrink-0" />
              {model.sv
                ? 'Ladda ner importinstruktion'
                : 'Download import instruction'}
            </button>
            <p className="text-xs leading-relaxed">
              {model.sv
                ? 'Bara formatregler och referensdata, för dig som skriver hela prompten själv eller validerar i eget verktyg.'
                : 'Format rules and reference data only, for writing the whole prompt yourself or validating in your own tool.'}
            </p>
          </div>
        ) : null}
      </div>
    </>
  )
}

/* ---------------- Variant C: copy first, download second ---------------- */
function VariantC(props: SupportPanelPrototypeProps) {
  const model = useModel(props)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(model.templateText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <>
      <h3
        className="text-sm font-semibold text-secondary-800 dark:text-secondary-200"
        id={`${props.titleId}-support`}
      >
        {model.name}
      </h3>
      <p className="text-xs leading-relaxed">
        {model.sv
          ? `Färdig instruktion till Microsoft 365 Copilot Chat eller Copilot Chat i din IDE. Skriv behovet, klistra in ${model.inlineName} och bifoga referensdatafilen. Spara svaret som .json och lägg in det här.`
          : `Ready-made instruction for Microsoft 365 Copilot Chat or Copilot Chat in your IDE. Write the need, paste the ${model.inlineName} and attach the reference data file. Save the response as .json and add it here.`}
      </p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          className={primaryButton}
          disabled={!props.canDownloadDestinationFiles}
          onClick={() => void copy()}
          type="button"
        >
          {copied ? (
            <Check aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ClipboardCopy aria-hidden="true" className="h-4 w-4" />
          )}
          {copied
            ? model.sv
              ? 'Kopierad'
              : 'Copied'
            : model.sv
              ? `Kopiera ${model.inlineName}`
              : `Copy ${model.inlineName}`}
        </button>
        <button
          aria-label={
            model.sv
              ? `Ladda ner ${model.inlineName}`
              : `Download ${model.inlineName}`
          }
          className="inline-flex items-center justify-center rounded-lg border border-secondary-300 px-3 hover:bg-secondary-100 disabled:opacity-50 dark:border-secondary-700 dark:hover:bg-secondary-800"
          disabled={!props.canDownloadDestinationFiles}
          onClick={model.downloadTemplate}
          title={model.templateFile}
          type="button"
        >
          <Download aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <button
        className={secondaryButton}
        disabled={!props.canDownloadDestinationFiles}
        onClick={model.downloadReference}
        type="button"
      >
        <FileJson aria-hidden="true" className="h-4 w-4" />
        {model.sv
          ? 'Ladda ner referensdatafil att bifoga'
          : 'Download reference data file to attach'}
      </button>
      <FileName>{model.referenceFile}</FileName>
      <ReferenceFreshness model={model} />
      <p className="border-t border-secondary-200 pt-2 text-xs dark:border-secondary-800">
        {model.sv
          ? 'Skriver du hela prompten själv? '
          : 'Writing the whole prompt yourself? '}
        <button
          className="underline underline-offset-2"
          onClick={props.onDownloadSchema}
          type="button"
        >
          {model.sv ? 'Schema' : 'Schema'}
        </button>
        {' · '}
        <button
          className="underline underline-offset-2 disabled:opacity-50"
          disabled={!props.canDownloadDestinationFiles}
          onClick={props.onDownloadInstruction}
          type="button"
        >
          {model.sv ? 'Importinstruktion' : 'Import instruction'}
        </button>
      </p>
    </>
  )
}

/* ---------------- Variant D: tabs per way of working ---------------- */
type WayOfWorking = 'm365' | 'ide' | 'own'
function VariantD(props: SupportPanelPrototypeProps) {
  const model = useModel(props)
  const [tab, setTab] = useState<WayOfWorking>('m365')
  const tabs: { icon: typeof Bot; key: WayOfWorking; label: string }[] = [
    { icon: MessageSquare, key: 'm365', label: 'Copilot Chat' },
    {
      icon: Code2,
      key: 'ide',
      label: model.sv ? 'Copilot i IDE' : 'Copilot in IDE',
    },
    {
      icon: Wrench,
      key: 'own',
      label: model.sv ? 'Egen prompt' : 'Own prompt',
    },
  ]
  return (
    <>
      <h3
        className="text-sm font-semibold text-secondary-800 dark:text-secondary-200"
        id={`${props.titleId}-support`}
      >
        {model.sv ? 'Hur tar du fram filen?' : 'How will you produce the file?'}
      </h3>
      <div
        className="grid grid-cols-3 gap-1 rounded-lg bg-secondary-200/70 p-1 dark:bg-secondary-800"
        role="tablist"
      >
        {tabs.map(({ icon: Icon, key, label }) => (
          <button
            aria-selected={tab === key}
            className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium ${
              tab === key
                ? 'bg-white text-secondary-950 shadow dark:bg-secondary-950 dark:text-secondary-50'
                : 'text-secondary-700 hover:text-secondary-950 dark:text-secondary-300'
            }`}
            key={key}
            onClick={() => setTab(key)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      {tab === 'own' ? (
        <div className="space-y-2" role="tabpanel">
          <p className="text-xs leading-relaxed">
            {model.sv
              ? 'Skriv prompten själv. Importinstruktionen ger formatregler och referensdata och schemat validerar svaret.'
              : 'Write the prompt yourself. The import instruction provides format rules and reference data, and the schema validates the response.'}
          </p>
          <div className="flex flex-col gap-2">
            <button
              className={secondaryButton}
              onClick={props.onDownloadSchema}
              type="button"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              {model.sv ? 'Schema' : 'Schema'}
            </button>
            <button
              className={secondaryButton}
              disabled={!props.canDownloadDestinationFiles}
              onClick={props.onDownloadInstruction}
              type="button"
            >
              <FileJson aria-hidden="true" className="h-4 w-4" />
              {model.sv ? 'Importinstruktion' : 'Import instruction'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2" role="tabpanel">
          <div className="flex flex-col gap-2">
            <button
              className={primaryButton}
              disabled={!props.canDownloadDestinationFiles}
              onClick={model.downloadTemplate}
              type="button"
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
              {model.name}
            </button>
            <button
              className={secondaryButton}
              disabled={!props.canDownloadDestinationFiles}
              onClick={model.downloadReference}
              type="button"
            >
              <FileJson aria-hidden="true" className="h-4 w-4" />
              {model.sv ? 'Referensdatafil' : 'Reference data file'}
            </button>
          </div>
          {tab === 'm365' ? (
            <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed">
              {model.sv ? (
                <>
                  <li>Öppna Microsoft 365 Copilot Chat och skriv behovet.</li>
                  <li>
                    Öppna {model.inlineName}, kopiera allt och klistra in det i
                    samma meddelande.
                  </li>
                  <li>Bifoga referensdatafilen med gem-ikonen och skicka.</li>
                  <li>
                    Kopiera JSON-svaret, spara som .json och lägg in det här.
                  </li>
                </>
              ) : (
                <>
                  <li>Open Microsoft 365 Copilot Chat and write the need.</li>
                  <li>
                    Open the {model.inlineName}, copy everything and paste it
                    into the same message.
                  </li>
                  <li>
                    Attach the reference data file with the paperclip and send.
                  </li>
                  <li>
                    Copy the JSON response, save as .json and add it here.
                  </li>
                </>
              )}
            </ol>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed">
              {model.sv ? (
                <>
                  <li>Spara båda filerna i arbetsytan.</li>
                  <li>
                    Öppna Copilot Chat och lägg till referensdatafilen som
                    kontext.
                  </li>
                  <li>Skriv behovet och klistra in {model.inlineName}.</li>
                  <li>
                    Be Copilot spara svaret som .json och lägg in filen här.
                  </li>
                </>
              ) : (
                <>
                  <li>Save both files in the workspace.</li>
                  <li>
                    Open Copilot Chat and add the reference data file as
                    context.
                  </li>
                  <li>Write the need and paste the {model.inlineName}.</li>
                  <li>
                    Ask Copilot to save the response as .json and add the file
                    here.
                  </li>
                </>
              )}
            </ol>
          )}
          <ReferenceFreshness model={model} />
        </div>
      )}
    </>
  )
}

export default function RequirementsImportSupportPanelPrototype(
  props: SupportPanelPrototypeProps,
) {
  const variant = usePrototypeParam(VARIANT_AXIS)
  return (
    <>
      {variant === 'A' && <VariantA {...props} />}
      {variant === 'B' && <VariantB {...props} />}
      {variant === 'C' && <VariantC {...props} />}
      {variant === 'D' && <VariantD {...props} />}
      <PrototypeSwitcher axes={[VARIANT_AXIS, TERM_AXIS]} />
    </>
  )
}
