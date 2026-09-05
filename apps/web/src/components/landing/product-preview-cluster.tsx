function MockChrome({ label }: { label: string }) {
  return (
    <div className="ml-mock-chrome">
      <span className="ml-mock-dot" />
      <span className="ml-mock-dot" />
      <span className="ml-mock-dot" />
      <span
        style={{
          marginLeft: 8,
          fontSize: 11,
          fontWeight: 500,
          color: "var(--ml-graphite)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function PreviewCard({
  className,
  label,
  withPill,
}: {
  className: string;
  label: string;
  withPill?: boolean;
}) {
  return (
    <div className={`ml-preview-card ${className}`} aria-hidden>
      <MockChrome label={label} />
      <div className="ml-mock-body">
        {withPill ? (
          <span className="ml-mock-pill">
            <span className="ml-mock-pill-dot" />
            Approval ready
          </span>
        ) : null}
        <div className="ml-mock-line ml-mock-line--mid" />
        <div className="ml-mock-line" />
        <div className="ml-mock-line ml-mock-line--short" />
        <div className="ml-mock-block" />
      </div>
    </div>
  );
}

export function ProductPreviewCluster() {
  return (
    <div className="ml-hero-stage ml-animate-stage" aria-hidden>
      <PreviewCard className="ml-preview-card--left" label="Leave" />
      <PreviewCard
        className="ml-preview-card--center"
        label="Workspace"
        withPill
      />
      <PreviewCard className="ml-preview-card--right" label="Expenses" />
    </div>
  );
}
