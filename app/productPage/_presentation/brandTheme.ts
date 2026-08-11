const BRAND_ACCENT_PALETTE = ["#0f9b8e", "#16a34a", "#2563eb", "#dc2626", "#9333ea", "#ea580c"];

export function getBrandAccentColor(brandId: number): string {
  const index = Math.abs(brandId) % BRAND_ACCENT_PALETTE.length;
  return BRAND_ACCENT_PALETTE[index];
}
