import { MoonIcon, SunIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings-store'

export function ThemeToggle() {
  const theme = useSettingsStore((state) => state.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className="max-sm:size-11"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}
