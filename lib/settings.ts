import type { Storage } from "@plasmohq/storage"

export const QUALITY_MIN = 10
export const QUALITY_MAX = 100

export type Settings = {
  enabled: boolean
  editorDropUpload: boolean
  editorPasteUpload: boolean
  modalDropUpload: boolean
  modalFileUpload: boolean
  modalPasteUpload: boolean
  showProgress: boolean
  quality: number
}

export type SettingsKey = keyof Settings
type LegacySettingsKey = "compressOnDrag" | "compressOnUpload"
type StoredSettingsKey = SettingsKey | LegacySettingsKey

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  editorDropUpload: true,
  editorPasteUpload: true,
  modalDropUpload: true,
  modalFileUpload: true,
  modalPasteUpload: true,
  showProgress: true,
  quality: 90
}

export const SETTINGS_KEYS = [
  "enabled",
  "editorDropUpload",
  "editorPasteUpload",
  "modalDropUpload",
  "modalFileUpload",
  "modalPasteUpload",
  "showProgress",
  "quality"
] as const satisfies readonly SettingsKey[]

const LEGACY_SETTINGS_KEYS = [
  "compressOnDrag",
  "compressOnUpload"
] as const satisfies readonly LegacySettingsKey[]

const STORED_SETTINGS_KEYS = [
  ...SETTINGS_KEYS,
  ...LEGACY_SETTINGS_KEYS
] as const satisfies readonly StoredSettingsKey[]

export async function readSettings(storage: Storage): Promise<Settings> {
  const values = await storage.getMany([...STORED_SETTINGS_KEYS])

  return normalizeSettings(values)
}

export function normalizeSettings(
  values: Partial<Record<StoredSettingsKey, unknown>>
): Settings {
  const legacyDrag = readOptionalBoolean(values.compressOnDrag)
  const legacyUpload = readOptionalBoolean(values.compressOnUpload)

  return {
    enabled: readBoolean(values.enabled, DEFAULT_SETTINGS.enabled),
    editorDropUpload: readBoolean(
      values.editorDropUpload,
      legacyDrag ?? DEFAULT_SETTINGS.editorDropUpload
    ),
    editorPasteUpload: readBoolean(
      values.editorPasteUpload,
      legacyUpload ?? DEFAULT_SETTINGS.editorPasteUpload
    ),
    modalDropUpload: readBoolean(
      values.modalDropUpload,
      legacyDrag ?? DEFAULT_SETTINGS.modalDropUpload
    ),
    modalFileUpload: readBoolean(
      values.modalFileUpload,
      legacyUpload ?? DEFAULT_SETTINGS.modalFileUpload
    ),
    modalPasteUpload: readBoolean(
      values.modalPasteUpload,
      legacyUpload ?? DEFAULT_SETTINGS.modalPasteUpload
    ),
    showProgress: readBoolean(
      values.showProgress,
      DEFAULT_SETTINGS.showProgress
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

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}
