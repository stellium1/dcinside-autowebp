import React, { useEffect, useState, useRef } from "react";
import packageJson from "./package.json";
import { Storage } from "@plasmohq/storage";
import icon from "./assets/icon.png";

const storage = new Storage();

export default function OptionsIndex() {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [compressOnDrag, setCompressOnDrag] = useState<boolean>(true);
  const [compressOnUpload, setCompressOnUpload] = useState<boolean>(true);
  const [quality, setQuality] = useState<number>(90);

  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await storage.getMany([
        "enabled",
        "compressOnDrag",
        "compressOnUpload",
        "quality",
      ]);
      if (!mounted) return;
      if (typeof res.enabled === "boolean") setIsEnabled(res.enabled);
      if (typeof res.compressOnDrag === "boolean") setCompressOnDrag(res.compressOnDrag);
      if (typeof res.compressOnUpload === "boolean") setCompressOnUpload(res.compressOnUpload);
      if (typeof res.quality === "number") setQuality(res.quality);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveDebounced = (key: string, value: any, delay = 220) => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saveTimer.current = window.setTimeout(() => {
      storage.set(key, value);
      saveTimer.current = null;
    }, delay) as unknown as number;
  };

  const saveImmediate = (key: string, value: any) => {
    storage.set(key, value);
  };

  const styles: { [k: string]: React.CSSProperties } = {
    outer: {
      padding: 12,
      background: "#1a1a1a",
      color: "#fff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      minWidth: 512,
      maxWidth: 512,
      boxSizing: "border-box",
    },
    container: {
      width: "100%",
      boxSizing: "border-box",
      borderRadius: 8,
      padding: 12,
      background: "#161616",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    },
    header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
    icon: { width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 },
    title: { fontSize: 18, margin: 0, fontWeight: 600 },
    meta: { marginLeft: "auto", fontSize: 12, color: "#bdbdbd" },

    list: { display: "flex", flexDirection: "column", gap: 12 },
    optionBox: {
      background: "#2a2a2a",
      borderRadius: 12,
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    left: { display: "flex", alignItems: "center", gap: 12 },
    labelGroup: { display: "flex", flexDirection: "column" },
    toggleLabel: { fontSize: 14, color: "#e0e0e0" },
    toggleDesc: { fontSize: 12, color: "#bdbdbd", marginTop: 4 },
    toggleSwitch: { position: "relative", display: "inline-block", width: 48, height: 24, flexShrink: 0 },
    toggleSliderBase: {
      position: "absolute",
      cursor: "pointer",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "#4a4a4a",
      transition: "0.18s",
      borderRadius: 24,
      display: "flex",
      alignItems: "center",
      padding: "0 4px",
    } as React.CSSProperties,
    toggleCircleBase: {
      height: 18,
      width: 18,
      backgroundColor: "#ffffff",
      borderRadius: "50%",
      transition: "0.18s",
    },
    sliderInner: { width: "220px", maxWidth: "40%", minWidth: "120px" },
    rangeInput: {
      width: "100%",
      appearance: "none",
      height: 6,
      borderRadius: 4,
      background: "linear-gradient(to right, #667eea 0%, #764ba2 var(--q, 80%), #4a4a4a var(--q, 80%))",
      outline: "none",
    } as React.CSSProperties,
  };

  const renderToggle = (
    label: string,
    desc: string | null,
    checked: boolean,
    onChangeLocal: (v: boolean) => void,
    saveKey: string,
    disabled = false
  ) => {
    const sliderStyle = {
      ...styles.toggleSliderBase,
      background: !disabled && checked ? "#667eea" : disabled ? "#3a3a3a" : "#4a4a4a",
      opacity: disabled ? 0.6 : 1,
      pointerEvents: disabled ? "none" : undefined,
    } as React.CSSProperties;

    const circleStyle = {
      ...styles.toggleCircleBase,
      transform: checked ? "translateX(24px)" : "translateX(0)",
      opacity: disabled ? 0.7 : 1,
    } as React.CSSProperties;

    return (
      <div style={{ ...styles.optionBox, opacity: disabled ? 0.85 : 1 }} key={label}>
        <div style={styles.left}>
          <label style={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                const v = e.target.checked;
                onChangeLocal(v);
                saveImmediate(saveKey, v);
              }}
              style={{ opacity: 0, width: 0, height: 0 }}
              disabled={disabled}
            />
            <span style={sliderStyle}>
              <span style={circleStyle} />
            </span>
          </label>

          <div style={styles.labelGroup}>
            <span style={styles.toggleLabel}>{label}</span>
            {desc ? <span style={styles.toggleDesc}>{desc}</span> : null}
          </div>
        </div>
      </div>
    );
  };

  const onQualityInput = (val: number) => {
    setQuality(val);
    saveDebounced("quality", val, 220);
  };

  const onQualityCommit = (val: number) => {
    saveImmediate("quality", val);
  };

  const version = packageJson?.version ?? "1.0.0";
  const githubUrl = (() => {
    const repo = (packageJson as any)?.repository;
    if (!repo) return "https://github.com/your-repo";
    if (typeof repo === "string") return repo.replace(/^git\+/, "").replace(/\.git$/, "");
    return (repo.url ?? "").replace(/^git\+/, "").replace(/\.git$/, "") || "https://github.com/your-repo";
  })();

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
            style={{ textDecoration: "none", color: "inherit" }}
          >
            GitHub
          </a>
            </div>
          </div>
        </div>

        <div style={styles.list}>
          {renderToggle(
            "익스텐션 활성화",
            "확장 기능 전체를 켜거나 끕니다.",
            !!isEnabled,
            (v) => setIsEnabled(v),
            "enabled",
            false
          )}

          {renderToggle(
            "드래그 앤 드롭시 WebP 압축",
            "드래그로 사진 추가할 때 자동으로 WebP로 압축합니다.",
            !!compressOnDrag,
            (v) => setCompressOnDrag(v),
            "compressOnDrag",
            !isEnabled
          )}

          {renderToggle(
            "직접 사진 추가시 WebP 압축",
            "파일 선택(업로드)로 추가할 때 자동으로 WebP로 압축합니다.",
            !!compressOnUpload,
            (v) => setCompressOnUpload(v),
            "compressOnUpload",
            !isEnabled
          )}

          <div style={{ ...styles.optionBox, opacity: !isEnabled ? 0.85 : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ ...styles.toggleLabel, color: !isEnabled ? "#8a8a8a" : styles.toggleLabel.color }}>
                    WebP 압축 품질
                  </div>
                  <div style={{ ...styles.toggleDesc, color: !isEnabled ? "#7a7a7a" : styles.toggleDesc.color }}>
                    이미지 압축 품질을 %로 설정합니다 (10–100).
                  </div>
                </div>
                <div style={{ minWidth: 48, textAlign: "right", fontSize: 13 }}>{quality}%</div>
              </div>

              <div style={styles.sliderInner}>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={quality}
                  onInput={(e: any) => onQualityInput(Number(e.target.value))}
                  onMouseUp={(e: any) => onQualityCommit(Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e: any) => onQualityCommit(Number((e.target as HTMLInputElement).value))}
                  style={{ ...(styles.rangeInput as React.CSSProperties), ["--q" as any]: `${quality}%` } as React.CSSProperties}
                  disabled={!isEnabled}
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
  );
}
