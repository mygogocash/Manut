import type { AudioBlockModel } from '@blocksuite/affine-model';
import { BlockComponent } from '@blocksuite/std';
import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type RecordingState = 'idle' | 'recording' | 'playback';

@customElement('affine-audio')
export class AudioBlockComponent extends BlockComponent<AudioBlockModel> {
  static override styles = css`
    :host {
      display: block;
    }

    .affine-audio-container {
      border: 1px solid var(--affine-border-color, #e3e2e4);
      border-radius: 8px;
      padding: 12px 16px;
      margin: 8px 0;
      background: var(--affine-background-primary-color, #fff);
      user-select: none;
    }

    .affine-audio-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--affine-text-secondary-color, #888);
      margin-bottom: 8px;
    }

    .affine-audio-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .affine-audio-record-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      background: var(--affine-primary-color, #1e96eb);
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .affine-audio-record-btn:hover {
      opacity: 0.85;
    }

    .affine-audio-record-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .affine-audio-record-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ff3b30;
      flex-shrink: 0;
    }

    .affine-audio-record-dot.pulsing {
      animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
    }

    .affine-audio-recording-bar {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .affine-audio-timer {
      font-family: monospace;
      font-size: 16px;
      font-weight: 600;
      color: var(--affine-text-primary-color, #121212);
      min-width: 52px;
    }

    .affine-audio-stop-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: #ff3b30;
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .affine-audio-stop-btn:hover {
      opacity: 0.85;
    }

    .affine-audio-stop-icon {
      width: 10px;
      height: 10px;
      background: #fff;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .affine-audio-waveform {
      display: flex;
      align-items: center;
      gap: 2px;
      height: 24px;
      flex: 1;
    }

    .affine-audio-waveform-bar {
      width: 3px;
      min-height: 3px;
      border-radius: 2px;
      background: var(--affine-primary-color, #1e96eb);
      animation: wave-anim 0.5s ease-in-out infinite alternate;
    }

    .affine-audio-waveform-bar:nth-child(2n) {
      animation-delay: 0.1s;
    }
    .affine-audio-waveform-bar:nth-child(3n) {
      animation-delay: 0.2s;
    }
    .affine-audio-waveform-bar:nth-child(5n) {
      animation-delay: 0.3s;
    }

    @keyframes wave-anim {
      from {
        height: 4px;
      }
      to {
        height: 20px;
      }
    }

    .affine-audio-player {
      width: 100%;
      margin-top: 4px;
    }

    .affine-audio-transcript {
      margin-top: 10px;
      padding: 8px 10px;
      background: var(--affine-background-secondary-color, #f5f5f5);
      border-radius: 6px;
      font-size: 13px;
      color: var(--affine-text-primary-color, #121212);
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .affine-audio-transcript-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--affine-text-secondary-color, #888);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .affine-audio-saving {
      font-size: 13px;
      color: var(--affine-text-secondary-color, #888);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .affine-audio-saving-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--affine-border-color, #e3e2e4);
      border-top-color: var(--affine-primary-color, #1e96eb);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .affine-audio-error {
      font-size: 13px;
      color: #ff3b30;
      margin-top: 4px;
    }
  `;

  @state() private _recordingState: RecordingState = 'idle';
  @state() private _elapsedMs = 0;
  @state() private _blobUrl: string | null = null;
  @state() private _saving = false;
  @state() private _error: string | null = null;

  private _mediaRecorder: MediaRecorder | null = null;
  private _chunks: BlobEvent['data'][] = [];
  private _timerInterval: ReturnType<typeof setInterval> | null = null;
  private _startTime = 0;

