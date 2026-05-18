import type { FC, SVGProps } from 'react';

export const ManutLogoIcon: FC<SVGProps<SVGSVGElement>> = ({
  width = 24,
  height = 24,
  className,
  ...rest
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Manut"
      role="img"
      strokeLinejoin="miter"
      {...rest}
    >
      <path d="M3 20.5V3.5h3.6L12 13.7l5.4-10.2H21v17h-3.4V9.6L13 17.6h-2L6.4 9.6v10.9H3Z" />
    </svg>
  );
};
