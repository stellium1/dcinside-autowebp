import type { Storage } from "@plasmohq/storage"

import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  readSettings,
  SETTINGS_KEYS,
  type Settings,
  type SettingsKey
} from "../lib/settings"
import {
  convertImageToWebp,
  ensureImageFileExtension,
  hasUploadImageExtension,
  isConvertibleImage
} from "../utils/webp"
import {
  initProgressOverlay,
  reportProgress,
  setProgressOverlayEnabled,
  type UploadSource
} from "./progress"

const DROP_HANDLER_MARKER = "__dc_webp_drop_attached"
const EDITOR_SELECTOR = ".note-editable, .note-editor"
const MODAL_SELECTOR = ".note-modal"
const PASTE_SCOPE_SELECTOR = `${MODAL_SELECTOR}, ${EDITOR_SELECTOR}`
const SETTINGS_EVENT_NAME = "dcinside-autowebp:settings"
const UPLOAD_CONTEXT_EVENT_NAME = "dcinside-autowebp:upload-context"
const DROP_AREA_SELECTOR = [
  ".note-dropzone",
  ".note-editor",
  ".note-editable",
  ".content_box.img_upcont",
  "#sortable"
].join(",")
const DCINSIDE_FILE_INPUT_SELECTOR = [
  'input[type="file"][name="files[]"]',
  'input[type="file"].note-image-input[name="files"]',
  'input[type="file"].note-note-image-input[name="files"]',
  'input[type="file"][name="files"][accept*="image"]'
].join(",")
const IGNORED_FILE_INPUT_SELECTOR = [
  "#autozzal_image_file",
  "#prompt_img_file"
].join(",")

type MarkedElement = Element & {
  [DROP_HANDLER_MARKER]?: boolean
}

type ProcessFilesOptions = {
  forceUnknownImageConversion?: boolean
  quality: number
  shouldConvert: boolean
  source: UploadSource
}

type PasteSource = "editor-paste" | "modal-paste"

let currentSettings: Settings = DEFAULT_SETTINGS
let documentChangeHandlerAttached = false
let documentPasteHandlerAttached = false
let initialized = false
let mutationObserver: MutationObserver | null = null
let settingsWatchAttached = false

export async function initUploader(storage: Storage): Promise<void> {
  if (initialized) return

  currentSettings = await readSettings(storage)
  initialized = true

  attachSettingsWatcher(storage)
  initProgressOverlay()
  setProgressOverlayEnabled(currentSettings.showProgress)
  publishPageSettings()
  attachUploadHandlers()
  observeUploaderChanges()
}

function attachSettingsWatcher(storage: Storage): void {
  if (settingsWatchAttached) return
  settingsWatchAttached = true

  const refreshSettings = (): void => {
    readSettings(storage)
      .then((settings) => {
        currentSettings = settings
        setProgressOverlayEnabled(settings.showProgress)
        publishPageSettings()
        attachUploadHandlers()
      })
      .catch((error) => {
        console.warn("[dcinside-autowebp] Failed to refresh settings", error)
      })
  }

  const callbackMap = SETTINGS_KEYS.reduce(
    (map, key) => {
      map[key] = refreshSettings
      return map
    },
    {} as Record<SettingsKey, () => void>
  )

  storage.watch(callbackMap)
}

function attachUploadHandlers(): void {
  attachDocumentFileInputHandler()
  attachDocumentPasteHandler()
  attachDropHandlers()
}

function observeUploaderChanges(): void {
  if (mutationObserver || !document.body) return

  mutationObserver = new MutationObserver(() => attachUploadHandlers())
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  })
}

function attachDocumentFileInputHandler(): void {
  if (documentChangeHandlerAttached) return
  documentChangeHandlerAttached = true

  document.addEventListener(
    "change",
    (event) => void handleFileInputChange(event),
    true
  )
}

