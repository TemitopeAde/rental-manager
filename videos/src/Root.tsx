import React from "react";
import { Composition } from "remotion";

import { DURATION, FPS } from "./promo/cues";
import { Promo } from "./promo/Promo";

export const Root: React.FC = () => (
  <Composition id="Promo" component={Promo} durationInFrames={DURATION * FPS} fps={FPS} width={1920} height={1080} />
);
