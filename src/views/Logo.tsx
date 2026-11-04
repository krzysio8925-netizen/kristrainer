import { BRANDS, GABI_LOGO, type BrandId } from '../brand';

/** Logo Kris Trainer (to samo co w planie treningowym) albo GabiTrainer. tone="light" – wersja na ciemne tło. */
export function Logo({ width, height, brand = 'kris', tone = 'dark' }: { width?: number; height?: number; brand?: BrandId; tone?: 'dark' | 'light' }) {
  if (brand === 'gabi') {
    const w = width ?? (height ? height * BRANDS.gabi.ratio : 168);
    return <img className="logo" src={tone === 'light' ? GABI_LOGO.blush : GABI_LOGO.plum} alt="GabiTrainer" style={{ width: w, height: 'auto' }} />;
  }
  return (
    <svg className="logo" viewBox="0 0 210 52" role="img" aria-label="Kris Trainer" style={{ width: width ?? (height ? height * BRANDS.kris.ratio : 168), height: 'auto' }}>
      <rect x="0" y="0" width="52" height="52" rx="12" fill="#111827" />
      <rect x="8" y="23" width="36" height="6" rx="1.5" fill="#f59e0b" />
      <rect x="5" y="15" width="6" height="22" rx="2" fill="#f59e0b" /><rect x="41" y="15" width="6" height="22" rx="2" fill="#f59e0b" />
      <path d="M17 10 v32 M17 26 L35 10 M22 22 L35 42" stroke="#ffffff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="62" y="28" fontFamily="Inter, Arial, sans-serif" fontWeight="900" fontSize="25" letterSpacing="-0.5" fill="var(--logo-ink)">KRIS</text>
      <text x="63" y="45" fontFamily="Inter, Arial, sans-serif" fontWeight="600" fontSize="11.5" letterSpacing="4.6" fill="#f59e0b">TRAINER</text>
    </svg>
  );
}