function attachDocumentPasteHandler(): void {
  if (documentPasteHandlerAttached) return
  documentPasteHandlerAttached = true

  document.addEventListener(
    "paste",
    (event) => void handleImagePaste(event),
    true
  )
}

function attachDropHandlers(): void {
  for (const area of findDropAreas()) {
    const markedArea = area as MarkedElement
    if (markedArea[DROP_HANDLER_MARKER]) continue

    markedArea[DROP_HANDLER_MARKER] = true
    area.addEventListener("dragover", handleFileDragOver, true)
    area.addEventListener("drop", (event) => void handleFileDrop(event), true)
  }
}

async function handleFileInputChange(event: Event): Promise<void> {
  if (
    !event.isTrusted ||
    !currentSettings.enabled ||
    !currentSettings.modalFileUpload
  ) {
    return
  }

  const input = resolveFileInput(event.target)
  if (!input?.files?.length || !isUploadFileInput(input)) return

  event.stopImmediatePropagation()

  try {
    const files = await processFiles(input.files, {
      quality: currentSettings.quality,
      shouldConvert: true,
      source: "modal-file"
    })

    replaceInputFiles(input, files)
    publishUploadContext("modal-file", files.length)
    reportUploadQueued("modal-file", files.length)
    dispatchChange(input)
  } catch (error) {
    showConversionError(error)
  }
}

async function handleImagePaste(event: ClipboardEvent): Promise<void> {
  if (!event.isTrusted || !currentSettings.enabled) {
    return
  }

  const files = getClipboardImageFiles(event)
  if (files.length === 0) return

  const source = getPasteSource(event)
  if (!source || !isPasteSourceEnabled(source)) return

  if (source === "editor-paste") {
    publishUploadContext(source, files.length)
    return
  }

  const fileInput = findPasteFileInput(event)
  if (!fileInput) return
  if (!isPasteUploadTarget(event, fileInput)) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  try {
    const processedFiles = await processFiles(files, {
      forceUnknownImageConversion: true,
      quality: currentSettings.quality,
      shouldConvert: true,
      source
    })

    replaceInputFiles(fileInput, processedFiles)
    publishUploadContext(source, processedFiles.length)
    reportUploadQueued(source, processedFiles.length)
    dispatchChange(fileInput)
  } catch (error) {
    showConversionError(error)
  }
}

function handleFileDragOver(event: Event): void {
  if (
    !event.isTrusted ||
    !currentSettings.enabled ||
    !currentSettings.modalDropUpload ||
    !isFileDragEvent(event)
  ) {
    return
  }

  const fileInput = findVisibleUploadFileInput()
  if (!fileInput) return

  event.preventDefault()
}

async function handleFileDrop(event: Event): Promise<void> {
  if (!event.isTrusted || !currentSettings.enabled) {
    return
  }

  const files = getDroppedFiles(event)
  if (!files?.length) return

  const fileInput = findVisibleUploadFileInput()
  const editorDropTarget = fileInput ? null : findEditorDropTarget(event)
  if (!fileInput && !editorDropTarget) return
  if (!fileInput) {
    if (!currentSettings.editorDropUpload) return

    if (hasTrackableDropFile(files)) {
      publishUploadContext("editor-drop", files.length)
      reportProgress({
        current: 0,
        message: "이미지 업로드 준비 중",
        percent: 0,
        phase: "converting",
        source: "editor-drop",
        status: "active",
        total: files.length
      })
    }
    return
  }

  if (!currentSettings.modalDropUpload) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  try {
    const processedFiles = await processFiles(files, {
      quality: currentSettings.quality,
      shouldConvert: true,
      source: "modal-drop"
    })

    replaceInputFiles(fileInput, processedFiles)
    publishUploadContext("modal-drop", processedFiles.length)
    reportUploadQueued("modal-drop", processedFiles.length)
    dispatchChange(fileInput)
  } catch (error) {
    showConversionError(error)
  }
}

