export type UploadSource = "drag" | "paste" | "upload"

type ProgressPhase = "converting" | "uploading"
type ProgressStatus = "active" | "done" | "error"

type ProgressDetail = {
  current?: number
  message?: string
  percent?: number
  phase: ProgressPhase
  source?: UploadSource
  status: ProgressStatus
  total?: number
}

const PROGRESS_EVENT_NAME = "dcinside-autowebp:progress"
const OVERLAY_ID = "dcinside-autowebp-progress"
const STYLE_ID = "dcinside-autowebp-progress-style"

let initialized = false
let hideTimer: number | null = null

export function initProgressOverlay(): void {
  if (initialized) return
  initialized = true

  window.addEventListener(PROGRESS_EVENT_NAME, handleProgressEvent)
}

export function reportProgress(detail: ProgressDetail): void {
  window.dispatchEvent(
    new CustomEvent(PROGRESS_EVENT_NAME, {
      detail: JSON.stringify(detail)
    })
  )
}

function handleProgressEvent(event: Event): void {
  const detail = parseProgressDetail(event)
  if (!detail) return

  renderProgress(detail)
}

function parseProgressDetail(event: Event): ProgressDetail | null {
  const rawDetail =
    "detail" in event ? (event as CustomEvent<unknown>).detail : undefined

  if (typeof rawDetail !== "string") return null

  try {
    return normalizeProgressDetail(JSON.parse(rawDetail))
  } catch {
    return null
  }
}

function normalizeProgressDetail(value: unknown): ProgressDetail | null {
  if (!isRecord(value)) return null

  const phase = value.phase
  const status = value.status
  if (
    (phase !== "converting" && phase !== "uploading") ||
    (status !== "active" && status !== "done" && status !== "error")
  ) {
    return null
  }

  return {
    current: readNumber(value.current),
    message: typeof value.message === "string" ? value.message : undefined,
    percent: clampPercent(readNumber(value.percent)),
    phase,
    source: readUploadSource(value.source),
    status,
    total: readNumber(value.total)
  }
}

function renderProgress(detail: ProgressDetail): void {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }

  ensureProgressStyle()
  const overlay = ensureOverlay()
  const percent = getDisplayPercent(detail)
  const bar = overlay.querySelector<HTMLElement>("[data-progress-bar]")
  const title = overlay.querySelector<HTMLElement>("[data-progress-title]")
  const meta = overlay.querySelector<HTMLElement>("[data-progress-meta]")

  overlay.dataset.status = detail.status
  overlay.hidden = false

  if (title) title.textContent = detail.message ?? getDefaultMessage(detail)
  if (meta) meta.textContent = getMetaText(detail, percent)
  if (bar) {
    bar.style.width = percent === null ? "100%" : `${percent}%`
    bar.dataset.indeterminate = percent === null ? "true" : "false"
  }

  if (detail.status === "done") {
    scheduleHide(1300)
  } else if (detail.status === "error") {
    scheduleHide(4200)
  }
}

function ensureOverlay(): HTMLElement {
  const existing = document.getElementById(OVERLAY_ID)
  if (existing) return existing

  const overlay = document.createElement("div")
  overlay.id = OVERLAY_ID
  overlay.innerHTML = `
    <div class="dcaw-progress-head">
      <div data-progress-title></div>
      <div data-progress-meta></div>
    </div>
    <div class="dcaw-progress-track">
      <div class="dcaw-progress-bar" data-progress-bar></div>
    </div>
  `

  document.body.append(overlay)
  return overlay
}

function ensureProgressStyle(): void {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      width: min(360px, calc(100vw - 36px));
      box-sizing: border-box;
      padding: 12px 14px;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      background: #161616;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: none;
    }
    #${OVERLAY_ID}[hidden] {
      display: none;
    }
    #${OVERLAY_ID} .dcaw-progress-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      font-size: 13px;
      line-height: 1.3;
    }
    #${OVERLAY_ID} [data-progress-title] {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    #${OVERLAY_ID} [data-progress-meta] {
      flex: 0 0 auto;
      color: #bdbdbd;
      font-size: 12px;
    }
    #${OVERLAY_ID} .dcaw-progress-track {
      height: 5px;
      overflow: hidden;
      border-radius: 999px;
      background: #4a4a4a;
    }
    #${OVERLAY_ID} .dcaw-progress-bar {
      height: 100%;
      min-width: 8px;
      border-radius: inherit;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 180ms ease;
    }
    #${OVERLAY_ID} .dcaw-progress-bar[data-indeterminate="true"] {
      width: 42% !important;
      animation: dcaw-progress-indeterminate 1.05s ease-in-out infinite;
    }
    #${OVERLAY_ID}[data-status="error"] .dcaw-progress-bar {
      background: #ff6b6b;
    }
    #${OVERLAY_ID}[data-status="done"] .dcaw-progress-bar {
      background: linear-gradient(90deg, #667eea, #764ba2);
    }
    @keyframes dcaw-progress-indeterminate {
      0% { transform: translateX(-120%); }
      100% { transform: translateX(260%); }
    }
  `

  document.head.append(style)
}

function getDefaultMessage(detail: ProgressDetail): string {
  if (detail.status === "done") return "이미지 업로드 완료"
  if (detail.status === "error") return "이미지 업로드 실패"
  return detail.phase === "converting"
    ? "이미지 WebP 변환 중"
    : "이미지 업로드 중"
}

function getMetaText(detail: ProgressDetail, percent: number | null): string {
  if (
    detail.phase === "uploading" &&
    typeof detail.current === "number" &&
    typeof detail.total === "number"
  ) {
    return detail.total > 1 ? `(${detail.current}/${detail.total})` : ""
  }

  if (percent !== null) return `${percent}%`
  return "진행 중"
}

function getDisplayPercent(detail: ProgressDetail): number | null {
  if (detail.status === "done") return 100
  if (typeof detail.percent === "number") return detail.percent
  if (typeof detail.current === "number" && typeof detail.total === "number") {
    if (detail.total <= 0) return 0
    return clampPercent(Math.round((detail.current / detail.total) * 100))
  }

  return null
}

function scheduleHide(delayMs: number): void {
  hideTimer = window.setTimeout(() => {
    const overlay = document.getElementById(OVERLAY_ID)
    if (overlay) overlay.hidden = true
    hideTimer = null
  }, delayMs)
}

function clampPercent(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  return Math.min(100, Math.max(0, Math.round(value)))
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function readUploadSource(value: unknown): UploadSource | undefined {
  return value === "drag" || value === "paste" || value === "upload"
    ? value
    : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
