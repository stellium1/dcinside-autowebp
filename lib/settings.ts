import type { Storage } from "@plasmohq/storage"

export const QUALITY_MIN = 10
export const QUALITY_MAX = 100

export type Settings = {
  enabled: boolean
  compressOnDrag: boolean
  compressOnUpload: boolean
  quality: number
}

export type SettingsKey = keyof Settings

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  compressOnDrag: true,
  compressOnUpload: true,
  quality: 90
}

export const SETTINGS_KEYS = [
  "enabled",
  "compressOnDrag",
  "compressOnUpload",
  "quality"
] as const satisfies readonly SettingsKey[]

export async function readSettings(storage: Storage): Promise<Settings> {
  const values = await storage.getMany([...SETTINGS_KEYS])

  return normalizeSettings(values)
}

export function normalizeSettings(
  values: Partial<Record<SettingsKey, unknown>>
): Settings {
  return {
    enabled: readBoolean(values.enabled, DEFAULT_SETTINGS.enabled),
    compressOnDrag: readBoolean(
      values.compressOnDrag,
      DEFAULT_SETTINGS.compressOnDrag
    ),
    compressOnUpload: readBoolean(
      values.compressOnUpload,
      DEFAULT_SETTINGS.compressOnUpload
    ),
    quality: normalizeQuality(values.quality)
  }
}

export function normalizeQuality(
  value: unknown,
  fallback = DEFAULT_SETTINGS.quality
): number {
  const parsed = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(QUALITY_MAX, Math.max(QUALITY_MIN, Math.round(parsed)))
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}
