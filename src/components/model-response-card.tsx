import { Collapsible } from '@base-ui/react/collapsible'
import { ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useDetectionStore } from '@/stores/detection-store'

/** The JSON body of the latest successful call, collapsed by default. */
export function ModelResponseCard() {
  return (
    <Collapsible.Root render={<Card size="sm" />}>
      <CardHeader>
        <h2 className="font-heading text-sm leading-snug font-medium">
          <Collapsible.Trigger
            render={
              <Button
                type="button"
                variant="ghost"
                className="group -mx-2 justify-start max-sm:h-11"
              />
            }
          >
            <ChevronRightIcon
              data-icon="inline-start"
              className="transition-transform group-data-panel-open:rotate-90"
            />
            Model response
          </Collapsible.Trigger>
        </h2>
      </CardHeader>
      {/* Unmounted while closed, so a collapsed card does not re-serialize every call. */}
      <Collapsible.Panel render={<CardContent />}>
        <ResponseJson />
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

function ResponseJson() {
  const response = useDetectionStore((state) => state.lastResponse)

  if (response === null) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        No successful calls yet
      </p>
    )
  }
  return (
    <pre
      tabIndex={0}
      aria-label="JSON body of the latest successful call"
      className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden"
    >
      {JSON.stringify(response, null, 2)}
    </pre>
  )
}
