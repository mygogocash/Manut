export function ProductDemoPanel() {
  return (
    <section id="product" className="ml-demo ml-container">
      <div className="ml-demo-frame">
        <article className="ml-panel" aria-label="Request board preview">
          <div className="ml-panel-header">
            <span>Purchase request · PR-2041</span>
            <div className="ml-panel-tools">
              <span>Search</span>
              <span>···</span>
            </div>
          </div>
          <div className="ml-panel-body">
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.55,
                color: "var(--ml-press-black)",
                marginBottom: 8,
              }}
            >
              Replace the aging laptop fleet for the Bangkok sales pod —
              quote attached, budget line 4.2.
            </p>
            <div className="ml-annotation">
              <span className="ml-annotation-dot" />
              <span className="ml-annotation-label">Maya · Finance</span>
            </div>
            <p className="ml-body-muted" style={{ fontSize: 15 }}>
              Waiting on stage 2 of 3. Manager approved yesterday; finance
              reviews vendor terms before procurement unlocks.
            </p>
            <div
              style={{
                marginTop: 20,
                padding: 12,
                background: "var(--ml-newsprint)",
                borderRadius: 12,
                fontSize: 14,
                color: "var(--ml-slate)",
              }}
            >
              Timeline · Submitted → Manager → Finance → Done
            </div>
          </div>
        </article>

        <aside className="ml-panel" aria-label="Manut AI assistant preview">
          <div className="ml-panel-header">
            <span>Manut AI</span>
            <div className="ml-panel-tools">
              <span>✦</span>
              <span>×</span>
            </div>
          </div>
          <div className="ml-panel-body">
            <div className="ml-ai-actions">
              <span className="ml-ai-action">Summarize thread</span>
              <span className="ml-ai-action">Draft reply</span>
              <span className="ml-ai-action">Find policy</span>
            </div>
            <div className="ml-ai-note">
              Suggested update: flag the vendor&apos;s 30-day net terms against
              your cash-advance policy, then ping Finance with the gap.
            </div>
            <div className="ml-ai-ghosts">
              <span className="ml-ai-ghost">Apply changes</span>
              <span className="ml-ai-ghost ml-ai-ghost--muted">Reject</span>
            </div>
            <div className="ml-ai-input">
              <span className="ml-ai-plus">+ Actions</span>
              <span>Ask Manut AI about this request…</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
