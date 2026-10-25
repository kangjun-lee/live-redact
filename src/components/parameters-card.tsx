import { useId } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useCameraStore } from '@/stores/camera-store'
import { type DetectionParams, PARAM_LIMITS, useSettingsStore } from '@/stores/settings-store'

type SliderParam = keyof typeof PARAM_LIMITS

interface SliderFieldProps {
  param: SliderParam
  label: string
  unit?: string
}

function SliderField({ param, label, unit }: SliderFieldProps) {
  const value = useSettingsStore((state) => state.params[param])
  const setParam = useSettingsStore((state) => state.setParam)
  const labelId = useId()
  const { min, max, step } = PARAM_LIMITS[param]

  return (
    <Field className="gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <FieldTitle id={labelId}>{label}</FieldTitle>
        <span className="text-sm tabular-nums">
          {value.toLocaleString('en-US')}
          {unit && <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>}
        </span>
      </div>
      <Slider
        aria-labelledby={labelId}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => setParam(param, Array.isArray(next) ? next[0] : next)}
      />
    </Field>
  )
}

export function ParametersCard() {
  const target = useSettingsStore((state) => state.params.target)
  const liveVideo = useSettingsStore((state) => state.params.liveVideo)
  const setParam = useSettingsStore((state) => state.setParam)
  const devices = useCameraStore((state) => state.devices)
  const activeDeviceId = useCameraStore((state) => state.activeDeviceId)
  const cameraLive = useCameraStore((state) => state.status === 'live')
  const targetId = useId()
  const cameraId = useId()
  const liveVideoId = useId()
  const targetMissing = target.trim() === ''

  const cameraItems = devices.map((device, index) => ({
    value: device.deviceId,
    label: device.label || `Camera ${index + 1}`,
  }))

  function selectCamera(deviceId: DetectionParams['deviceId']) {
    setParam('deviceId', deviceId)
    void useCameraStore.getState().start(deviceId)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parameters</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-5">
          <SliderField param="intervalMs" label="Interval" unit="ms" />
          <SliderField param="mosaicBlock" label="Mosaic block" unit="px" />
          <SliderField param="mosaicPadding" label="Mosaic padding" unit="%" />
          <SliderField param="boxPadding" label="Box padding" unit="%" />
          <SliderField param="maxFaces" label="Max faces" />

          <Field orientation="horizontal">
            <FieldLabel htmlFor={liveVideoId}>Live video for mosaic</FieldLabel>
            <Switch
              id={liveVideoId}
              checked={liveVideo}
              onCheckedChange={(checked) => setParam('liveVideo', checked)}
            />
          </Field>

          <Field data-invalid={targetMissing}>
            <FieldLabel htmlFor={targetId}>Mosaic target</FieldLabel>
            <Input
              id={targetId}
              value={target}
              placeholder="human faces, license plates, …"
              aria-invalid={targetMissing}
              className="max-sm:h-11"
              onChange={(event) => setParam('target', event.target.value)}
            />
            {targetMissing && (
              <FieldError>Describe what to find, for example “human faces”.</FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor={cameraId}>Camera</FieldLabel>
            <Select
              items={cameraItems}
              value={activeDeviceId}
              onValueChange={(value) => value && selectCamera(value)}
              disabled={cameraItems.length === 0}
            >
              <SelectTrigger id={cameraId} className="w-full max-sm:h-11">
                <SelectValue placeholder={cameraLive ? 'Default camera' : 'Camera is off'} />
              </SelectTrigger>
              <SelectContent>
                {cameraItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
