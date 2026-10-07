/** Cranoly Mono mark: the app icon, a white C on black. */
export default function Logo({ size = 22 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny static icon; no image optimisation needed
    <img src="/icons/icon-192.png" width={size} height={size} alt="" style={{ borderRadius: size * 0.22 }} />
  );
}
