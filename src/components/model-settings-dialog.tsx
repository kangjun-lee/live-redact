import { Collapsible } from '@base-ui/react/collapsible'
import {
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { toApiError } from '@/lib/api-error'
import { formatUsd } from '@/lib/format'
import {
  models,
  priceTierAt,
  providers,
  resolveModelOptions,
  type ChoiceOptionSpec,
  type ModelOptionSpec,
  type RangeOptionSpec,
  type ModelPricing,
  type ProviderId,
} from '@/lib/models'
import { useDetectionStore } from '@/stores/detection-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useUiStore } from '@/stores/ui-store'

const MODEL_ITEMS = Object.entries(models).map(([value, model]) => ({ value, label: model.label }))
// Object.keys widens to string[]; the keys of a Record<ProviderId, …> literal are exactly ProviderId.
const PROVIDER_IDS = Object.keys(providers) as ProviderId[]

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok' }
  | { status: 'error'; message: string }

function priceSummary(pricing: ModelPricing): string {
  const tier = priceTierAt(pricing, new Date())
  const output =
    tier.outputPerMTok === 0 ? 'output free' : `${formatUsd(tier.outputPerMTok)} output`
  const until = tier.until ? ` until ${tier.until}` : ''
  return `${formatUsd(tier.inputPerMTok)} input, ${output} per 1M tokens${until}`
}

interface OptionFieldProps<Spec extends ModelOptionSpec = ModelOptionSpec> {
  option: Spec
  value: number
  onChange: (value: number) => void
}

function OptionField({ option, ...props }: OptionFieldProps) {
  return option.kind === 'choice' ? (
    <OptionSelect option={option} {...props} />
  ) : (
    <OptionSlider option={option} {...props} />
  )
}

function OptionSlider({ option, value, onChange }: OptionFieldProps<RangeOptionSpec>) {
  const labelId = useId()

  return (
    <Field className="gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <FieldTitle id={labelId}>{option.label}</FieldTitle>
        <span className="text-sm tabular-nums">
          {value.toLocaleString('en-US')}
          {option.unit && (
            <span className="ml-0.5 text-xs text-muted-foreground">{option.unit}</span>
          )}
        </span>
      </div>
      <Slider
        aria-labelledby={labelId}
        min={option.min}
        max={option.max}
        step={option.step}
        value={[value]}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
      {option.description && <FieldDescription>{option.description}</FieldDescription>}
    </Field>
  )
}

function OptionSelect({ option, value, onChange }: OptionFieldProps<ChoiceOptionSpec>) {
  const triggerId = useId()

  return (
    <Field>
      <FieldLabel htmlFor={triggerId}>{option.label}</FieldLabel>
      <Select
        items={option.choices}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next)
        }}
      >
        <SelectTrigger id={triggerId} className="w-full max-sm:h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {option.choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {option.description && <FieldDescription>{option.description}</FieldDescription>}
    </Field>
  )
}

