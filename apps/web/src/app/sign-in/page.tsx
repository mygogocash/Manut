import { LoginForm } from "@/components/auth/login-form";

export default function SignInPage() {
  return (
    <div
      className={`
        bg-background flex min-h-screen w-full items-center justify-center
      `}
    >
      <div
        className={`
          border-border bg-surface w-[440px] max-w-[95vw] rounded-[14px] border
          p-9 shadow-lg
        `}
      >
        <div className="mb-6 flex items-center gap-3">
          <div
            className="h-8 w-8 shrink-0"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)))",
              clipPath:
                "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            }}
          />
          <div>
            <div className="text-[15px] font-bold tracking-wide">Intranet</div>
            <div
              className={`
                text-muted-foreground text-[9px] font-normal tracking-[0.12em]
                uppercase
              `}
            >
              The Binary Holdings
            </div>
          </div>
        </div>
        <h1 className="font-sans text-xl">Sign in</h1>
        <p className="text-muted-foreground mt-1 text-[11px]">
          Enter your credentials to access the portal
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
