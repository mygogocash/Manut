import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className={`
        from-background to-muted/30 flex min-h-screen flex-col items-center
        justify-center bg-linear-to-b px-4
      `}
    >
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="relative">
          <span
            className={`
              text-muted-foreground/10 text-[10rem] leading-none font-extrabold
              tracking-tighter select-none
              sm:text-[14rem]
            `}
          >
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`
                flex size-20 items-center justify-center rounded-2xl shadow-lg
                sm:size-24
              `}
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)))",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="hsl(var(--sidebar-primary-foreground))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`
                  size-10
                  sm:size-12
                `}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
                <path d="M8 11h6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1
            className={`
              text-2xl font-bold tracking-tight
              sm:text-3xl
            `}
          >
            Page not found
          </h1>
          <p
            className={`
              text-muted-foreground max-w-md text-sm
              sm:text-base
            `}
          >
            The page you&apos;re looking for doesn&apos;t exist or you
            don&apos;t have permission to access it.
          </p>
        </div>

        <Link
          href="/dashboard"
          className={`
            text-sidebar-primary-foreground inline-flex items-center gap-2
            rounded-lg px-6 py-3 text-sm font-semibold shadow-md transition-all
            hover:shadow-lg hover:brightness-110
          `}
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)))",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
