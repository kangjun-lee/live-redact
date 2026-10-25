import { useEffect } from 'react'

import { useCameraStore } from '@/stores/camera-store'
import { useDetectionStore } from '@/stores/detection-store'
import { useSettingsStore } from '@/stores/settings-store'

/**
 * Starts the camera without a click when permission was already granted, keeps the device list
 * current, and stops detection when the camera is off or failed (switching cameras keeps it).
 */
export function useCameraBootstrap(): void {
  const cameraStatus = useCameraStore((state) => state.status)

  useEffect(() => {
    const camera = useCameraStore.getState()
    let permission: PermissionStatus | null = null
    let disposed = false

    const onPermissionChange = () => {
      if (permission?.state === 'granted' && useCameraStore.getState().status !== 'live') {
        void useCameraStore.getState().start(useSettingsStore.getState().params.deviceId)
      }
    }
    const onDeviceChange = () => void useCameraStore.getState().refreshDevices()

    // Firefox and older Safari reject the 'camera' permission name; they fall back to the button.
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((status) => {
        if (disposed) return
        permission = status
        status.addEventListener('change', onPermissionChange)
        onPermissionChange()
      })
      .catch(() => {})

    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)
    void camera.refreshDevices()

    return () => {
      disposed = true
      permission?.removeEventListener('change', onPermissionChange)
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
      useCameraStore.getState().stop()
    }
  }, [])

  useEffect(() => {
    const off = cameraStatus === 'idle' || cameraStatus === 'error'
    if (off && useDetectionStore.getState().running) {
      useDetectionStore.getState().stop('Detection stopped because the camera is off.')
    }
  }, [cameraStatus])
}
