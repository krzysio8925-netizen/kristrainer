import { useId } from 'react';
import { BRANDS, GABI, type BrandId } from '../brand';

/** Logo Kris Trainer (to samo co w planie treningowym) albo GabiTrainer. */
export function Logo({ width = 168, brand = 'kris' }: { width?: number; brand?: BrandId }) {
  const clip = useId();
  if (brand === 'gabi') return (
    <svg className="logo" viewBox={`0 0 ${BRANDS.gabi.w} 52`} role="img" aria-label="GabiTrainer" style={{ width, height: 'auto' }}>
      <clipPath id={clip}><rect x="0" y="0" width="52" height="52" rx="12" /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="0" width="52" height="52" fill={GABI.bg} />
        <circle cx="43" cy="6.5" r="16" fill={GABI.blob} />
        <circle cx="10" cy="41" r="4" fill={GABI.dot} />
      </g>
      <text x="26" y="37" textAnchor="middle" fontFamily="Caprasimo, Georgia, serif" fontSize="31" fill={GABI.cream}>G</text>
      <text x="62" y="35" fontFamily="Caprasimo, Georgia, serif" fontSize="25" fill="var(--logo-ink)">Gabi<tspan fill={GABI.accent}>Trainer</tspan></text>
    </svg>
  );
  return (
    <svg className="logo" viewBox="0 0 210 52" role="img" aria-label="Kris Trainer" style={{ width, height: 'auto' }}>
      <rect x="0" y="0" width="52" height="52" rx="12" fill="#111827" />
      <rect x="8" y="23" width="36" height="6" rx="1.5" fill="#f59e0b" />
      <rect x="5" y="15" width="6" height="22" rx="2" fill="#f59e0b" /><rect x="41" y="15" width="6" height="22" rx="2" fill="#f59e0b" />
      <path d="M17 10 v32 M17 26 L35 10 M22 22 L35 42" stroke="#ffffff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="62" y="28" fontFamily="Inter, Arial, sans-serif" fontWeight="900" fontSize="25" letterSpacing="-0.5" fill="var(--logo-ink)">KRIS</text>
      <text x="63" y="45" fontFamily="Inter, Arial, sans-serif" fontWeight="600" fontSize="11.5" letterSpacing="4.6" fill="#f59e0b">TRAINER</text>
    </svg>
  );
}