  override connectedCallback() {
    super.connectedCallback();
    this.contentEditable = 'false';

    // If there's already a sourceId, resolve the blob URL for playback.
    const sourceId = this.model.props.sourceId;
    if (sourceId) {
      this._loadBlobUrl(sourceId).catch(console.error);
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._stopTimer();
    if (this._blobUrl) {
      URL.revokeObjectURL(this._blobUrl);
    }
  }

  private async _loadBlobUrl(sourceId: string) {
    try {
      const blob = await this.store.blobSync.get(sourceId);
      if (blob) {
        const mimeType = this.model.props.mimeType ?? 'audio/webm';
        const audioBlob = new Blob([blob], { type: mimeType });
        this._blobUrl = URL.createObjectURL(audioBlob);
        this._recordingState = 'playback';
      }
    } catch {
      this._error = 'Failed to load audio.';
    }
  }

  private async _startRecording() {
    this._error = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';

      this._mediaRecorder = new MediaRecorder(stream, { mimeType });
      this._chunks = [];

      this._mediaRecorder.addEventListener('dataavailable', (e: BlobEvent) => {
        if (e.data.size > 0) {
          this._chunks.push(e.data);
        }
      });

      this._mediaRecorder.addEventListener('stop', () => {
        this._onRecordingStop(mimeType, stream).catch(console.error);
      });

      this._mediaRecorder.start(100);
      this._recordingState = 'recording';
      this._startTime = Date.now();
      this._elapsedMs = 0;
      this._timerInterval = setInterval(() => {
        this._elapsedMs = Date.now() - this._startTime;
      }, 100);
    } catch (err) {
      this._error =
        err instanceof Error ? err.message : 'Microphone access denied.';
    }
  }

  private _stopRecording() {
    this._mediaRecorder?.stop();
    this._stopTimer();
  }

  private async _onRecordingStop(mimeType: string, stream: MediaStream) {
    // Stop all tracks to release the mic
    stream.getTracks().forEach(t => t.stop());

    const durationMs = this._elapsedMs;
    const audioBlob = new Blob(this._chunks, { type: mimeType });
    this._saving = true;
    this._recordingState = 'playback';

    try {
      // Upload blob to the block store
      const sourceId = await this.store.blobSync.set(audioBlob);

      // Create an object URL for immediate local playback
      const url = URL.createObjectURL(audioBlob);
      if (this._blobUrl) {
        URL.revokeObjectURL(this._blobUrl);
      }
      this._blobUrl = url;

      // Persist props on the model
      this.store.transact(() => {
        this.store.updateBlock(this.model, {
          sourceId,
          duration: durationMs,
          mimeType,
        });
      });
    } catch {
      this._error = 'Failed to save audio recording.';
    } finally {
      this._saving = false;
    }
  }

  private _stopTimer() {
    if (this._timerInterval !== null) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  private _formatTime(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, '0');
    const sec = (totalSec % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }

  private _renderIdle() {
    return html`
      <button class="affine-audio-record-btn" @click=${this._startRecording}>
        <span class="affine-audio-record-dot"></span>
        Record audio
      </button>
    `;
  }

  private _renderRecording() {
    const waveformBars = Array.from(
      { length: 12 },
      (_, i) => html`
        <div
          class="affine-audio-waveform-bar"
          style="animation-delay: ${i * 0.05}s"
        ></div>
      `
    );

    return html`
      <div class="affine-audio-recording-bar">
        <span class="affine-audio-record-dot pulsing"></span>
        <span class="affine-audio-timer"
          >${this._formatTime(this._elapsedMs)}</span
        >
        <div class="affine-audio-waveform">${waveformBars}</div>
        <button class="affine-audio-stop-btn" @click=${this._stopRecording}>
          <span class="affine-audio-stop-icon"></span>
          Stop
        </button>
      </div>
    `;
  }

  private _renderPlayback() {
    const transcript = this.model.props.transcript;

    return html`
      ${this._saving
        ? html`<div class="affine-audio-saving">
            <div class="affine-audio-saving-spinner"></div>
            Saving…
          </div>`
        : nothing}
      ${this._blobUrl
        ? html`<audio
            class="affine-audio-player"
            controls
            src=${this._blobUrl}
          ></audio>`
        : nothing}
      ${transcript
        ? html`
            <div class="affine-audio-transcript">
              <div class="affine-audio-transcript-label">Transcript</div>
              ${transcript}
            </div>
          `
        : nothing}
    `;
  }

  override renderBlock() {
    const state = this._recordingState;
    return html`
      <div class="affine-audio-container">
        <div class="affine-audio-header">
          <svg
            class="affine-audio-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          Audio recording
        </div>
        ${state === 'idle' ? this._renderIdle() : nothing}
        ${state === 'recording' ? this._renderRecording() : nothing}
        ${state === 'playback' ? this._renderPlayback() : nothing}
        ${this._error
          ? html`<div class="affine-audio-error">${this._error}</div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-audio': AudioBlockComponent;
  }
}
