import type { Storage } from "@plasmohq/storage"

import { readSettings, type Settings } from "../lib/settings"
import { convertImageToWebp, isConvertibleImage } from "../utils/webp"

const DROP_HANDLER_MARKER = "__dc_webp_drop_attached"
const INPUT_HANDLER_MARKER = "__dc_webp_listener_attached"
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
const FILE_INPUT_SELECTOR = 'input[type="file"]'

type MarkedElement = Element & Record<typeof DROP_HANDLER_MARKER, boolean>
type MarkedFileInput = HTMLInputElement &
  Record<typeof INPUT_HANDLER_MARKER, boolean>

let initialized = false
let documentChangeHandlerAttached = false

export async function initUploader(storage: Storage): Promise<void> {
  if (initialized) {
    return
  }

  const settings = await readSettings(storage)

  if (!settings.enabled) {
    return
  }

  initialized = true
  attachUploadHandlers(settings)

  const bodyObserver = new MutationObserver(() => {
    attachUploadHandlers(settings)
  })

  bodyObserver.observe(document.body, { childList: true, subtree: true })
}

function attachUploadHandlers(settings: Settings): void {
  const uploadArea = findUploadArea()

  attachDocumentFileInputHandler(settings)
  attachDropHandler(uploadArea, settings)
  attachFileInputHandlers(settings)
}

function findUploadArea(): Element {
  return (
    document.querySelector(".content_box.img_upcont") ||
    document.querySelector("#sortable") ||
    document.body
  )
}

function findFileInputs(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(DCINSIDE_FILE_INPUT_SELECTOR)
  ).filter(isUploadFileInput)
}

function findPrimaryFileInput(): HTMLInputElement | null {
  return findFileInputs()[0] || null
}

function isUploadFileInput(input: HTMLInputElement): boolean {
  return (
    input.matches(DCINSIDE_FILE_INPUT_SELECTOR) &&
    !input.matches(IGNORED_FILE_INPUT_SELECTOR)
  )
}

function attachDocumentFileInputHandler(settings: Settings): void {
  if (documentChangeHandlerAttached) {
    return
  }

  documentChangeHandlerAttached = true
  document.addEventListener(
    "change",
    async (event: Event) => {
      try {
        await handleFileInputChange(event, settings)
      } catch {}
    },
    true
  )
}

function attachDropHandler(area: Element, settings: Settings): void {
  const markedArea = area as MarkedElement

  if (markedArea[DROP_HANDLER_MARKER]) {
    return
  }

  markedArea[DROP_HANDLER_MARKER] = true
  area.addEventListener("dragover", handleFileDragOver, true)

  area.addEventListener(
    "drop",
    async (event: DragEvent) => {
      const files = getDroppedFiles(event)
      if (!files) {
        return
      }

      const fileInput = findPrimaryFileInput()
      if (!fileInput) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()

      const processedFiles = await processFiles(
        files,
        settings.compressOnDrag,
        settings.quality
      )

      replaceInputFiles(fileInput, processedFiles)
      dispatchChange(fileInput)
    },
    true
  )
}

function attachFileInputHandlers(settings: Settings): void {
  findFileInputs().forEach((input) => {
    const markedInput = input as MarkedFileInput

    if (markedInput[INPUT_HANDLER_MARKER]) {
      return
    }

    markedInput[INPUT_HANDLER_MARKER] = true
    const addOriginalEventListener = patchChangeListener(input, settings)

    addOriginalEventListener(
      "change",
      async (event: Event) => {
        try {
          await handleFileInputChange(event, settings, input)
        } catch {}
      },
      { capture: true }
    )
  })
}

function patchChangeListener(
  input: HTMLInputElement,
  settings: Settings
): HTMLInputElement["addEventListener"] {
  const originalAddEventListener = input.addEventListener.bind(input)

  input.addEventListener = ((type, listener, options) => {
    if (type !== "change" || !listener) {
      originalAddEventListener(type, listener, options)
      return
    }

    const wrappedListener = async (event: Event) => {
      try {
        await handleFileInputChange(event, settings, input)
      } catch {}

      callEventListener(listener, input, event)
    }

    originalAddEventListener(type, wrappedListener, options)
  }) as HTMLInputElement["addEventListener"]

  return originalAddEventListener
}

async function handleFileInputChange(
  event: Event,
  settings: Settings,
  providedInput?: HTMLInputElement
): Promise<void> {
  if (!event.isTrusted || !settings.compressOnUpload) {
    return
  }

  const input = resolveFileInput(event, providedInput)
  if (
    !input ||
    !isUploadFileInput(input) ||
    !input.files ||
    input.files.length === 0
  ) {
    return
  }

  event.stopImmediatePropagation()

  const processedFiles = await processFiles(input.files, true, settings.quality)
  replaceInputFiles(input, processedFiles)
  dispatchChange(input)
}

async function processFiles(
  files: FileList,
  shouldConvert: boolean,
  quality: number
): Promise<File[]> {
  return Promise.all(
    Array.from(files).map(async (file) => {
      if (!shouldConvert || !isConvertibleImage(file)) {
        return file
      }

      try {
        return await convertImageToWebp(file, quality)
      } catch {
        return file
      }
    })
  )
}

function replaceInputFiles(input: HTMLInputElement, files: File[]): void {
  const dataTransfer = new DataTransfer()

  files.forEach((file) => dataTransfer.items.add(file))
  input.files = dataTransfer.files
}

function dispatchChange(input: HTMLInputElement): void {
  setTimeout(() => {
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }, 0)
}

function resolveFileInput(
  event: Event,
  providedInput?: HTMLInputElement
): HTMLInputElement | null {
  if (providedInput) {
    return providedInput
  }

  if (event.currentTarget instanceof HTMLInputElement) {
    return event.currentTarget
  }

  if (event.target instanceof HTMLInputElement) {
    return event.target
  }

  if (event.target instanceof Element) {
    return event.target.closest<HTMLInputElement>(FILE_INPUT_SELECTOR)
  }

  return document.activeElement instanceof HTMLInputElement
    ? document.activeElement
    : null
}

function callEventListener(
  listener: EventListenerOrEventListenerObject,
  target: HTMLInputElement,
  event: Event
): void {
  try {
    if (typeof listener === "function") {
      listener.call(target, event)
      return
    }

    listener.handleEvent(event)
  } catch {}
}

function handleFileDragOver(event: DragEvent): void {
  if (!isFileDragEvent(event) || !findPrimaryFileInput()) {
    return
  }

  event.preventDefault()
}

function getDroppedFiles(event: DragEvent): FileList | null {
  if (!isFileDragEvent(event)) {
    return null
  }

  const files = event.dataTransfer?.files
  return files && files.length > 0 ? files : null
}

function isFileDragEvent(event: DragEvent): boolean {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) {
    return false
  }

  if (Array.from(dataTransfer.types).includes("Files")) {
    return true
  }

  return Array.from(dataTransfer.items).some((item) => item.kind === "file")
}
