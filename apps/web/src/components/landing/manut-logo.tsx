/**
 * Temporary stand-in mark adapted from Fabric’s smiling-folder icon
 * (https://fabric.so / Refero Fabric style). Replace with Manut’s own mark
 * before any public/marketing launch.
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
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path
        d="M6.5 10C6.5 7.791 8.291 6 10.5 6h2.85c.53 0 1.04.21 1.41.59l1.34 1.34c.37.37.88.59 1.41.59H21.5c2.209 0 4 1.791 4 4V22c0 2.209-1.791 4-4 4h-11c-2.209 0-4-1.791-4-4V10z"
        fill="currentColor"
      />
      <rect x="12" y="13" width="2.4" height="3.6" rx="1.2" fill="#fff" />
      <rect x="17.6" y="13" width="2.4" height="3.6" rx="1.2" fill="#fff" />
      <rect x="14.8" y="15.1" width="2.4" height="4" rx="1.2" fill="#fff" />
      <path
        d="M12 21.2c1.4 1.6 3.1 2.4 4 2.4s2.6-.8 4-2.4"
        stroke="#fff"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
