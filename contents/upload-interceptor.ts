import type { PlasmoCSConfig } from "plasmo"

type Settings = {
  compressOnDrag: boolean
  compressOnUpload: boolean
  enabled: boolean
  quality: number
}

type UploadContext = {
  expiresAt: number
  source: "drag"
}

export const config: PlasmoCSConfig = {
  all_frames: false,
  matches: ["https://*.dcinside.com/*"],
  run_at: "document_start",
  world: "MAIN"
}

const SETTINGS_EVENT_NAME = "dcinside-autowebp:settings"
const UPLOAD_CONTEXT_EVENT_NAME = "dcinside-autowebp:upload-context"
const WEBP_MIME_TYPE = "image/webp"
const CONTEXT_TTL_MS = 15000
const CONVERTIBLE_IMAGE_TYPE_PATTERN =
  /^image\/(png|x-png|jpe?g|pjpeg|bmp|x-bmp|x-ms-bmp|avif)$/i
const CONVERTIBLE_IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|jfif|bmp|avif)$/i
const UPLOAD_IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|jfif|bmp|gif|webp)$/i
const DEFAULT_SETTINGS: Settings = {
  compressOnDrag: true,
  compressOnUpload: true,
  enabled: true,
  quality: 90
}

let currentSettings = DEFAULT_SETTINGS
let uploadContext: UploadContext | null = null

window.addEventListener(SETTINGS_EVENT_NAME, handleSettingsEvent)
window.addEventListener(UPLOAD_CONTEXT_EVENT_NAME, handleUploadContextEvent)
patchFetch()
patchXhr()

function handleSettingsEvent(event: Event): void {
  const detail = getEventDetail(event)
  if (typeof detail !== "string") return

  try {
    currentSettings = normalizeSettings(JSON.parse(detail))
  } catch (error) {
    console.warn("[dcinside-autowebp] Failed to parse settings", error)
  }
}

function handleUploadContextEvent(event: Event): void {
  if (getEventDetail(event) !== "drag") return

  uploadContext = {
    expiresAt: Date.now() + CONTEXT_TTL_MS,
    source: "drag"
  }
}

function patchFetch(): void {
  const originalFetch = window.fetch

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    if (init?.body instanceof FormData) {
      return originalFetch.call(window, input, {
        ...init,
        body: await convertFormData(init.body)
      })
    }

    return originalFetch.call(window, input, init)
  }
}

function patchXhr(): void {
  const originalSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.send = function patchedSend(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ): void {
    if (!(body instanceof FormData)) {
      originalSend.call(this, body)
      return
    }

    convertFormData(body)
      .then((convertedBody) => originalSend.call(this, convertedBody))
      .catch((error) => {
        showConversionError(error)
        try {
          this.abort()
        } catch {}
      })
  }
}

async function convertFormData(formData: FormData): Promise<FormData> {
  if (!shouldConvertCurrentUpload()) return formData

  let converted = false
  const nextFormData = new FormData()

  for (const [name, value] of formData.entries()) {
    if (!(value instanceof File) || !shouldConvertFile(value)) {
      nextFormData.append(name, value)
      continue
    }

    const nextFile = await convertImageToWebp(value, currentSettings.quality)
    nextFormData.append(name, nextFile, nextFile.name)
    converted = true
  }

  return converted ? nextFormData : formData
}

function shouldConvertCurrentUpload(): boolean {
  if (!currentSettings.enabled || !uploadContext) return false
  if (uploadContext.expiresAt < Date.now()) {
    uploadContext = null
    return false
  }

  return uploadContext.source === "drag" && currentSettings.compressOnDrag
}

function shouldConvertFile(file: File): boolean {
  if (file.type) return CONVERTIBLE_IMAGE_TYPE_PATTERN.test(file.type)

  return (
    CONVERTIBLE_IMAGE_EXTENSION_PATTERN.test(file.name) ||
    !UPLOAD_IMAGE_EXTENSION_PATTERN.test(file.name)
  )
}

async function convertImageToWebp(file: File, quality: number): Promise<File> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement("canvas")
    canvas.width = image.width
    canvas.height = image.height

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Failed to create canvas context")
    }

    context.drawImage(image, 0, 0)

    const blob = await canvasToWebpBlob(canvas, normalizeQuality(quality))

    return new File([blob], getWebpFileName(file.name), {
      lastModified: file.lastModified,
      type: WEBP_MIME_TYPE
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function canvasToWebpBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error("Failed to convert image to WebP"))
        }
      },
      WEBP_MIME_TYPE,
      quality / 100
    )
  })
}

function getWebpFileName(fileName: string): string {
  const safeName = normalizeFileBaseName(fileName)
  const nextName = safeName.replace(
    CONVERTIBLE_IMAGE_EXTENSION_PATTERN,
    ".webp"
  )

  return nextName === safeName ? `${safeName}.webp` : nextName
}

function normalizeFileBaseName(fileName: string): string {
  return fileName.trim().replace(/\.+$/, "") || "image"
}

function normalizeSettings(value: unknown): Settings {
  const partial = isObject(value) ? value : {}

  return {
    compressOnDrag: readBoolean(
      partial.compressOnDrag,
      DEFAULT_SETTINGS.compressOnDrag
    ),
    compressOnUpload: readBoolean(
      partial.compressOnUpload,
      DEFAULT_SETTINGS.compressOnUpload
    ),
    enabled: readBoolean(partial.enabled, DEFAULT_SETTINGS.enabled),
    quality: normalizeQuality(partial.quality)
  }
}

function normalizeQuality(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.quality

  return Math.min(100, Math.max(10, Math.round(parsed)))
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function isObject(value: unknown): value is Partial<Settings> {
  return typeof value === "object" && value !== null
}

function getEventDetail(event: Event): unknown {
  return "detail" in event ? (event as CustomEvent<unknown>).detail : undefined
}

function showConversionError(error: unknown): void {
  console.warn("[dcinside-autowebp] Image conversion failed", error)
  window.alert(
    "\uc774\ubbf8\uc9c0\ub97c WebP\ub85c \ubcc0\ud658\ud558\uc9c0 \ubabb\ud574 \uc5c5\ub85c\ub4dc\ub97c \uc911\ub2e8\ud588\uc2b5\ub2c8\ub2e4."
  )
}