async function processFiles(
  files: File[] | FileList,
  options: ProcessFilesOptions
): Promise<File[]> {
  const uploadFiles = Array.from(files)
  const processedFiles: File[] = []

  if (uploadFiles.length > 0 && options.shouldConvert) {
    reportProgress({
      current: 0,
      message: "이미지 WebP 변환 중",
      phase: "converting",
      source: options.source,
      status: "active",
      total: uploadFiles.length
    })
  }

  for (const [index, file] of uploadFiles.entries()) {
    processedFiles.push(await processFile(file, options))

    if (options.shouldConvert) {
      reportProgress({
        current: index + 1,
        message: "이미지 WebP 변환 중",
        phase: "converting",
        source: options.source,
        status: "active",
        total: uploadFiles.length
      })
    }
  }

  return processedFiles
}

async function processFile(
  file: File,
  options: ProcessFilesOptions
): Promise<File> {
  const uploadFile = ensureImageFileExtension(file)
  const needsForcedConversion =
    options.forceUnknownImageConversion === true &&
    uploadFile.type === "" &&
    !hasUploadImageExtension(uploadFile.name)
  const shouldConvertFile =
    options.shouldConvert &&
    (isConvertibleImage(uploadFile) || needsForcedConversion)

  if (!shouldConvertFile) return uploadFile

  try {
    return ensureImageFileExtension(
      await convertImageToWebp(
        uploadFile,
        normalizeSettings({ quality: options.quality }).quality,
        needsForcedConversion
      )
    )
  } catch (error) {
    throw new Error(`Failed to convert ${uploadFile.name || "image"} to WebP`, {
      cause: error
    })
  }
}

function getClipboardImageFiles(event: ClipboardEvent): File[] {
  const clipboardData = event.clipboardData
  if (!clipboardData) return []

  const files: File[] = []

  for (const item of Array.from(clipboardData.items)) {
    const file = getClipboardItemFile(item)
    if (file && isClipboardImageFile(file)) {
      files.push(file)
    }
  }

  for (const file of Array.from(clipboardData.files)) {
    if (isClipboardImageFile(file)) {
      files.push(file)
    }
  }

  return dedupeFiles(files)
}

function getClipboardItemFile(item: DataTransferItem): File | null {
  if (item.kind !== "file") return null

  try {
    return item.getAsFile()
  } catch {
    return null
  }
}

