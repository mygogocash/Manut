export function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`
            bg-muted-foreground/60 inline-block size-1.5 animate-bounce
            rounded-full
          `}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
