/**
 * All tunables live here (spec §3.4). One place to tune.
 */
export const CONFIG = {
  /** §3.1 max LAB distance from the border mean for a sample to count as "background" */
  PLAIN_BG_LAB_THRESHOLD: 12,
  /** §3.1 fraction of border samples that must be within threshold */
  PLAIN_BG_RATIO: 0.92,
  /** §3.1 sample every Nth border pixel */
  BORDER_SAMPLE_STEP: 4,
  /** §3.2 max LAB distance for the flood fill to spread into a pixel */
  FLOOD_TOLERANCE: 24,
  /** §3.3 gaussian sigma applied to the alpha channel only */
  ALPHA_BLUR_RADIUS: 1.5,
  /** §3.3 pixels to erode the kept mask by before blurring (kills the colour fringe) */
  EROSION_PX: 1,
};

export type Config = typeof CONFIG;
