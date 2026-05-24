import { DEFAULT_SETTINGS, normalizeQuality } from "../lib/settings"

const WEBP_MIME_TYPE = "image/webp"
const CONVERTIBLE_IMAGE_TYPE_PATTERN =
  /^image\/(png|x-png|jpe?g|pjpeg|bmp|x-bmp|x-ms-bmp)$/i
const CONVERTIBLE_IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|jfif|bmp)$/i

export function isConvertibleImage(file: File): boolean {
  return (
    CONVERTIBLE_IMAGE_TYPE_PATTERN.test(file.type) ||
    CONVERTIBLE_IMAGE_EXTENSION_PATTERN.test(file.name)
  )
}

export function getWebpFileName(fileName: string): string {
  const nextName = fileName.replace(
    CONVERTIBLE_IMAGE_EXTENSION_PATTERN,
    ".webp"
  )

  return nextName === fileName ? `${fileName}.webp` : nextName
}

export async function convertImageToWebp(
  file: File,
  quality: number = DEFAULT_SETTINGS.quality
): Promise<File> {
  if (!isConvertibleImage(file)) {
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