function isClipboardImageFile(file: File): boolean {
  return file.type === "" || isImageFile(file)
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>()

  return files.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function findPasteFileInput(event: ClipboardEvent): HTMLInputElement | null {
  const target = event.target instanceof Element ? event.target : null
  const modal = target?.closest(MODAL_SELECTOR) ?? findVisibleModal()

  if (modal) {
    return findVisibleUploadFileInput(modal) ?? findUploadFileInput(modal)
  }

  const pasteScope = target?.closest(PASTE_SCOPE_SELECTOR)
  if (pasteScope) {
    return (
      findVisibleUploadFileInput(pasteScope) ??
      findUploadFileInput(pasteScope) ??
      findUploadFileInput()
    )
  }

  return findVisibleUploadFileInput()
}

function getPasteSource(event: ClipboardEvent): PasteSource | null {
  const target = event.target instanceof Element ? event.target : null

  if (target?.closest(MODAL_SELECTOR) || findVisibleModal()) {
    return "modal-paste"
  }

  if (target?.closest(EDITOR_SELECTOR)) {
    return "editor-paste"
  }

  return findVisibleUploadFileInput() ? "modal-paste" : null
}

function isPasteSourceEnabled(source: PasteSource): boolean {
  return source === "modal-paste"
    ? currentSettings.modalPasteUpload
    : currentSettings.editorPasteUpload
}

function findEditorDropTarget(event: Event): Element | null {
  const target = event.target instanceof Element ? event.target : null
  if (!target) return null

  return target.closest(EDITOR_SELECTOR)
}

function isPasteUploadTarget(
  event: ClipboardEvent,
  fileInput: HTMLInputElement
): boolean {
  const target = event.target
  if (!(target instanceof Element)) return isVisibleElement(fileInput)

  return Boolean(
    target.closest(PASTE_SCOPE_SELECTOR) ||
    resolveFileInput(target)?.matches(DCINSIDE_FILE_INPUT_SELECTOR) ||
    findVisibleModal() ||
    isVisibleElement(fileInput)
  )
}

function findDropAreas(): Element[] {
  return Array.from(document.querySelectorAll(DROP_AREA_SELECTOR))
}

function findVisibleUploadFileInput(
  root: ParentNode = document
): HTMLInputElement | null {
  const inputs = findFileInputs(root)

  return inputs.find(isVisibleElement) ?? null
}

function findUploadFileInput(
  root: ParentNode = document
): HTMLInputElement | null {
  return findFileInputs(root)[0] ?? null
}

function findFileInputs(root: ParentNode = document): HTMLInputElement[] {
  return Array.from(
    root.querySelectorAll<HTMLInputElement>(DCINSIDE_FILE_INPUT_SELECTOR)
  ).filter(isUploadFileInput)
}

function isUploadFileInput(input: HTMLInputElement): boolean {
  return (
    input.type === "file" &&
    input.matches(DCINSIDE_FILE_INPUT_SELECTOR) &&
    !input.disabled &&
    !input.matches(IGNORED_FILE_INPUT_SELECTOR)
  )
}

function resolveFileInput(target: EventTarget | null): HTMLInputElement | null {
  if (!(target instanceof HTMLInputElement) || target.type !== "file")
    return null
  return target
}

function replaceInputFiles(input: HTMLInputElement, files: File[]): void {
  const dataTransfer = new DataTransfer()

  for (const file of files) {
    dataTransfer.items.add(file)
  }

  input.files = dataTransfer.files
}

function dispatchChange(input: HTMLInputElement): void {
  input.dispatchEvent(
    new Event("change", {
      bubbles: true
    })
  )
}

function getDroppedFiles(event: Event): FileList | null {
  if (!isFileDragEvent(event)) return null

  const files = event.dataTransfer?.files
  return files?.length ? files : null
}

function hasTrackableDropFile(files: FileList): boolean {
  return Array.from(files).some((file) => {
    const uploadFile = ensureImageFileExtension(file)
    return (
      isImageFile(uploadFile) ||
      hasUploadImageExtension(uploadFile.name) ||
      isConvertibleImage(uploadFile) ||
      (uploadFile.type === "" && !hasUploadImageExtension(uploadFile.name))
    )
  })
}

function publishPageSettings(): void {
  window.dispatchEvent(
    new CustomEvent(SETTINGS_EVENT_NAME, {
      detail: JSON.stringify(currentSettings)
    })
  )
}

function publishUploadContext(source: UploadSource, total: number): void {
  window.dispatchEvent(
    new CustomEvent(UPLOAD_CONTEXT_EVENT_NAME, {
      detail: JSON.stringify({
        source,
        total
      })
    })
  )
}

function reportUploadQueued(source: UploadSource, total: number): void {
  reportProgress({
    message: "이미지 업로드 준비 중",
    percent: 0,
    phase: "uploading",
    source,
    status: "active",
    total
  })
}

function isFileDragEvent(event: Event): event is DragEvent {
  return (
    event instanceof DragEvent &&
    Array.from(event.dataTransfer?.types ?? []).includes("Files")
  )
}

function isImageFile(file: File): boolean {
  return file.type.toLowerCase().startsWith("image/")
}

function isVisibleElement(element: Element): boolean {
  return element.getClientRects().length > 0
}

function findVisibleModal(): Element | null {
  return (
    Array.from(document.querySelectorAll(MODAL_SELECTOR)).find(
      isVisibleElement
    ) ?? null
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
