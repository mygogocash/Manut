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
      {...rest}
    >
      <path d="M3 20.5V3.5h3.7L12 12.5l5.3-9h3.7v17h-3.4V10.2L13 17.4h-2L6.4 10.2v10.3H3Z" />
    </svg>
  );
};
