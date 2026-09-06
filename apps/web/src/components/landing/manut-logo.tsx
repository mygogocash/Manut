/**
 * Manut symbol — Brand CI v1.0 canonical mark (packages/brand/assets is the
 * asset source of truth; this is the inline React twin so it inherits
 * `currentColor` and needs no network fetch).
 */
export function ManutLogo({
  className,
  title = "Manut",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path
        d="M1 6.2C1 3.3 3.3 1 6.2 1H11.8C13.4 1 14.9 1.7 15.9 2.9L18.4 6H41.8C44.7 6 47 8.3 47 11.2V34.3C47 37.2 44.7 39.5 41.8 39.5H6.2C3.3 39.5 1 37.2 1 34.3V6.2Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="13" y="14.2" width="3.6" height="7.4" rx="1.8" fill="currentColor" />
      <rect x="31.1" y="14.2" width="3.6" height="7.4" rx="1.8" fill="currentColor" />
      <path
        d="M23.5 16.9V23.4H20.3"
        stroke="currentColor"
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.3 27.3C16.5 30.4 19.9 32.2 23.6 32.2C27.3 32.2 30.7 30.4 32.9 27.3"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
