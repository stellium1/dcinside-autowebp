import React from "react"

import icon from "./assets/icon.png"
import { QUALITY_MAX, QUALITY_MIN } from "./lib/settings"
import packageJson from "./package.json"
import { styles } from "./popup/styles"
import { ToggleRow } from "./popup/ToggleRow"
import { useSettings } from "./popup/useSettings"

export default function OptionsIndex() {
  const {
    settings,
    saveSetting,
    saveQualityDebounced,
    saveQualityImmediately
  } = useSettings()

  const version = packageJson?.version ?? "1.0.0"
  const githubUrl = getGithubUrl(packageJson)

  return (
    <div style={styles.outer}>
      <div style={styles.container}>
        <div style={styles.header}>
          <img src={icon} alt="icon" style={styles.icon} />
          <div>
            <h1 style={styles.title}>dcinside-autowebp</h1>
            <div style={styles.meta}>
              <span>버전 {version}</span>
              {" | "}
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none", color: "inherit" }}>
                GitHub
              </a>
            </div>
          </div>
        </div>

        <div style={styles.list}>
          <ToggleRow
            label="익스텐션 활성화"
            desc="확장 기능 전체를 켜거나 끕니다."
            checked={settings.enabled}
            onChange={(value) => saveSetting("enabled", value)}
          />

          <ToggleRow
            label="드래그 앤 드롭시 WebP 압축"
            desc="드래그로 사진을 추가할 때 자동으로 WebP로 압축합니다."
            checked={settings.compressOnDrag}
            onChange={(value) => saveSetting("compressOnDrag", value)}
            disabled={!settings.enabled}
          />

          <ToggleRow
            label="직접 사진 추가시 WebP 압축"
            desc="파일 선택(업로드)으로 추가할 때 자동으로 WebP로 압축합니다."
            checked={settings.compressOnUpload}
            onChange={(value) => saveSetting("compressOnUpload", value)}
            disabled={!settings.enabled}
          />

          <div
            style={{
              ...styles.optionBox,
              opacity: !settings.enabled ? 0.85 : 1
            }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                flex: 1
              }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                <div>
                  <div
                    style={{
                      ...styles.toggleLabel,
                      color: !settings.enabled
                        ? "#8a8a8a"
                        : styles.toggleLabel.color
                    }}>
                    WebP 압축 품질
                  </div>
                  <div
                    style={{
                      ...styles.toggleDesc,
                      color: !settings.enabled
                        ? "#7a7a7a"
                        : styles.toggleDesc.color
                    }}>
                    이미지 압축 품질을 %로 설정합니다 (10–100).
                  </div>
                </div>
                <div style={{ minWidth: 48, textAlign: "right", fontSize: 13 }}>
                  {settings.quality}%
                </div>
              </div>

              <div style={styles.sliderInner}>
                <input
                  type="range"
                  min={QUALITY_MIN}
                  max={QUALITY_MAX}
                  value={settings.quality}
                  onInput={(event) =>
                    saveQualityDebounced(Number(event.currentTarget.value))
                  }
                  onMouseUp={(event) =>
                    saveQualityImmediately(Number(event.currentTarget.value))
                  }
                  onTouchEnd={(event) =>
                    saveQualityImmediately(Number(event.currentTarget.value))
                  }
                  style={
                    {
                      ...styles.rangeInput,
                      "--q": `${settings.quality}%`
                    } as React.CSSProperties
                  }
                  disabled={!settings.enabled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #ffffff;
            border: none;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          input[type=range]::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #ffffff;
            border: none;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }

          html, body {
            margin: 0;
            padding: 0;
            background: #1a1a1a;
          }

          body {
            background-clip: padding-box;
          }

          ::-webkit-scrollbar {
            background: transparent;
          }
        `}
      </style>
    </div>
  )
}

type PackageMetadata = {
  repository?: string | { url?: string }
}

function getGithubUrl(metadata: PackageMetadata): string {
  const repository = metadata?.repository

  if (!repository) {
    return "https://github.com/stellium1/dcinside-autowebp"
  }

  if (typeof repository === "string") {
    return normalizeRepositoryUrl(repository)
  }

  return (
    normalizeRepositoryUrl(repository.url ?? "") ||
    "https://github.com/stellium1/dcinside-autowebp"
  )
}

function normalizeRepositoryUrl(url: string): string {
  return url.replace(/^git\+/, "").replace(/\.git$/, "")
}
