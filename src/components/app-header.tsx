import { ModelSettingsDialog } from '@/components/model-settings-dialog'
import { ThemeToggle } from '@/components/theme-toggle'

export function AppHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <img src="/favicon.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
          <h1 className="sr-only text-base font-semibold tracking-tight sm:not-sr-only">
            Live Redact
          </h1>
        </div>
        <ThemeToggle />
        <ModelSettingsDialog />
      </div>
    </header>
  )
}
