import { create } from 'zustand'

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'error'

export type CameraErrorKind =
  | 'unsupported'
  | 'denied'
  | 'not-found'
  | 'in-use'
  | 'ended'
  | 'unknown'

export interface CameraError {
  kind: CameraErrorKind
  message: string
}

interface CameraState {
  status: CameraStatus
  error: CameraError | null
  stream: MediaStream | null
  devices: MediaDeviceInfo[]
  activeDeviceId: string | null
  /** Intrinsic size of the live video, used for aspect ratio and the mosaic canvas. */
  frameSize: { width: number; height: number } | null
  /** Starts (or switches) the camera. Falls back to the default camera if `deviceId` is gone. */
  start: (deviceId: string | null) => Promise<void>
  stop: () => void
  refreshDevices: () => Promise<void>
  setFrameSize: (frameSize: { width: number; height: number } | null) => void
}

function describeCameraError(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        kind: 'denied',
        message:
          'Camera access is blocked. Allow the camera for this site from the icon in the address bar (and in your system privacy settings on macOS), then try again.',
      }
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { kind: 'not-found', message: 'No camera was found. Connect one and try again.' }
    case 'NotReadableError':
    case 'AbortError':
      return {
        kind: 'in-use',
        message: 'The camera could not start. Another app may be using it; close it and try again.',
      }
    default:
      return {
        kind: 'unknown',
        message: `The camera could not start: ${error instanceof Error ? error.message : String(error)}`,
      }
  }
}

function constraints(deviceId: string | null): MediaStreamConstraints {
  const size = { width: { ideal: 1280 }, height: { ideal: 720 } }
  return {
    audio: false,
    video: deviceId ? { ...size, deviceId: { exact: deviceId } } : { ...size, facingMode: 'user' },
  }
}

/** Incremented per start() so a slow, superseded getUserMedia call cannot overwrite a newer one. */
let requestSeq = 0

export const useCameraStore = create<CameraState>()((set, get) => ({
  status: 'idle',
  error: null,
  stream: null,
  devices: [],
  activeDeviceId: null,
  frameSize: null,

  start: async (deviceId) => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      set({
        status: 'error',
        error: {
          kind: 'unsupported',
          message:
            'This browser does not expose the camera here. Open the app over HTTPS or on localhost in a current browser.',
        },
      })
      return
    }

    const seq = ++requestSeq
    get().stop()
    set({ status: 'requesting', error: null })

    let stream: MediaStream
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints(deviceId))
      } catch (error) {
        const gone =
          error instanceof DOMException &&
          (error.name === 'OverconstrainedError' || error.name === 'NotFoundError')
        if (!deviceId || !gone) throw error
        stream = await navigator.mediaDevices.getUserMedia(constraints(null))
      }
    } catch (error) {
      if (seq === requestSeq) set({ status: 'error', error: describeCameraError(error) })
      return
    }

    if (seq !== requestSeq) {
      for (const track of stream.getTracks()) track.stop()
      return
    }

    const [track] = stream.getVideoTracks()
    track.addEventListener('ended', () => {
      if (get().stream !== stream) return
      set({
        status: 'error',
        stream: null,
        error: {
          kind: 'ended',
          message: 'The camera stopped. It may have been unplugged or its permission revoked.',
        },
      })
    })
    set({ status: 'live', stream, activeDeviceId: track.getSettings().deviceId ?? null })
    // Device labels are only exposed after permission is granted.
    await get().refreshDevices()
  },

  stop: () => {
    const { stream } = get()
    if (stream) for (const track of stream.getTracks()) track.stop()
    set({ stream: null, status: 'idle' })
  },

  setFrameSize: (frameSize) => set({ frameSize }),

  refreshDevices: async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      set({ devices: all.filter((device) => device.kind === 'videoinput' && device.deviceId) })
    } catch {
      // Enumeration is best-effort; the camera select just stays empty.
    }
  },
}))
