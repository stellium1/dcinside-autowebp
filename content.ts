import type { PlasmoCSConfig } from "plasmo"

import { Storage } from "@plasmohq/storage"

import { initUploader } from "./content/uploader"

export const config: PlasmoCSConfig = {
  matches: ["https://*.dcinside.com/*"],
  run_at: "document_end",
  all_frames: false
}

const storage = new Storage()

function startUploader(): void {
  initUploader(storage).catch(() => {})
}

document.addEventListener("DOMContentLoaded", startUploader)
window.addEventListener("load", startUploader)
if (document.readyState !== "loading") {
  startUploader()
}
