export const Logo = () => {
  return (
    <svg
      width="132"
      height="48"
      viewBox="0 0 132 48"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Manut"
      role="img"
    >
      {/* m — left stem, two arches */}
      <path d="M10 38 V19 a5 5 0 0 1 5 -5 h3 a5 5 0 0 1 5 5 V38 H18 V20 h-3 V38 Z" />
      <path d="M23 38 V19 a5 5 0 0 1 5 -5 h3 a5 5 0 0 1 5 5 V38 H31 V20 h-3 V38 Z" />
      {/* a — ring with right stem and bottom bar */}
      <path d="M42 25 a9 9 0 0 1 9 -11 h2 a7 7 0 0 1 7 7 V38 H55 V32 h-4 a9 9 0 0 1 -9 -7 Z M51 20 a4 4 0 0 0 -4 4 a4 4 0 0 0 4 4 h4 V20 Z" />
      <path d="M55 30 V38 h5 V21 a7 7 0 0 0 -2 -5 V30 Z" />
      {/* n — left stem, arch, right stem */}
      <path d="M66 38 V19 a5 5 0 0 1 5 -5 h7 a6 6 0 0 1 6 6 V38 H79 V21 a1 1 0 0 0 -1 -1 h-7 V38 Z" />
      {/* u — left stem, bottom arch, right stem */}
      <path d="M90 14 h5 V32 a1 1 0 0 0 1 1 h6 V14 h5 V38 h-11 a6 6 0 0 1 -6 -6 Z" />
      {/* t — vertical with crossbar and foot bend */}
      <path d="M118 8 h5 V14 h4 V19 h-4 V32 a1 1 0 0 0 1 1 h3 V38 h-4 a5 5 0 0 1 -5 -5 V19 h-3 V14 h3 Z" />
    </svg>
  );
};
