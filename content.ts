import { Storage } from "@plasmohq/storage"
import { convertImageToWebp } from "./utils/webp"

const storage = new Storage()

async function initUploader() {
  const res = await storage.getMany([
    "enabled",
    "compressOnDrag",
    "compressOnUpload",
    "quality"
  ])

  const enabled = res.enabled ?? true
  const compressOnDrag = res.compressOnDrag ?? true
  const compressOnUpload = res.compressOnUpload ?? true
  const quality = res.quality ?? 80

  if (!enabled) return

  const findUploadArea = () =>
    document.querySelector(".content_box.img_upcont") ||
    document.querySelector("#sortable") ||
    document.body

  const root = findUploadArea()
  attachDropHandler(root, { compressOnDrag, compressOnUpload, quality })
  attachFileInputHandlers(root, { compressOnDrag, compressOnUpload, quality })

  const bodyObserver = new MutationObserver(() => {
    const area = findUploadArea()
    attachFileInputHandlers(area, { compressOnDrag, compressOnUpload, quality })
    attachDropHandler(area, { compressOnDrag, compressOnUpload, quality })
  })
  bodyObserver.observe(document.body, { childList: true, subtree: true })

}

function attachDropHandler(
  area: Element,
  opts: { compressOnDrag?: boolean; compressOnUpload?: boolean; quality?: number }
) {
  const marker = "__dc_webp_drop_attached"
  if ((area as any)[marker]) return
  ;(area as any)[marker] = true

  area.addEventListener("dragover", (e) => e.preventDefault(), true)

  area.addEventListener(
    "drop",
    async (event: DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      try {
        event.stopImmediatePropagation?.()
      } catch {}

      const dt = event.dataTransfer
      if (!dt) return

      const files = dt.files
      let anyConverted = false

      const processed = await Promise.all(
        Array.from(files).map(async (file) => {
          if (opts.compressOnDrag && /^image\/(png|jpe?g)$/i.test(file.type)) {
            try {
              const webpBlob = await convertImageToWebp(
                file,
                opts.quality ?? 80
              )
              const newName = file.name.replace(/\.(jpg|jpeg|png)$/i, ".webp")
              const webpFile = new File([webpBlob], newName, {
                type: "image/webp"
              })
              anyConverted = true
              return webpFile
            } catch {
              return file
            }
          } else {
            return file
          }
        })
      )

      const fileInput =
        document.querySelector<HTMLInputElement>(
          'input[type="file"][name="files[]"]'
        ) || document.querySelector<HTMLInputElement>('input[type="file"]')

      if (fileInput) {
        const dtNew = new DataTransfer()
        processed.forEach((f) => dtNew.items.add(f))
        fileInput.files = dtNew.files

        const changeEvent = new Event("change", { bubbles: true })
        setTimeout(() => {
          try {
            fileInput.dispatchEvent(changeEvent)
          } catch {}
        }, 0)
      }

    },
    true
  )
}

function attachFileInputHandlers(
  root: ParentNode,
  opts: { compressOnDrag?: boolean; compressOnUpload?: boolean; quality?: number }
) {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[type="file"][name="files[]"]'
    )
  )

  inputs.forEach((input) => {
    const marker = "__dc_webp_listener_attached"
    if ((input as any)[marker]) return
    ;(input as any)[marker] = true

    const originalAdd = input.addEventListener.bind(input)
    input.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) {
      if (type === "change") {
        const wrapped = async (e: Event) => {
          try {
            await handleFileInputChange(e, opts, input)
          } catch {}
          if (typeof listener === "function") {
            try {
              listener.call(this, e)
            } catch {}
          } else if (
            listener &&
            typeof (listener as EventListenerObject).handleEvent === "function"
          ) {
            try {
              (listener as EventListenerObject).handleEvent.call(listener, e)
            } catch {}
          }
        }
        originalAdd(type, wrapped, options)
      } else {
        originalAdd(type, listener, options)
      }
    } as any

    input.addEventListener(
      "change",
      async (e: Event) => {
        try {
          await handleFileInputChange(e, opts, input)
        } catch {}
      },
      { capture: true }
    )
  })
}

async function handleFileInputChange(
  e: Event,
  opts: any,
  providedInput?: HTMLInputElement
) {
  if (!e.isTrusted) return

  let input: HTMLInputElement | null = null
  try {
    input =
      providedInput ??
      ((e.currentTarget as HTMLInputElement) ||
        (e.target as HTMLInputElement)) ??
      (document.activeElement instanceof HTMLInputElement
        ? document.activeElement
        : null)

    if (!input && (e.target as Element)?.closest) {
      input = (e.target as Element).closest(
        'input[type="file"]'
      ) as HTMLInputElement | null
    }
  } catch {
    input =
      document.activeElement instanceof HTMLInputElement
        ? document.activeElement
        : null
  }

  if (!input) return
  if (!opts?.compressOnUpload) return

  e.stopImmediatePropagation()

  try {
    const files = input.files
    if (!files || files.length === 0) return

    let converted = false

    const processed = await Promise.all(
      Array.from(files).map(async (file) => {
        if (/^image\/(png|jpe?g)$/i.test(file.type)) {
          try {
            const webpBlob = await convertImageToWebp(file, opts?.quality ?? 80)
            const newName = file.name.replace(/\.(jpg|jpeg|png)$/i, ".webp")
            const webpFile = new File([webpBlob], newName, { type: "image/webp" })
            converted = true
            return webpFile
          } catch {
            return file
          }
        } else {
          return file
        }
      })
    )

    const dt = new DataTransfer()
    processed.forEach((f) => dt.items.add(f))
    input.files = dt.files


  } catch {}
  const changeEvent = new Event("change", { bubbles: true })
  input.dispatchEvent(changeEvent)
}



document.addEventListener("DOMContentLoaded", initUploader)
window.addEventListener("load", initUploader)
if (document.readyState !== "loading") {
  initUploader()
}
