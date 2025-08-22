export async function convertImageToWebp(
  file: File,
  quality: number = 80
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return resolve(file)
    }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")
      ctx?.drawImage(img, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const webpFile = new File(
              [blob],
              file.name.replace(/\.(png|jpg|jpeg)$/i, ".webp"),
              { type: "image/webp" }
            )
            resolve(webpFile)
          } else {
            reject(new Error("WebP로 변환 실패"))
          }
        },
        "image/webp",
        quality / 100 
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
