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
          <Section title="전체">
            <ToggleRow
              label="확장 프로그램 사용"
              desc="WebP 변환 기능을 켜거나 끕니다."
              checked={settings.enabled}
              onChange={(value) => saveSetting("enabled", value)}
            />
          </Section>

          <Section title="이미지 업로드 창">
            <ToggleRow
              label="파일 선택 시 WebP 변환"
              desc="업로드 창에서 파일 선택으로 추가한 이미지를 WebP로 변환합니다."
              checked={settings.modalFileUpload}
              onChange={(value) => saveSetting("modalFileUpload", value)}
              disabled={!settings.enabled}
            />

            <ToggleRow
              label="붙여넣기 시 WebP 변환"
              desc="업로드 창에서 붙여넣기로 추가한 이미지를 WebP로 변환합니다."
              checked={settings.modalPasteUpload}
              onChange={(value) => saveSetting("modalPasteUpload", value)}
              disabled={!settings.enabled}
            />

            <ToggleRow
              label="드래그 앤 드롭 시 WebP 변환"
              desc="업로드 창에 끌어다 놓은 이미지를 WebP로 변환합니다."
              checked={settings.modalDropUpload}
              onChange={(value) => saveSetting("modalDropUpload", value)}
              disabled={!settings.enabled}
            />
          </Section>

          <Section title="본문 에디터">
            <ToggleRow
              label="붙여넣기 시 WebP 변환"
              desc="본문 에디터에 붙여넣은 이미지를 WebP로 변환합니다."
              checked={settings.editorPasteUpload}
              onChange={(value) => saveSetting("editorPasteUpload", value)}
              disabled={!settings.enabled}
            />

            <ToggleRow
              label="드래그 앤 드롭 시 WebP 변환"
              desc="본문 에디터에 끌어다 놓은 이미지를 WebP로 변환합니다."
              checked={settings.editorDropUpload}
              onChange={(value) => saveSetting("editorDropUpload", value)}
              disabled={!settings.enabled}
            />
          </Section>

          <Section title="표시">
            <ToggleRow
              label="변환/업로드 진행 표시"
              desc="이미지 처리 상태를 오버레이로 표시합니다."
              checked={settings.showProgress}
              onChange={(value) => saveSetting("showProgress", value)}
              disabled={!settings.enabled}
            />
          </Section>

          <Section title="품질">
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
                      WebP 품질
                    </div>
                    <div
                      style={{
                        ...styles.toggleDesc,
                        color: !settings.enabled
                          ? "#7a7a7a"
                          : styles.toggleDesc.color
                      }}>
                      WebP 변환 품질입니다. 높을수록 용량이 커질 수 있습니다.
                    </div>
                  </div>
                  <div
                    style={{ minWidth: 48, textAlign: "right", fontSize: 13 }}>
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
          </Section>
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

type SectionProps = {
  children: React.ReactNode
  title: string
}

function Section({ children, title }: SectionProps) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={styles.sectionList}>{children}</div>
    </section>
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
