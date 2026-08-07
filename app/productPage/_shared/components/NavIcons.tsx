type IconProps = {
  size?: number;
  color?: string;
};

export function TankIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="2" width="8" height="3.5" rx="1" />
      <rect x="5" y="5.5" width="14" height="16.5" rx="4" />
    </svg>
  );
}

export function PartIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1.5" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22.5" />
      <line x1="1.5" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22.5" y2="12" />
      <line x1="4.5" y1="4.5" x2="7" y2="7" />
      <line x1="17" y1="17" x2="19.5" y2="19.5" />
      <line x1="19.5" y1="4.5" x2="17" y2="7" />
      <line x1="4.5" y1="19.5" x2="7" y2="17" />
    </svg>
  );
}

export function HomeIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4,11 12,4 20,11" />
      <rect x="6" y="11" width="12" height="9" rx="1" />
      <rect x="10" y="15" width="4" height="5" />
    </svg>
  );
}

export function CartIcon({ size = 22, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="20" r="1.3" fill={color} stroke="none" />
      <circle cx="17" cy="20" r="1.3" fill={color} stroke="none" />
      <polyline points="3,4 5,4 7.5,15.5 18,15.5 20,7 6,7" />
    </svg>
  );
}