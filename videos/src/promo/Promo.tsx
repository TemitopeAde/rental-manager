import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

import { CursorKey, UserCursor, cursorAt } from "../kit/cursor";
import { progress, useTime } from "../kit/time";
import { CROPS, Crop, SCENES as S, WHITE } from "./cues";
import {
  Backdrop,
  CamKey,
  Caption,
  Sfx,
  Shot,
  SoundTrack,
  Typed,
  Viewport,
  cameraAt,
  click,
  ease,
  easeOut,
  fade,
  focus,
  fontFamily,
  rise,
  sceneOpacity,
  typingSounds,
} from "./parts";

// ---------- Copy. Every line comes from app-market/listing.md or the screenshots. ----------

const HOOK_1 = "Renting out your gear?";
const HOOK_2 = "Dates, deposits and returns add up fast.";
const CTA = "Discover Rental Manager on the Wix App Market";
const CPS = 16;
const HOOK_1_AT = S.hook + 0.5;
const HOOK_2_AT = S.hook + 2.4;
const CTA_AT = S.cta + 1.3;

// ---------- Layouts: where each screenshot crop sits on the stage. ----------

/** Maps a point in original screenshot pixels to stage pixels for a crop placed at (x, y) with scale k. */
const placed = (crop: Crop, k: number, x: number, y: number) => ({
  crop,
  k,
  x,
  y,
  at: (ox: number, oy: number) => ({ x: x + (ox - crop.L) * k, y: y + (oy - crop.T) * k }),
});

const catalog = placed(CROPS.catalog, 0.82, 880, 150);
const item = placed(CROPS.itemBrowser, 0.8, 166, 268);
const itemPanel = { k: 0.8, x: item.at(CROPS.itemPanel.L, 0).x, y: item.at(0, CROPS.itemPanel.T).y };
const rentals = placed(CROPS.rentals, 0.86, 161, 268);
const dashboard = placed(CROPS.dashboard, 0.8, 107, 268);

// Camera paths, in stage space. Points are named after what is on screen there.
const pt = (p: { x: number; y: number }) => [p.x, p.y] as const;

const catalogCam: CamKey[] = [
  { t: S.catalog, s: 1, x: 0, y: 40 },
  { t: S.item, s: 1, x: 0, y: -250 },
];

const calendar = item.at(1772, 880);
const total = item.at(1792, 1430);
const itemCam: CamKey[] = [
  { t: S.item + 1.0, s: 1, x: 0, y: 0 },
  focus(S.item + 2.2, 1.42, ...pt(calendar), 1180, 640),
  focus(S.item + 3.7, 1.42, ...pt(calendar), 1180, 640),
  focus(S.item + 4.6, 1.42, ...pt(total), 1180, 760),
];

const firstCard = rentals.at(1000, 1100);
const waitingNote = rentals.at(1000, 1640);
const rentalsCam: CamKey[] = [
  { t: S.rentals + 0.9, s: 1, x: 0, y: 0 },
  focus(S.rentals + 2.0, 1.22, ...pt(firstCard), 960, 680),
  focus(S.rentals + 3.6, 1.22, ...pt(firstCard), 960, 680),
  focus(S.rentals + 4.7, 1.22, ...pt(waitingNote), 960, 920),
];

const stats = dashboard.at(1379, 760);
const goingOut = dashboard.at(1379, 1300);
const dashboardCam: CamKey[] = [
  { t: S.dashboard + 0.9, s: 1, x: 0, y: 0 },
  focus(S.dashboard + 2.0, 1.18, ...pt(stats), 960, 640),
  focus(S.dashboard + 3.2, 1.18, ...pt(stats), 960, 640),
  focus(S.dashboard + 4.2, 1.3, ...pt(goingOut), 960, 640),
];

// Cursor stops in original screenshot pixels (world: they ride the camera).
const itemCursor: CursorKey[] = [
  { t: S.item + 1.6, x: 1700, y: 1200, world: true },
  { t: S.item + 2.7, x: 1900, y: 938, world: true, click: true },
  { t: S.item + 3.3, x: 1574, y: 1009, world: true, click: true },
  { t: S.item + 4.9, x: 1960, y: 1545, world: true, click: true },
];
const rentalsCursor: CursorKey[] = [
  { t: S.rentals + 1.4, x: 1100, y: 1350, world: true },
  { t: S.rentals + 2.8, x: 757, y: 1282, world: true, click: true },
  { t: S.rentals + 4.2, x: 860, y: 1420, world: true },
];
const dashboardCursor: CursorKey[] = [
  { t: S.dashboard + 2.6, x: 1500, y: 900, world: true },
  { t: S.dashboard + 4.8, x: 1336, y: 1392, world: true, click: true },
];
const catalogCursor: CursorKey[] = [
  { t: S.catalog + 1.4, x: 2100, y: 1500, world: true },
  { t: S.catalog + 3.2, x: 1600, y: 1500, world: true, click: true },
];

const clicksOf = (keys: CursorKey[]) => keys.filter((k) => k.click).map((k) => click(k.t));

