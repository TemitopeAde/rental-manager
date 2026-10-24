import React from "react";
import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Roboto";

import { clamp01, progress } from "../kit/time";
import { Crop, FPS, TEAL, TEAL_LIGHT, WHITE } from "./cues";

// The App Market screenshots set their copy in Roboto.
export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

export const ease = Easing.bezier(0.65, 0, 0.35, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** The page behind everything: the brand teal and the soft lighter arc from the listing images. */
export const Backdrop: React.FC = () => (
  <AbsoluteFill style={{ background: TEAL, overflow: "hidden" }}>
    <div
      style={{
        position: "absolute",
        left: 1180,
        top: 640,
        width: 1700,
        height: 1700,
        borderRadius: "50%",
        background: TEAL_LIGHT,
        opacity: 0.55,
      }}
    />
  </AbsoluteFill>
);

/**
 * A window cut straight out of a real screenshot: no redraw, just a crop at
 * scale `k`. Windows that run off the bottom of the screenshot keep square
 * bottom corners, as they do in the source.
 */
export const Shot: React.FC<{ crop: Crop; k: number; x: number; y: number; style?: React.CSSProperties }> = ({ crop, k, x, y, style }) => {
  const bleeds = crop.T + crop.h >= 1799;
  const r = crop.r * k;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: crop.w * k,
        height: crop.h * k,
        overflow: "hidden",
        borderRadius: bleeds ? `${r}px ${r}px 0 0` : r,
        boxShadow: "0 30px 80px rgba(4, 47, 44, 0.35)",
        ...style,
      }}
    >
      <Img
        src={staticFile(crop.src)}
        style={{ position: "absolute", left: -crop.L * k, top: -crop.T * k, width: 2400 * k, height: 1800 * k, maxWidth: "none" }}
      />
    </div>
  );
};

/** A camera key: the stage is drawn at `translate(x, y) scale(s)`, origin top-left. */
export type CamKey = { t: number; s: number; x: number; y: number };

export function cameraAt(t: number, keys: readonly CamKey[]) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t < b.t) {
      const u = ease((t - a.t) / (b.t - a.t));
      return { t, s: a.s + (b.s - a.s) * u, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
  }
  return keys[keys.length - 1];
}

/** The camera key that puts stage point (px, py) at screen point (sx, sy) at zoom `s`. */
export const focus = (t: number, s: number, px: number, py: number, sx: number, sy: number): CamKey => ({ t, s, x: sx - s * px, y: sy - s * py });

/** Fades a scene in over its first 0.35 s and out over its last 0.3 s. */
export function sceneOpacity(t: number, start: number, end: number) {
  return Math.min(easeOut(progress(t, start, 0.35)), 1 - ease(progress(t, end - 0.3, 0.3)));
}

/** Characters visible at `t` for text typed from `start` at `cps` characters a second. */
export const typedCount = (t: number, start: number, text: string, cps: number) =>
  Math.max(0, Math.min(text.length, Math.floor((t - start) * cps)));

/**
 * Typed text that keeps every character's slot: the untyped rest is laid out
 * but invisible, so the line never re-centers while it builds.
 */
export const Typed: React.FC<{ t: number; start: number; text: string; cps: number; caret?: boolean; style?: React.CSSProperties }> = ({
  t,
  start,
  text,
  cps,
  caret = true,
  style,
}) => {
  const n = typedCount(t, start, text, cps);
  const typing = t >= start && n < text.length;
  const blinkOn = typing || Math.floor((t - start) * 2.2) % 2 === 0;
  const showCaret = caret && t >= start - 0.4 && blinkOn && t < start + text.length / cps + 1.2;
  return (
    <span style={{ whiteSpace: "pre-wrap", ...style }}>
      {text.slice(0, n)}
      <span style={{ position: "relative" }}>
        {showCaret ? (
          <span
            style={{ position: "absolute", left: 2, top: "0.12em", width: "0.07em", height: "0.95em", background: "currentColor", borderRadius: 2 }}
          />
        ) : null}
      </span>
      <span style={{ opacity: 0 }}>{text.slice(n)}</span>
    </span>
  );
};

/** Headline and subline, rising in word by word. Words keep their slots. */
export const Caption: React.FC<{
  t: number;
  start: number;
  title: string;
  sub?: string;
  x: number;
  y: number;
  width: number;
  size?: number;
  align?: "left" | "center";
}> = ({ t, start, title, sub, x, y, width, size = 76, align = "left" }) => {
  const words = (text: string, from: number, gap: number) =>
    text.split(" ").map((word, i) => {
      const u = easeOut(progress(t, from + i * gap, 0.45));
      return (
        <span key={i} style={{ display: "inline-block", opacity: u, transform: `translateY(${(1 - u) * 18}px)`, marginRight: "0.26em" }}>
          {word}
        </span>
      );
    });
  return (
    <div style={{ position: "absolute", left: x, top: y, width, fontFamily, color: WHITE, textAlign: align }}>
      <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.01em" }}>{words(title, start, 0.06)}</div>
      {sub ? (
        <div style={{ marginTop: 22, fontSize: size * 0.42, fontWeight: 400, lineHeight: 1.35, opacity: 0.88 }}>{words(sub, start + 0.3, 0.035)}</div>
      ) : null}
    </div>
  );
};

/** A clipped viewport below the caption band, with a soft top edge so moving UI never meets the caption hard. */
export const Viewport: React.FC<{ top: number; children: React.ReactNode }> = ({ top, children }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top,
      width: 1920,
      height: 1080 - top,
      overflow: "hidden",
      WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 36px)",
      maskImage: "linear-gradient(to bottom, transparent 0, black 36px)",
    }}
  >
    <div style={{ position: "absolute", left: 0, top: -top, width: 1920, height: 1080 }}>{children}</div>
  </div>
);

export const fade = (t: number, start: number, length = 0.4) => clamp01(progress(t, start, length));
export const rise = (t: number, start: number, distance = 40) => (1 - easeOut(progress(t, start, 0.7))) * distance;
export { interpolate };

/** Master level: keeps overlapping keys well under full scale. */
const MASTER = 1;

/** One sound at an absolute time. */
export type Sfx = { t: number; src: string; volume: number };

export const SoundTrack: React.FC<{ events: readonly Sfx[] }> = ({ events }) => (
  <>
    {events.map((e, i) => (
      <Sequence key={i} from={Math.round(e.t * FPS)} durationInFrames={Math.round(0.3 * FPS)} layout="none">
        <Audio src={staticFile(e.src)} volume={e.volume * MASTER} />
      </Sequence>
    ))}
  </>
);

/** Key sounds for typed text: one per visible character, skipping spaces, cycling four recorded variants. */
export function typingSounds(start: number, text: string, cps: number, volume = 0.5): Sfx[] {
  const out: Sfx[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " ") continue;
    // Deterministic variant and level, so every render sounds the same.
    const v = (i * 7 + text.charCodeAt(i)) % 4;
    out.push({ t: start + (i + 1) / cps, src: `sfx/key${v}.wav`, volume: volume * (0.8 + 0.2 * ((i * 13) % 5) / 4) });
  }
  return out;
}

export const click = (t: number, volume = 0.9): Sfx => ({ t, src: "sfx/click.wav", volume });
