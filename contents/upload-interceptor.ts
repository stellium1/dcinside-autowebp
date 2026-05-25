import type { PlasmoCSConfig } from "plasmo"

type Settings = {
  editorDropUpload: boolean
  editorPasteUpload: boolean
  enabled: boolean
  modalDropUpload: boolean
  modalFileUpload: boolean
  modalPasteUpload: boolean
  quality: number
  showProgress: boolean
}

type UploadSource =
  | "editor-drop"
  | "editor-paste"
  | "modal-drop"
  | "modal-file"
  | "modal-paste"

type UploadContext = {
  completed: number
  expiresAt: number
  processed: number
  source: UploadSource
  total?: number
}

type ProgressDetail = {
  current?: number
  message?: string
  percent?: number
  phase: "converting" | "uploading"
  source?: UploadSource
  status: "active" | "done" | "error"
  total?: number
}

export const config: PlasmoCSConfig = {
  all_frames: false,
  matches: ["https://*.dcinside.com/*"],
  run_at: "document_start",
  world: "MAIN"
}

const SETTINGS_EVENT_NAME = "dcinside-autowebp:settings"
const UPLOAD_CONTEXT_EVENT_NAME = "dcinside-autowebp:upload-context"
const PROGRESS_EVENT_NAME = "dcinside-autowebp:progress"
const WEBP_MIME_TYPE = "image/webp"
const CONTEXT_TTL_MS = 15000
const CONVERTIBLE_IMAGE_TYPE_PATTERN =
  /^image\/(png|x-png|jpe?g|pjpeg|bmp|x-bmp|x-ms-bmp|avif)$/i
const CONVERTIBLE_IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|jfif|bmp|avif)$/i
const UPLOAD_IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|jfif|bmp|gif|webp)$/i
const DEFAULT_SETTINGS: Settings = {
  editorDropUpload: true,
  editorPasteUpload: true,
  enabled: true,
  modalDropUpload: true,
  modalFileUpload: true,
  modalPasteUpload: true,
  quality: 90,
  showProgress: true
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
  const context = readUploadContext(getEventDetail(event))
  if (!context) return

  uploadContext = {
    completed: 0,
    expiresAt: Date.now() + CONTEXT_TTL_MS,
    processed: 0,
    source: context.source,
    total: context.total
  }
}

function patchFetch(): void {
  const originalFetch = window.fetch

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    if (!(init?.body instanceof FormData)) {
      return originalFetch.call(window, input, init)
    }

    const { context, fileCount, formData } = await prepareFormData(init.body)
    if (!context) {
      return originalFetch.call(window, input, init)
    }

    reportUploadStart(context, fileCount)

    try {
      const response = await originalFetch.call(window, input, {
        ...init,
        body: formData
      })

      reportUploadEnd(context, response.ok, fileCount)
      return response
    } catch (error) {
      reportProgress({
        message: "이미지 업로드 실패",
        phase: "uploading",
        source: context.source,
        status: "error"
      })
      clearUploadContext(context)
      throw error
    }
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

    prepareFormData(body)
      .then(({ context, fileCount, formData }) => {
        if (context) {
          attachXhrUploadProgress(this, context, fileCount)
        }

        originalSend.call(this, formData)
      })
      .catch((error) => {
        showConversionError(error)
        try {
          this.abort()
        } catch {}
      })
  }
}

async function prepareFormData(formData: FormData): Promise<{
  context: UploadContext | null
  fileCount: number
  formData: FormData
}> {
  const context = getActiveUploadContext()
  if (!context) return { context: null, fileCount: 0, formData }

  const entries = Array.from(formData.entries())
  const fileCount = entries.filter(([, value]) => value instanceof File).length
  if (fileCount === 0) return { context: null, fileCount: 0, formData }
  if (!shouldConvertContext(context)) return { context, fileCount, formData }

  let converted = false
  const nextFormData = new FormData()
  const total = getContextTotal(context, fileCount)

  if (fileCount > 0) {
    reportProgress({
      current: getContextCurrent(context),
      message: "이미지 WebP 변환 중",
      phase: "converting",
      source: context.source,
      status: "active",
      total
    })
  }

  for (const [name, value] of entries) {
    if (!(value instanceof File) || !shouldConvertFile(value)) {
      nextFormData.append(name, value)
      if (value instanceof File) {
        context.processed += 1
        reportProgress({
          current: getContextCurrent(context),
          message: "이미지 WebP 변환 중",
          phase: "converting",
          source: context.source,
          status: "active",
          total
        })
      }
      continue
    }

    const nextFile = await convertImageToWebp(value, currentSettings.quality)
    nextFormData.append(name, nextFile, nextFile.name)
    converted = true
    context.processed += 1
    reportProgress({
      current: getContextCurrent(context),
      message: "이미지 WebP 변환 중",
      phase: "converting",
      source: context.source,
      status: "active",
      total
    })
  }

  return { context, fileCount, formData: converted ? nextFormData : formData }
}

function getActiveUploadContext(): UploadContext | null {
  if (!currentSettings.enabled || !uploadContext) return null
  if (uploadContext.expiresAt < Date.now()) {
    uploadContext = null
    return null
  }

  return uploadContext
}

