type GasCylinderGlyphProps = {
  accentColor: string;
  label: string;
};

export default function GasCylinderGlyph({ accentColor, label }: GasCylinderGlyphProps) {
  return (
    <svg viewBox="0 0 120 160" width="100%" height="100%" role="img" aria-label={`ถังแก๊ส ${label}`}>
      <circle cx="60" cy="12" r="6" fill="#9ca3af" />
      <rect x="32" y="16" width="56" height="16" rx="5" fill="#9ca3af" />
      <rect x="16" y="30" width="88" height="118" rx="18" fill={accentColor} />
      <rect x="16" y="68" width="88" height="26" fill="rgba(255,255,255,0.9)" />
      <text x="60" y="86" textAnchor="middle" fontSize="18" fontWeight="700" fill={accentColor}>
        {label}
      </text>
    </svg>
  );
}