const SOUNDS: Sfx[] = [
  ...typingSounds(HOOK_1_AT, HOOK_1, CPS),
  ...typingSounds(HOOK_2_AT, HOOK_2, CPS * 1.4, 0.4),
  ...clicksOf(catalogCursor),
  ...clicksOf(itemCursor),
  ...clicksOf(rentalsCursor),
  ...clicksOf(dashboardCursor),
  ...typingSounds(CTA_AT, CTA, CPS * 1.3, 0.45),
];

// ---------- Scenes ----------

const Scene: React.FC<{ t: number; start: number; end: number; children: React.ReactNode }> = ({ t, start, end, children }) =>
  t >= start && t < end ? <AbsoluteFill style={{ opacity: sceneOpacity(t, start, end) }}>{children}</AbsoluteFill> : null;

/** A camera-driven shot with an optional cursor that rides the camera. */
const Stage: React.FC<{
  t: number;
  cam: CamKey[];
  shots: { layout: ReturnType<typeof placed>; style?: React.CSSProperties }[];
  extra?: React.ReactNode;
  cursor?: { keys: CursorKey[]; layout: ReturnType<typeof placed> };
}> = ({ t, cam, shots, extra, cursor }) => {
  const c = cameraAt(t, cam);
  const toScreen = (ox: number, oy: number) => {
    const p = cursor!.layout.at(ox, oy);
    return { x: c.x + c.s * p.x, y: c.y + c.s * p.y };
  };
  const cur = cursor ? cursorAt(t, cursor.keys, toScreen) : null;
  const cursorIn = cursor ? fade(t, cursor.keys[0].t - 0.6, 0.3) : 0;
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: `translate(${c.x}px, ${c.y}px) scale(${c.s})` }}>
        {shots.map(({ layout, style }, i) => (
          <Shot key={i} crop={layout.crop} k={layout.k} x={layout.x} y={layout.y} style={style} />
        ))}
        {extra}
      </div>
      {cur ? (
        <div style={{ opacity: cursorIn }}>
          <UserCursor x={cur.x} y={cur.y} squash={cur.squash} />
        </div>
      ) : null}
    </>
  );
};

const Hook: React.FC<{ t: number }> = ({ t }) => (
  <Scene t={t} start={S.hook} end={S.reveal}>
    <div style={{ position: "absolute", left: 160, top: 380, width: 1600, fontFamily, color: WHITE }}>
      <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.05 }}>
        <Typed t={t} start={HOOK_1_AT} text={HOOK_1} cps={CPS} caret={t < HOOK_2_AT} />
      </div>
      <div style={{ marginTop: 36, fontSize: 54, fontWeight: 400, opacity: 0.9 }}>
        <Typed t={t} start={HOOK_2_AT} text={HOOK_2} cps={CPS * 1.4} caret={t >= HOOK_2_AT} />
      </div>
    </div>
  </Scene>
);

const Icon: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img
    src={staticFile("ui/icon.png")}
    style={{ width: size, height: size, borderRadius: size * 0.22, boxShadow: "0 24px 60px rgba(4, 47, 44, 0.45)", ...style }}
  />
);

const Reveal: React.FC<{ t: number }> = ({ t }) => {
  const u = easeOut(progress(t, S.reveal + 0.1, 0.8));
  return (
    <Scene t={t} start={S.reveal} end={S.catalog}>
      <div style={{ position: "absolute", left: 0, top: 230, width: 1920, display: "flex", justifyContent: "center" }}>
        <Icon size={220} style={{ opacity: u, transform: `translateY(${(1 - u) * 30}px) scale(${0.86 + 0.14 * u})` }} />
      </div>
      <Caption t={t} start={S.reveal + 0.55} title="Rental Manager" sub="Rent out what you own, by the day or the week." x={160} y={510} width={1600} size={124} align="center" />
    </Scene>
  );
};

const Catalog: React.FC<{ t: number }> = ({ t }) => (
  <Scene t={t} start={S.catalog} end={S.item}>
    <div style={{ position: "absolute", inset: 0, transform: `translateY(${rise(t, S.catalog, 60)}px)` }}>
      <Stage t={t} cam={catalogCam} shots={[{ layout: catalog }]} cursor={{ keys: catalogCursor, layout: catalog }} />
    </div>
    <Caption t={t} start={S.catalog + 0.2} title="A rental catalog on your site" sub="Visitors browse your gear by category." x={120} y={360} width={680} size={78} />
  </Scene>
);

