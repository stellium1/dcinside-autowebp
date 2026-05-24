import { useEffect, useRef, useState } from "react"

import { Storage } from "@plasmohq/storage"

import {
  DEFAULT_SETTINGS,
  normalizeQuality,
  readSettings,
  type Settings,
  type SettingsKey
} from "../lib/settings"

const storage = new Storage()
const SAVE_DELAY_MS = 220

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true

    readSettings(storage)
      .then((nextSettings) => {
        if (mounted) {
          setSettings(nextSettings)
        }
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [])

  const saveSetting = <Key extends SettingsKey>(
    key: Key,
    value: Settings[Key]
  ) => {
    const nextValue = normalizeSettingValue(key, value)

    setSettings((current) => ({ ...current, [key]: nextValue }))
    storage.set(key, nextValue)
  }

  const saveQualityDebounced = (quality: number) => {
    const nextQuality = normalizeQuality(quality)

    setSettings((current) => ({ ...current, quality: nextQuality }))

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
    }

    saveTimer.current = window.setTimeout(() => {
      storage.set("quality", nextQuality)
      saveTimer.current = null
    }, SAVE_DELAY_MS)
  }

  const saveQualityImmediately = (quality: number) => {
    saveSetting("quality", normalizeQuality(quality))
  }

  return {
    settings,
    saveSetting,
    saveQualityDebounced,
    saveQualityImmediately
  }
}

function normalizeSettingValue<Key extends SettingsKey>(
  key: Key,
  value: Settings[Key]
): Settings[Key] {
  return (key === "quality" ? normalizeQuality(value) : value) as Settings[Key]
}