function shouldConvertContext(context: UploadContext): boolean {
  switch (context.source) {
    case "editor-drop":
      return currentSettings.editorDropUpload
    case "editor-paste":
      return currentSettings.editorPasteUpload
    default:
      return false
  }
}

function clearUploadContext(context: UploadContext): void {
  if (uploadContext === context) {
    uploadContext = null
  }
}

function getContextTotal(
  context: UploadContext,
  fallback: number
): number | undefined {
  return context.total ?? (fallback > 0 ? fallback : undefined)
}

function getContextCurrent(context: UploadContext): number | undefined {
  const total = getContextTotal(context, 0)
  const current = Math.max(context.completed, context.processed)

  if (!total) return current > 0 ? current : undefined
  return Math.min(total, current)
}

function reportUploadStart(context: UploadContext, fileCount: number): void {
  reportProgress({
    current: getUploadCurrent(context, fileCount),
    message: "이미지 업로드 중",
    phase: "uploading",
    source: context.source,
    status: "active",
    total: getContextTotal(context, 0)
  })
}

function reportUploadEnd(
  context: UploadContext,
  ok: boolean,
  fileCount: number
): void {
  if (ok) {
    context.completed += Math.max(1, fileCount)
  }

  const total = getContextTotal(context, fileCount)
  const isComplete = ok && (!total || context.completed >= total)

  reportProgress({
    current: getContextCurrent(context),
    message: ok
      ? isComplete
        ? "이미지 업로드 완료"
        : "이미지 업로드 중"
      : "이미지 업로드 실패",
    percent: isComplete ? 100 : undefined,
    phase: "uploading",
    source: context.source,
    status: ok ? (isComplete ? "done" : "active") : "error",
    total
  })

  if (!ok || isComplete) {
    clearUploadContext(context)
  }
}

function attachXhrUploadProgress(
  xhr: XMLHttpRequest,
  context: UploadContext,
  fileCount: number
): void {
  reportUploadStart(context, fileCount)

  xhr.addEventListener(
    "loadend",
    () => {
      const ok = xhr.status >= 200 && xhr.status < 400
      reportUploadEnd(context, ok, fileCount)
    },
    { once: true }
  )
}

function getUploadCurrent(
  context: UploadContext,
  fileCount: number
): number | undefined {
  const total = getContextTotal(context, fileCount)
  const current = getContextCurrent(context) ?? 0
  const active = context.completed + 1

  if (!total) return Math.max(current, active)
  return Math.min(total, Math.max(current, active))
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
  const legacyDrag = readOptionalBoolean(partial.compressOnDrag)
  const legacyUpload = readOptionalBoolean(partial.compressOnUpload)

  return {
    editorDropUpload: readBoolean(
      partial.editorDropUpload,
      legacyDrag ?? DEFAULT_SETTINGS.editorDropUpload
    ),
    editorPasteUpload: readBoolean(
      partial.editorPasteUpload,
      legacyUpload ?? DEFAULT_SETTINGS.editorPasteUpload
    ),
    enabled: readBoolean(partial.enabled, DEFAULT_SETTINGS.enabled),
    modalDropUpload: readBoolean(
      partial.modalDropUpload,
      legacyDrag ?? DEFAULT_SETTINGS.modalDropUpload
    ),
    modalFileUpload: readBoolean(
      partial.modalFileUpload,
      legacyUpload ?? DEFAULT_SETTINGS.modalFileUpload
    ),
    modalPasteUpload: readBoolean(
      partial.modalPasteUpload,
      legacyUpload ?? DEFAULT_SETTINGS.modalPasteUpload
    ),
    quality: normalizeQuality(partial.quality),
    showProgress: readBoolean(
      partial.showProgress,
      DEFAULT_SETTINGS.showProgress
    )
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

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getEventDetail(event: Event): unknown {
  return "detail" in event ? (event as CustomEvent<unknown>).detail : undefined
}

function readUploadContext(
  value: unknown
): { source: UploadSource; total?: number } | null {
  if (typeof value === "string") {
    const source = readUploadSource(value)
    if (source) return { source }

    try {
      return readUploadContext(JSON.parse(value))
    } catch {
      return null
    }
  }

  if (!isObject(value)) return null

  const source = readUploadSource(value.source)
  if (!source) return null

  return {
    source,
    total: readPositiveInteger(value.total)
  }
}

function readUploadSource(value: unknown): UploadSource | null {
  switch (value) {
    case "editor-drop":
    case "editor-paste":
    case "modal-drop":
    case "modal-file":
    case "modal-paste":
      return value
    case "drag":
      return "editor-drop"
    case "paste":
      return "modal-paste"
    case "upload":
      return "modal-file"
    default:
      return null
  }
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined
}

function reportProgress(detail: ProgressDetail): void {
  window.dispatchEvent(
    new CustomEvent(PROGRESS_EVENT_NAME, {
      detail: JSON.stringify(detail)
    })
  )
}

function showConversionError(error: unknown): void {
  console.warn("[dcinside-autowebp] Image conversion failed", error)
  reportProgress({
    message: "이미지 처리 실패",
    phase: "converting",
    status: "error"
  })
  window.alert("이미지를 WebP로 변환하지 못해 업로드를 중단했습니다.")
}