const Item: React.FC<{ t: number }> = ({ t }) => {
  const panelIn = easeOut(progress(t, S.item + 0.35, 0.7));
  const panel = (
    <Shot
      crop={CROPS.itemPanel}
      k={itemPanel.k}
      x={itemPanel.x + (1 - panelIn) * 60}
      y={itemPanel.y}
      style={{ opacity: panelIn, boxShadow: "0 24px 60px rgba(4, 47, 44, 0.25)" }}
    />
  );
  return (
    <Scene t={t} start={S.item} end={S.rentals}>
      <Caption t={t} start={S.item + 0.1} title="Pick dates, see the price, check out" x={120} y={84} width={1700} size={72} />
      <Viewport top={220}>
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${rise(t, S.item, 50)}px)` }}>
          <Stage t={t} cam={itemCam} shots={[{ layout: item }]} extra={panel} cursor={{ keys: itemCursor, layout: item }} />
        </div>
      </Viewport>
    </Scene>
  );
};

const Rentals: React.FC<{ t: number }> = ({ t }) => (
  <Scene t={t} start={S.rentals} end={S.dashboard}>
    <Caption t={t} start={S.rentals + 0.1} title="Renters manage their own bookings" sub="Nothing changes until you approve it." x={120} y={60} width={1700} size={68} />
    <Viewport top={250}>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${rise(t, S.rentals, 50)}px)` }}>
        <Stage t={t} cam={rentalsCam} shots={[{ layout: rentals }]} cursor={{ keys: rentalsCursor, layout: rentals }} />
      </div>
    </Viewport>
  </Scene>
);

const Dashboard: React.FC<{ t: number }> = ({ t }) => (
  <Scene t={t} start={S.dashboard} end={S.themes}>
    <Caption t={t} start={S.dashboard + 0.1} title="Every pickup and return in one place" sub="Today's handovers, overdue rentals and requests waiting for your approval." x={120} y={60} width={1700} size={68} />
    <Viewport top={250}>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${rise(t, S.dashboard, 50)}px)` }}>
        <Stage t={t} cam={dashboardCam} shots={[{ layout: dashboard }]} cursor={{ keys: dashboardCursor, layout: dashboard }} />
      </div>
    </Viewport>
  </Scene>
);

const THEMES = [
  { crop: CROPS.themeClassic, label: "Classic" },
  { crop: CROPS.themeWarm, label: "Warm" },
  { crop: CROPS.themeNight, label: "Night" },
];

const Themes: React.FC<{ t: number }> = ({ t }) => {
  const k = 0.6;
  const w = 680 * k;
  const gap = 84;
  const left = (1920 - (3 * w + 2 * gap)) / 2;
  return (
    <Scene t={t} start={S.themes} end={S.mobile}>
      <Caption t={t} start={S.themes + 0.1} title="Match your brand in a few clicks" x={120} y={84} width={1700} size={72} align="center" />
      {THEMES.map(({ crop, label }, i) => {
        const at = S.themes + 0.25 + i * 0.18;
        const x = left + i * (w + gap);
        return (
          <div key={label} style={{ opacity: fade(t, at, 0.45), transform: `translateY(${rise(t, at, 70)}px)` }}>
            <Shot crop={crop} k={k} x={x} y={262} />
            <div style={{ position: "absolute", left: x, top: 262 + 1120 * k + 26, width: w, textAlign: "center", fontFamily, fontSize: 34, fontWeight: 500, color: WHITE }}>
              {label}
            </div>
          </div>
        );
      })}
    </Scene>
  );
};

const Mobile: React.FC<{ t: number }> = ({ t }) => {
  const k = 0.62;
  const phones = [CROPS.phoneCatalog, CROPS.phoneItem];
  return (
    <Scene t={t} start={S.mobile} end={S.cta}>
      <Caption t={t} start={S.mobile + 0.1} title="Built for phones" sub="A two-column catalog and a booking form sized for thumbs." x={120} y={380} width={720} size={92} />
      {phones.map((crop, i) => {
        const at = S.mobile + 0.2 + i * 0.2;
        return (
          <div key={i} style={{ opacity: fade(t, at, 0.45), transform: `translateY(${rise(t, at, 80)}px)` }}>
            <Shot crop={crop} k={k} x={940 + i * (648 * k + 70)} y={(1080 - 1352 * k) / 2} style={{ boxShadow: "0 30px 80px rgba(4, 47, 44, 0.45)" }} />
          </div>
        );
      })}
    </Scene>
  );
};

const Cta: React.FC<{ t: number }> = ({ t }) => {
  const u = easeOut(progress(t, S.cta + 0.1, 0.8));
  return (
    <Scene t={t} start={S.cta} end={S.end + 1}>
      <div style={{ position: "absolute", left: 0, top: 250, width: 1920, display: "flex", justifyContent: "center" }}>
        <Icon size={200} style={{ opacity: u, transform: `scale(${0.88 + 0.12 * u})` }} />
      </div>
      <div style={{ position: "absolute", left: 0, top: 500, width: 1920, textAlign: "center", fontFamily, color: WHITE }}>
        <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: "-0.015em", opacity: ease(progress(t, S.cta + 0.45, 0.5)) }}>Rental Manager</div>
        <div style={{ marginTop: 28, fontSize: 48, fontWeight: 400, opacity: 0.92 }}>
          <Typed t={t} start={CTA_AT} text={CTA} cps={CPS * 1.3} />
        </div>
      </div>
    </Scene>
  );
};

export const Promo: React.FC = () => {
  const t = useTime();
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Backdrop />
      <Hook t={t} />
      <Reveal t={t} />
      <Catalog t={t} />
      <Item t={t} />
      <Rentals t={t} />
      <Dashboard t={t} />
      <Themes t={t} />
      <Mobile t={t} />
      <Cta t={t} />
      <SoundTrack events={SOUNDS} />
    </AbsoluteFill>
  );
};