export function ModelSettingsDialog() {
  const open = useUiStore((state) => state.settingsOpen)
  const setOpen = useUiStore((state) => state.setSettingsOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" className="max-sm:h-11" />}>
        <SlidersHorizontalIcon data-icon="inline-start" />
        Model settings
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so every opening starts from the saved settings. */}
        <ModelSettingsForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ModelSettingsForm({ onDone }: { onDone: () => void }) {
  const saved = useSettingsStore.getState()
  const [modelId, setModelId] = useState(saved.modelId)
  const [apiKeys, setApiKeys] = useState(saved.apiKeys)
  const [modelOptions, setModelOptions] = useState(saved.modelOptions)
  const [showKey, setShowKey] = useState(false)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const testController = useRef<AbortController | null>(null)
  const ids = { model: useId(), key: useId(), keyHelp: useId() }

  const model = models[modelId]
  const provider = providers[model.provider]
  const apiKey = apiKeys[model.provider]
  const optionValues = resolveModelOptions(model, modelOptions[modelId])

  useEffect(() => () => testController.current?.abort(), [])

  function cancelTest() {
    testController.current?.abort()
    setTest({ status: 'idle' })
  }

  async function runTest() {
    testController.current?.abort()
    const controller = new AbortController()
    testController.current = controller
    setTest({ status: 'testing' })
    try {
      await model.testApiKey(apiKey.trim(), controller.signal)
      setTest({ status: 'ok' })
    } catch (error) {
      if (controller.signal.aborted) return
      setTest({ status: 'error', message: toApiError(error).message })
    }
  }

  function save(event: FormEvent) {
    event.preventDefault()
    const settings = useSettingsStore.getState()
    const activeModel = models[settings.modelId]
    const before = resolveModelOptions(activeModel, settings.modelOptions[settings.modelId])
    const after = resolveModelOptions(activeModel, modelOptions[settings.modelId])
    const optionsChanged = Object.keys(before).some((key) => before[key] !== after[key])
    if (modelId !== settings.modelId || optionsChanged) {
      // Metrics describe one setup; mixing two would make averages and cost per hour meaningless.
      useDetectionStore.getState().resetStats()
      settings.setModelId(modelId)
    }
    for (const [id, values] of Object.entries(modelOptions)) settings.setModelOptions(id, values)
    for (const id of PROVIDER_IDS) settings.setApiKey(id, apiKeys[id].trim())
    onDone()
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Model settings</DialogTitle>
      </DialogHeader>

      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor={ids.model}>Model</FieldLabel>
          <Select
            items={MODEL_ITEMS}
            value={modelId}
            onValueChange={(value) => {
              if (!value) return
              setModelId(value)
              cancelTest()
            }}
          >
            <SelectTrigger id={ids.model} className="w-full max-sm:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_IDS.map((providerId) => (
                <SelectGroup key={providerId}>
                  <SelectLabel>{providers[providerId].label}</SelectLabel>
                  {Object.entries(models)
                    .filter(([, candidate]) => candidate.provider === providerId)
                    .map(([value, candidate]) => (
                      <SelectItem key={value} value={value}>
                        {candidate.label}
                      </SelectItem>
                    ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            List price: {priceSummary(model.pricing)} (
            <a href={model.pricing.sourceUrl} target="_blank" rel="noreferrer">
              checked {model.pricing.checkedOn}
            </a>
            ).
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor={ids.key}>{provider.label} API key</FieldLabel>
          <div className="flex gap-2">
            <Input
              id={ids.key}
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder={provider.keyPlaceholder}
              aria-describedby={ids.keyHelp}
              className="max-sm:h-11"
              value={apiKey}
              onChange={(event) => {
                setApiKeys((keys) => ({ ...keys, [model.provider]: event.target.value }))
                cancelTest()
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="max-sm:size-11"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              aria-pressed={showKey}
              onClick={() => setShowKey((value) => !value)}
            >
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </Button>
          </div>
          <FieldDescription id={ids.keyHelp}>
            Create one at{' '}
            <a href={provider.keyConsoleUrl} target="_blank" rel="noreferrer">
              {new URL(provider.keyConsoleUrl).host}
            </a>
            .
          </FieldDescription>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              type="button"
              variant="secondary"
              className="max-sm:h-11"
              disabled={!apiKey.trim() || test.status === 'testing'}
              onClick={runTest}
            >
              {test.status === 'testing' ? (
                <>
                  <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                  Testing…
                </>
              ) : (
                'Test API key'
              )}
            </Button>
            <p
              role="status"
              aria-live="polite"
              className={
                test.status === 'error'
                  ? 'flex min-w-0 flex-1 items-start gap-1.5 text-sm text-destructive'
                  : 'flex min-w-0 flex-1 items-start gap-1.5 text-sm text-success'
              }
            >
              {test.status === 'ok' && (
                <>
                  <CircleCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                  API key is valid
                </>
              )}
              {test.status === 'error' && (
                <>
                  <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {test.message}
                </>
              )}
            </p>
          </div>
        </Field>

        {model.options.length > 0 && (
          <Collapsible.Root>
            <Collapsible.Trigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  className="group -ml-2 justify-start max-sm:h-11"
                />
              }
            >
              <ChevronRightIcon
                data-icon="inline-start"
                className="transition-transform group-data-panel-open:rotate-90"
              />
              Advanced
            </Collapsible.Trigger>
            <Collapsible.Panel className="pt-3">
              <FieldSet>
                <FieldLegend variant="label">{model.label} options</FieldLegend>
                {model.options.map((option) => (
                  <OptionField
                    key={option.key}
                    option={option}
                    value={optionValues[option.key]}
                    onChange={(value) =>
                      setModelOptions((saved) => ({
                        ...saved,
                        [modelId]: { ...optionValues, [option.key]: value },
                      }))
                    }
                  />
                ))}
              </FieldSet>
            </Collapsible.Panel>
          </Collapsible.Root>
        )}
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" className="max-sm:h-11" />}>
          Cancel
        </DialogClose>
        <Button type="submit" className="max-sm:h-11">
          Save settings
        </Button>
      </DialogFooter>
    </form>
  )
}
