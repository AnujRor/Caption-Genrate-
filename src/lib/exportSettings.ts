export const EXPORT_FPS_OPTIONS = [24, 30, 60] as const;
export type ExportFps = (typeof EXPORT_FPS_OPTIONS)[number];

export const EXPORT_QUALITY_OPTIONS = [
  { value: 'standard', label: 'Standard', description: 'Smaller file size' },
  { value: 'high', label: 'High', description: 'Recommended balance' },
  { value: 'maximum', label: 'Maximum', description: 'More detail, larger file' },
] as const;
export type ExportQuality = (typeof EXPORT_QUALITY_OPTIONS)[number]['value'];

const QUALITY_MULTIPLIERS: Record<ExportQuality, number> = {
  standard: 0.65,
  high: 1,
  maximum: 1.5,
};

export function isExportFps(value: number): value is ExportFps {
  return EXPORT_FPS_OPTIONS.some((fps) => fps === value);
}

export function isExportQuality(value: string): value is ExportQuality {
  return EXPORT_QUALITY_OPTIONS.some((quality) => quality.value === value);
}

export function getExportVideoBitrate(width: number, height: number, fps: ExportFps, quality: ExportQuality): number {
  const baselineAt30Fps = Math.min(12e6, Math.max(3e6, width * height * 30 * 0.15));
  return Math.round(baselineAt30Fps * (fps / 30) * QUALITY_MULTIPLIERS[quality]);
}
