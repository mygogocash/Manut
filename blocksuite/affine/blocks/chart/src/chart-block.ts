import type { ChartBlockModel } from '@blocksuite/affine-model';
import { BlockComponent } from '@blocksuite/std';
import { css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';

/**
 * ChartBlockComponent — renders a Vega-Lite spec as an SVG chart, or shows
 * a prompt UI when no spec is present (β-AI-9).
 *
 * Chart rendering is done as a lightweight built-in SVG bar chart so that we
 * do not depend on vega-lite being present in the monorepo.  If a real vega-lite
 * integration is wired up later, this renderer can be replaced.
 */
export class ChartBlockComponent extends BlockComponent<ChartBlockModel> {
  static override styles = css`
    .affine-chart-block-container {
      position: relative;
      width: 100%;
      padding: 16px 8px;
      box-sizing: border-box;
    }

    /* ── Prompt UI ── */
    .chart-prompt {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 24px;
      border: 1.5px dashed var(--affine-border-color, #e3e3e3);
      border-radius: 8px;
      background: var(--affine-hover-color, #f9f9f9);
      font-family: var(--affine-font-family, sans-serif);
    }

    .chart-prompt p {
      margin: 0;
      font-size: 14px;
      color: var(--affine-text-secondary-color, #8e8d91);
    }

    .chart-prompt-row {
      display: flex;
      gap: 8px;
    }

    .chart-prompt input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--affine-border-color, #e3e3e3);
      border-radius: 6px;
      font-size: 14px;
      outline: none;
      background: var(--affine-background-primary-color, #fff);
      color: var(--affine-text-primary-color, #121212);
    }

    .chart-prompt input:focus {
      border-color: var(--affine-primary-color, #1e96eb);
    }

    .chart-prompt button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: var(--affine-primary-color, #1e96eb);
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      white-space: nowrap;
    }

    .chart-prompt button:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .chart-error {
      color: var(--affine-error-color, #eb4335);
      font-size: 12px;
      margin-top: 4px;
    }

    /* ── Chart canvas ── */
    .chart-canvas-wrapper {
      position: relative;
      width: 100%;
    }

    .chart-toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      margin-bottom: 8px;
    }

    .chart-toolbar button {
      padding: 4px 10px;
      border: 1px solid var(--affine-border-color, #e3e3e3);
      border-radius: 4px;
      background: var(--affine-background-primary-color, #fff);
      font-size: 12px;
      cursor: pointer;
      color: var(--affine-text-primary-color, #121212);
    }

    .chart-toolbar button:hover {
      background: var(--affine-hover-color, #f4f4f4);
    }

    svg.chart-svg {
      width: 100%;
      height: auto;
      display: block;
    }
  `;

  @state()
  private accessor _promptText = '';

  @state()
  private accessor _generating = false;

  @state()
  private accessor _error = '';

  // ── Helpers ──────────────────────────────────────────────────────────────

  private _handleInput(e: Event) {
    this._promptText = (e.target as HTMLInputElement).value;
    this._error = '';
  }

  private async _handleGenerate() {
    const prompt = this._promptText.trim();
    if (!prompt) return;

    this._generating = true;
    this._error = '';

    try {
      const spec = await this._callAI(prompt);
      this.store.updateBlock(this.model, { spec, prompt });
    } catch (err) {
      this._error =
        err instanceof Error ? err.message : 'Failed to generate chart.';
    } finally {
      this._generating = false;
    }
  }

  /**
   * Calls the AFFiNE copilot service to produce a Vega-Lite v5 JSON spec.
   *
   * Throws on any failure — network error, non-OK response, empty body, or
   * malformed JSON. The caller surfaces the message in the block's error UI.
   *
   * Earlier versions silently substituted a hardcoded "Jan-May" demo dataset
   * on any failure, which made AI failures indistinguishable from a real
   * AI-generated chart and produced misleading charts in user docs. Now the
   * user explicitly sees that AI generation failed and can retry.
   */
  private async _callAI(userPrompt: string): Promise<string> {
    const systemPrompt = `Generate a valid Vega-Lite v5 JSON specification for the following chart request.
Return ONLY the raw JSON object — no markdown code fences, no explanation.
The spec MUST include an inline "data" field with "values" (an array of objects).
Keep the spec minimal and self-contained.`;

    const fullPrompt = `${systemPrompt}\n\nChart request: ${userPrompt}`;

    let resp: Response;
    try {
      resp = await fetch('/api/copilot/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt }),
      });
    } catch (err) {
      throw new Error(
        `Could not reach the AI service: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!resp.ok) {
      throw new Error(
        `AI service returned ${resp.status}. The chart could not be generated.`
      );
    }

    const data = (await resp.json().catch(() => null)) as {
      text?: string;
      result?: string;
    } | null;
    const raw = (data?.text ?? data?.result ?? '').trim();
    if (!raw) {
      throw new Error('AI service returned an empty response.');
    }

    // Strip optional markdown code fences before validating JSON.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/, '')
      .trim();
    try {
      JSON.parse(cleaned);
    } catch {
      throw new Error(
        'AI returned a response that is not valid JSON. Try a more specific prompt.'
      );
    }
    return cleaned;
  }

  private _handleEdit() {
    const currentPrompt = this.model.props.prompt$.value;
    this.store.updateBlock(this.model, { spec: '' });
    this._promptText = currentPrompt;
  }

  private _handleRefresh() {
    const prompt = this.model.props.prompt$.value;
    if (!prompt) return;
    this._promptText = prompt;
    this.store.updateBlock(this.model, { spec: '' });
    this._callAI(prompt)
      .then(spec => {
        this.store.updateBlock(this.model, { spec });
      })
      .catch(err => {
        this._error = err instanceof Error ? err.message : 'Refresh failed.';
      });
  }

  // ── SVG bar chart renderer ───────────────────────────────────────────────

  private _renderChart(specStr: string) {
    let spec: Record<string, unknown>;
    try {
      spec = JSON.parse(specStr) as Record<string, unknown>;
    } catch {
      return html`<p class="chart-error">Invalid chart spec JSON.</p>`;
    }

    // Extract data values and encoding fields for a simple bar chart
    const data = (spec['data'] as { values?: unknown[] } | undefined)?.values;
    if (!Array.isArray(data) || data.length === 0) {
      return html`<p class="chart-error">No data values found in spec.</p>`;
    }

    const encoding = spec['encoding'] as
      | Record<string, { field?: string; type?: string }>
      | undefined;
    const xField = encoding?.['x']?.field ?? 'label';
    const yField = encoding?.['y']?.field ?? 'value';

    const rows = data as Record<string, unknown>[];
    const values = rows.map(r => Number(r[yField] ?? 0));
    const labels = rows.map(r => String(r[xField] ?? ''));
    const maxVal = Math.max(...values, 1);

    const W = 600;
    const H = 260;
    const pad = { top: 20, right: 20, bottom: 60, left: 50 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    const barW = Math.max(4, Math.floor(chartW / rows.length) - 6);
    const barSpacing = Math.floor(chartW / rows.length);

    // Y axis tick marks
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
      y: pad.top + chartH - t * chartH,
      label: Math.round(t * maxVal),
    }));

    return html`
      <svg
        class="chart-svg"
        viewBox="0 0 ${W} ${H}"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Y axis -->
        <line
          x1="${pad.left}"
          y1="${pad.top}"
          x2="${pad.left}"
          y2="${pad.top + chartH}"
          stroke="#ccc"
          stroke-width="1"
        />
        <!-- X axis -->
        <line
          x1="${pad.left}"
          y1="${pad.top + chartH}"
          x2="${pad.left + chartW}"
          y2="${pad.top + chartH}"
          stroke="#ccc"
          stroke-width="1"
        />

        <!-- Y ticks -->
        ${ticks.map(
          t => html`
            <line
              x1="${pad.left - 4}"
              y1="${t.y}"
              x2="${pad.left}"
              y2="${t.y}"
              stroke="#aaa"
              stroke-width="1"
            ></line>
            <text
              x="${pad.left - 8}"
              y="${t.y + 4}"
              text-anchor="end"
              font-size="10"
              fill="#666"
            >
              ${t.label}
            </text>
            <line
              x1="${pad.left}"
              y1="${t.y}"
              x2="${pad.left + chartW}"
              y2="${t.y}"
              stroke="#eee"
              stroke-width="1"
            ></line>
          `
        )}

        <!-- Bars -->
        ${rows.map((_, i) => {
          const barH = (values[i] / maxVal) * chartH;
          const x = pad.left + i * barSpacing + (barSpacing - barW) / 2;
          const y = pad.top + chartH - barH;
          return html`
            <rect
              x="${x}"
              y="${y}"
              width="${barW}"
              height="${barH}"
              fill="var(--affine-primary-color, #1e96eb)"
              rx="2"
            ></rect>
            <text
              x="${x + barW / 2}"
              y="${pad.top + chartH + 16}"
              text-anchor="middle"
              font-size="11"
              fill="#444"
            >
              ${labels[i]}
            </text>
          `;
        })}
      </svg>
    `;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  override renderBlock() {
    // Use reactive signal to ensure re-render when spec changes.
    const spec = this.model.props.spec$.value;
    const hasSpec = spec && spec.trim().length > 0;

    return html`
      <div class="affine-chart-block-container">
        ${hasSpec
          ? html`
              <div class="chart-canvas-wrapper">
                <div class="chart-toolbar">
                  <button @click=${this._handleEdit}>Edit spec</button>
                  <button @click=${this._handleRefresh}>Refresh data</button>
                </div>
                ${this._renderChart(spec)}
              </div>
            `
          : html`
              <div class="chart-prompt">
                <p>Describe the chart you want:</p>
                <div class="chart-prompt-row">
                  <input
                    type="text"
                    placeholder="e.g. Bar chart of sales by month"
                    .value=${this._promptText}
                    @input=${this._handleInput}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === 'Enter') {
                        this._handleGenerate().catch(() => undefined);
                      }
                    }}
                    ?disabled=${this._generating}
                  />
                  <button
                    @click=${() =>
                      this._handleGenerate().catch(() => undefined)}
                    ?disabled=${this._generating}
                  >
                    ${this._generating ? 'Generating…' : 'Generate with AI'}
                  </button>
                </div>
                ${this._error
                  ? html`<p class="chart-error">${this._error}</p>`
                  : nothing}
              </div>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-chart': ChartBlockComponent;
  }
}
