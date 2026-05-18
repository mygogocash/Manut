import { memo } from 'react';

export default memo(function Logo() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Manut"
      role="img"
    >
      {/* Faint guide rectangle (stroke only, low opacity) */}
      <rect
        x="20"
        y="20"
        width="80"
        height="80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.15"
      />
      {/* Geometric "M" lettermark, scaled and centered (originally on a 24x24 grid, scaled ~3.6x and offset to fit 32-100 vertical / 28-92 horizontal) */}
      <path d="M28 92 V28 h13.5 L60 66.5 L78.5 28 H92 V92 H79.2 V51.1 L65 81.2 H55 L40.8 51.1 V92 Z" />
      {/* Four corner dots on the guide rectangle */}
      <circle cx="20" cy="20" r="2" opacity="0.4" />
      <circle cx="100" cy="20" r="2" opacity="0.4" />
      <circle cx="20" cy="100" r="2" opacity="0.4" />
      <circle cx="100" cy="100" r="2" opacity="0.4" />
    </svg>
  );
});
