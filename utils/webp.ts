import { DEFAULT_SETTINGS, normalizeQuality } from "../lib/settings"

const WEBP_MIME_TYPE = "image/webp"
const CONVERTIBLE_IMAGE_TYPE_PATTERN =
  /^image\/(png|x-png|jpe?g|pjpeg|bmp|x-bmp|x-ms-bmp|avif)$/i
const CONVERTIBLE_IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|jfif|bmp|avif)$/i
const UPLOAD_IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|jfif|bmp|gif|webp)$/i

export function isConvertibleImage(file: File): boolean {
  if (file.type) return CONVERTIBLE_IMAGE_TYPE_PATTERN.test(file.type)
  return CONVERTIBLE_IMAGE_EXTENSION_PATTERN.test(file.name)
}

export function hasUploadImageExtension(fileName: string): boolean {
  return UPLOAD_IMAGE_EXTENSION_PATTERN.test(fileName)
}

export function getWebpFileName(fileName: string): string {
  const safeName = normalizeFileBaseName(fileName)
  const nextName = safeName.replace(
    CONVERTIBLE_IMAGE_EXTENSION_PATTERN,
    ".webp"
  )

  return nextName === safeName ? `${safeName}.webp` : nextName
}

export function ensureImageFileExtension(file: File): File {
  const extension = getExtensionFromImageType(file.type)
  if (!extension) {
    return file
  }

  const currentExtension = getUploadExtension(file.name)
  if (
    currentExtension &&
    areEquivalentExtensions(extension, currentExtension)
  ) {
    return file
  }

  return new File([file], `${normalizeFileBaseName(file.name)}.${extension}`, {
    lastModified: file.lastModified,
    type: file.type
  })
}

export async function convertImageToWebp(
  file: File,
  quality: number = DEFAULT_SETTINGS.quality,
  force = false
): Promise<File> {
  if (!force && !isConvertibleImage(file)) {
    return file
  }

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

function getExtensionFromImageType(type: string): string | null {
  switch (type.toLowerCase()) {
    case "image/webp":
      return "webp"
    case "image/gif":
      return "gif"
    case "image/png":
    case "image/x-png":
      return "png"
    case "image/jpeg":
    case "image/jpg":
    case "image/pjpeg":
      return "jpg"
    case "image/bmp":
    case "image/x-bmp":
    case "image/x-ms-bmp":
      return "bmp"
    default:
      return null
  }
}

function getUploadExtension(fileName: string): string | null {
  const match = fileName.toLowerCase().match(UPLOAD_IMAGE_EXTENSION_PATTERN)
  return match ? match[0].slice(1) : null
}

function areEquivalentExtensions(
  expectedExtension: string,
  currentExtension: string
): boolean {
  if (expectedExtension === "jpg") {
    return ["jpg", "jpeg", "jfif"].includes(currentExtension)
  }

  return expectedExtension === currentExtension
}

function normalizeFileBaseName(fileName: string): string {
  return fileName.trim().replace(/\.+$/, "") || "image"
}
