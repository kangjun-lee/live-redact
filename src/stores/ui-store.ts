import { create } from 'zustand'

interface UiState {
  /** Model settings dialog; opened from the header and from "Add API key" prompts. */
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()((set) => ({
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}))
