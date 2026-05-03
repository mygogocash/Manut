import { css } from '@emotion/css';
import { signal } from '@preact/signals-core';
import { type TemplateResult } from 'lit';
import { html } from 'lit/static-html.js';

import { createUniComponentFromWebComponent } from '../../../core/index.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import type { FormSingleView } from '../form-view-manager.js';
import type { FormViewSelectionWithType } from '../selection.js';

// ─── Styles ───────────────────────────────────────────────────────────────

const formViewStyle = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  font-size: 14px;
  padding: 16px;
  box-sizing: border-box;
`;

const formHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
`;

const formHeaderTitleStyle = css`
  font-weight: 600;
  font-size: 18px;
`;

const headerActionsStyle = css`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const buttonStyle = css`
  appearance: none;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.5;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const primaryButtonStyle = css`
  appearance: none;
  border: none;
  background: var(--affine-primary-color, #1e90ff);
  color: #fff;
  border-radius: 6px;
  padding: 4px 16px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.5;
  &:hover {
    opacity: 0.9;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const activeButtonStyle = css`
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.08));
  font-weight: 600;
`;

const formBodyStyle = css`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const formTitleInputStyle = css`
  font-size: 24px;
  font-weight: 700;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  width: 100%;
  margin-bottom: 4px;
  &::placeholder {
    color: var(--affine-placeholder-color, #aaa);
  }
`;

const formDescriptionInputStyle = css`
  font-size: 14px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--affine-text-secondary-color, #888);
  width: 100%;
  resize: none;
  min-height: 40px;
  margin-bottom: 12px;
  &::placeholder {
    color: var(--affine-placeholder-color, #ccc);
  }
`;

const fieldCardStyle = css`
  background: var(--affine-background-secondary-color, #fafafa);
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
`;

const fieldCardEditStyle = css`
  cursor: grab;
  &:hover {
    border-color: var(--affine-primary-color, #1e90ff);
  }
`;

const fieldLabelRowStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
`;

const fieldLabelStyle = css`
  font-weight: 500;
  font-size: 14px;
`;

const fieldRequiredMarkStyle = css`
  color: var(--affine-error-color, #eb4646);
  margin-left: 2px;
`;

const fieldErrorStyle = css`
  color: var(--affine-error-color, #eb4646);
  font-size: 12px;
  margin-top: 4px;
`;

const fieldControlStyle = css`
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 6px;
  background: var(--affine-background-primary-color, #fff);
  color: inherit;
  font-size: 14px;
  box-sizing: border-box;
  outline: none;
  &:focus {
    border-color: var(--affine-primary-color, #1e90ff);
  }
`;

const fieldControlErrorStyle = css`
  border-color: var(--affine-error-color, #eb4646) !important;
`;

const checkboxListStyle = css`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const checkboxItemStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
`;

const fieldBuilderActionsStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--affine-border-color, #e3e3e3);
`;

const toggleSwitchStyle = css`
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
`;

const toggleInputStyle = css`
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
`;

const toggleSliderStyle = css`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--affine-border-color, #ccc);
  border-radius: 20px;
  transition: 0.2s;
  &::before {
    position: absolute;
    content: '';
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: 0.2s;
  }
`;

const toggleSliderCheckedStyle = css`
  background-color: var(--affine-primary-color, #1e90ff);
  &::before {
    transform: translateX(16px);
  }
`;

const settingsPanelStyle = css`
  background: var(--affine-background-secondary-color, #fafafa);
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const settingsRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const settingsLabelStyle = css`
  font-size: 14px;
  font-weight: 500;
`;

const settingsDescStyle = css`
  font-size: 12px;
  color: var(--affine-text-secondary-color, #888);
  margin-top: 2px;
`;

const publicUrlStyle = css`
  font-size: 12px;
  color: var(--affine-primary-color, #1e90ff);
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  padding: 6px 10px;
  border-radius: 6px;
  word-break: break-all;
`;

const submitSuccessStyle = css`
  text-align: center;
  padding: 40px 20px;
  color: var(--affine-text-primary-color, #111);
`;

const submitSuccessTitleStyle = css`
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 12px;
`;

const submitSuccessDescStyle = css`
  color: var(--affine-text-secondary-color, #888);
  font-size: 14px;
`;

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Generate a nanoid-style random string for form IDs */
function generateFormId(length = 12): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i]! % chars.length];
  }
  return result;
}

// ─── UI Logic ─────────────────────────────────────────────────────────────

export class FormViewUILogic extends DataViewUILogicBase<
  FormSingleView,
  FormViewSelectionWithType
> {
  ui$ = signal<FormViewUI | undefined>();

  /** Whether the user is viewing the builder or preview mode */
  previewMode$ = signal(false);

  /** Whether the settings panel is open */
  settingsOpen$ = signal(false);

  /** Track field values during preview/submit mode */
  fieldValues$ = signal<Record<string, unknown>>({});

  /** Track validation errors per field */
  fieldErrors$ = signal<Record<string, string>>({});

  /** Whether the form has been submitted successfully */
  submitted$ = signal(false);

  togglePreview = () => {
    this.previewMode$.value = !this.previewMode$.value;
    // Reset state when switching modes
    this.fieldValues$.value = {};
    this.fieldErrors$.value = {};
    this.submitted$.value = false;
  };

  toggleSettings = () => {
    this.settingsOpen$.value = !this.settingsOpen$.value;
  };

  setFieldValue = (fieldId: string, value: unknown) => {
    this.fieldValues$.value = { ...this.fieldValues$.value, [fieldId]: value };
    // Clear error on change
    if (this.fieldErrors$.value[fieldId]) {
      const errs = { ...this.fieldErrors$.value };
      delete errs[fieldId];
      this.fieldErrors$.value = errs;
    }
  };

  /** α-FORM-2: Validate required fields and submit */
  _validateAndSubmit = () => {
    const errors: Record<string, string> = {};
    const columns = this.view.formColumns$.value;

    for (const col of columns) {
      if (col.hide) continue;
      if (!col.required) continue;
      const val = this.fieldValues$.value[col.id];
      const isEmpty =
        val === undefined ||
        val === null ||
        val === '' ||
        (Array.isArray(val) && val.length === 0);
      if (isEmpty) {
        errors[col.id] = 'This field is required';
      }
    }

    if (Object.keys(errors).length > 0) {
      this.fieldErrors$.value = errors;
      return;
    }

    // Create a new row and populate cells
    const rowId = this.view.rowAdd('end');
    const values = this.fieldValues$.value;

    for (const col of columns) {
      if (col.hide) continue;
      const value = values[col.id];
      if (value === undefined || value === null) continue;
      const property = this.view.propertyGetOrCreate(col.id);
      const cell = property.cellGetOrCreate(rowId);
      cell.valueSet(value as any);
    }

    this.submitted$.value = true;
    this.fieldValues$.value = {};
    this.fieldErrors$.value = {};
  };

  /** α-FORM-3: Ensure the form has a stable public ID, generate if missing */
  ensureFormId = () => {
    if (!this.view.formId$.value) {
      this.view.setFormId(generateFormId());
    }
    return this.view.formId$.value!;
  };

  clearSelection = () => {
    this.setSelection(undefined);
  };

  addRow = () => {
    if (this.view.readonly$.value) return undefined;
    return this.view.rowAdd('end');
  };

  focusFirstCell = () => {
    // No keyboard-focused cell concept in form MVP.
  };

  showIndicator = (_evt: MouseEvent) => {
    return false;
  };

  hideIndicator = () => {};

  moveTo = (_id: string, _evt: MouseEvent) => {};

  renderer = createUniComponentFromWebComponent(FormViewUI);
}

// ─── Lit element ──────────────────────────────────────────────────────────

export class FormViewUI extends DataViewUIBase<FormViewUILogic> {
  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.classList.add(formViewStyle);
  }

  private _renderToggleSwitch(
    checked: boolean,
    onChange: (val: boolean) => void
  ): TemplateResult {
    return html`
      <label class=${toggleSwitchStyle}>
        <input
          type="checkbox"
          class=${toggleInputStyle}
          .checked=${checked}
          @change=${(e: Event) =>
            onChange((e.target as HTMLInputElement).checked)}
        />
        <span
          class=${`${toggleSliderStyle}${checked ? ' ' + toggleSliderCheckedStyle : ''}`}
        ></span>
      </label>
    `;
  }

  /** α-FORM-1: Render the appropriate input for a property type */
  private _renderFieldInput(
    propertyId: string,
    propertyType: string,
    currentValue: unknown,
    hasError: boolean
  ): TemplateResult {
    const controlClass = `${fieldControlStyle}${hasError ? ' ' + fieldControlErrorStyle : ''}`;
    const onInput = (value: unknown) =>
      this.logic.setFieldValue(propertyId, value);

    switch (propertyType) {
      case 'title':
      case 'text':
      case 'rich-text': {
        const val = typeof currentValue === 'string' ? currentValue : '';
        if (propertyType === 'title') {
          return html`
            <input
              type="text"
              class=${controlClass}
              placeholder="Enter title..."
              .value=${val}
              @input=${(e: Event) =>
                onInput((e.target as HTMLInputElement).value)}
            />
          `;
        }
        return html`
          <textarea
            class=${controlClass}
            placeholder="Enter text..."
            rows="3"
            .value=${val}
            @input=${(e: Event) =>
              onInput((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        `;
      }

      case 'number': {
        const val =
          currentValue !== undefined && currentValue !== null
            ? String(currentValue)
            : '';
        return html`
          <input
            type="number"
            class=${controlClass}
            placeholder="0"
            .value=${val}
            @input=${(e: Event) => {
              const raw = (e.target as HTMLInputElement).value;
              onInput(raw === '' ? null : Number(raw));
            }}
          />
        `;
      }

      case 'date': {
        const val = typeof currentValue === 'string' ? currentValue : '';
        return html`
          <input
            type="date"
            class=${controlClass}
            .value=${val}
            @change=${(e: Event) =>
              onInput((e.target as HTMLInputElement).value)}
          />
        `;
      }

      case 'select': {
        const property = this.logic.view.propertyGetOrCreate(propertyId);
        const options = (property.data$.value as any)?.options ?? [];
        const val = typeof currentValue === 'string' ? currentValue : '';
        return html`
          <select
            class=${controlClass}
            .value=${val}
            @change=${(e: Event) =>
              onInput((e.target as HTMLSelectElement).value)}
          >
            <option value="">-- Select an option --</option>
            ${options.map(
              (opt: { id: string; value: string }) =>
                html`<option value=${opt.id} ?selected=${val === opt.id}>
                  ${opt.value}
                </option>`
            )}
          </select>
        `;
      }

      case 'multi-select': {
        const property = this.logic.view.propertyGetOrCreate(propertyId);
        const options = (property.data$.value as any)?.options ?? [];
        const selected: string[] = Array.isArray(currentValue)
          ? (currentValue as string[])
          : [];
        return html`
          <div
            class=${`${checkboxListStyle}${hasError ? ' ' + fieldControlErrorStyle : ''}`}
          >
            ${options.map(
              (opt: { id: string; value: string }) => html`
                <label class=${checkboxItemStyle}>
                  <input
                    type="checkbox"
                    .checked=${selected.includes(opt.id)}
                    @change=${(e: Event) => {
                      const checked = (e.target as HTMLInputElement).checked;
                      const next = checked
                        ? [...selected, opt.id]
                        : selected.filter(id => id !== opt.id);
                      onInput(next);
                    }}
                  />
                  ${opt.value}
                </label>
              `
            )}
          </div>
        `;
      }

      case 'checkbox': {
        const val = Boolean(currentValue);
        return html`
          <label class=${checkboxItemStyle}>
            <input
              type="checkbox"
              .checked=${val}
              @change=${(e: Event) =>
                onInput((e.target as HTMLInputElement).checked)}
            />
            Yes
          </label>
        `;
      }

      case 'url': {
        const val = typeof currentValue === 'string' ? currentValue : '';
        return html`
          <input
            type="url"
            class=${controlClass}
            placeholder="https://..."
            .value=${val}
            @input=${(e: Event) =>
              onInput((e.target as HTMLInputElement).value)}
          />
        `;
      }

      case 'phone': {
        const val = typeof currentValue === 'string' ? currentValue : '';
        return html`
          <input
            type="tel"
            class=${controlClass}
            placeholder="+1 (555) 000-0000"
            .value=${val}
            @input=${(e: Event) =>
              onInput((e.target as HTMLInputElement).value)}
          />
        `;
      }

      case 'email': {
        const val = typeof currentValue === 'string' ? currentValue : '';
        return html`
          <input
            type="email"
            class=${controlClass}
            placeholder="email@example.com"
            .value=${val}
            @input=${(e: Event) =>
              onInput((e.target as HTMLInputElement).value)}
          />
        `;
      }

      default: {
        const val = typeof currentValue === 'string' ? currentValue : '';
        return html`
          <input
            type="text"
            class=${controlClass}
            .value=${val}
            @input=${(e: Event) =>
              onInput((e.target as HTMLInputElement).value)}
          />
        `;
      }
    }
  }

  private _renderPreviewField(col: {
    id: string;
    hide?: boolean;
    required?: boolean;
    label?: string;
  }): TemplateResult {
    const property = this.logic.view.propertyGetOrCreate(col.id);
    const propertyType = property.type$.value;
    const displayLabel =
      col.label ?? property.name$.value ?? propertyType ?? col.id;
    const currentValue = this.logic.fieldValues$.value[col.id];
    const errorMsg = this.logic.fieldErrors$.value[col.id];
    const hasError = Boolean(errorMsg);

    return html`
      <div class=${fieldCardStyle}>
        <div class=${fieldLabelRowStyle}>
          <span class=${fieldLabelStyle}>${displayLabel}</span>
          ${col.required
            ? html`<span class=${fieldRequiredMarkStyle}>*</span>`
            : null}
        </div>
        ${this._renderFieldInput(col.id, propertyType, currentValue, hasError)}
        ${hasError
          ? html`<div class=${fieldErrorStyle}>${errorMsg}</div>`
          : null}
      </div>
    `;
  }

  private _renderBuilderField(col: {
    id: string;
    hide?: boolean;
    required?: boolean;
    label?: string;
  }): TemplateResult {
    const property = this.logic.view.propertyGetOrCreate(col.id);
    const propertyType = property.type$.value;
    const displayLabel =
      col.label ?? property.name$.value ?? propertyType ?? col.id;
    const isRequired = col.required ?? false;

    return html`
      <div class=${`${fieldCardStyle} ${fieldCardEditStyle}`}>
        <div class=${fieldLabelRowStyle}>
          <span class=${fieldLabelStyle}>${displayLabel}</span>
          ${isRequired
            ? html`<span class=${fieldRequiredMarkStyle}>*</span>`
            : null}
          <span
            style="margin-left:auto;font-size:11px;color:var(--affine-text-secondary-color,#888)"
          >
            ${propertyType}
          </span>
        </div>
        <!-- Disabled preview of the input in builder mode -->
        <div style="opacity:0.5;pointer-events:none">
          ${this._renderFieldInput(col.id, propertyType, undefined, false)}
        </div>
        <!-- Field builder actions: hide/show, required toggle -->
        <div class=${fieldBuilderActionsStyle}>
          <label
            class=${checkboxItemStyle}
            style="font-size:12px;color:var(--affine-text-secondary-color,#888)"
          >
            <input
              type="checkbox"
              .checked=${isRequired}
              @change=${(e: Event) => {
                const checked = (e.target as HTMLInputElement).checked;
                this.logic.view.setColumnRequired(col.id, checked);
              }}
            />
            Required
          </label>
          <label
            class=${checkboxItemStyle}
            style="font-size:12px;color:var(--affine-text-secondary-color,#888)"
          >
            <input
              type="checkbox"
              .checked=${col.hide ?? false}
              @change=${(e: Event) => {
                const checked = (e.target as HTMLInputElement).checked;
                (property as any).hideSet(checked);
              }}
            />
            Hidden
          </label>
        </div>
      </div>
    `;
  }

  /** α-FORM-3: Settings panel */
  private _renderSettings(): TemplateResult {
    const view = this.logic.view;
    const isPublic = view.isPublic$.value;
    const formTitle = view.formTitle$.value;
    const formDescription = view.formDescription$.value;

    let formId = view.formId$.value;
    if (isPublic && !formId) {
      formId = this.logic.ensureFormId();
    }

    const publicUrl = formId ? `https://affine.pro/forms/${formId}` : null;

    return html`
      <div class=${settingsPanelStyle}>
        <div style="font-weight:600;font-size:16px">Form Settings</div>

        <div>
          <div class=${settingsLabelStyle}>Form Title</div>
          <input
            type="text"
            class=${fieldControlStyle}
            placeholder="Untitled Form"
            .value=${formTitle}
            @input=${(e: Event) =>
              view.setFormTitle((e.target as HTMLInputElement).value)}
            style="margin-top:6px"
          />
        </div>

        <div>
          <div class=${settingsLabelStyle}>Description</div>
          <textarea
            class=${fieldControlStyle}
            placeholder="Add a description for your form..."
            rows="3"
            .value=${formDescription}
            @input=${(e: Event) =>
              view.setFormDescription((e.target as HTMLTextAreaElement).value)}
            style="margin-top:6px;resize:vertical"
          ></textarea>
        </div>

        <div class=${settingsRowStyle}>
          <div>
            <div class=${settingsLabelStyle}>Accept public submissions</div>
            <div class=${settingsDescStyle}>
              Allow anyone with the link to submit this form
            </div>
          </div>
          ${this._renderToggleSwitch(isPublic, checked => {
            view.setPublic(checked);
            if (checked) {
              this.logic.ensureFormId();
            }
          })}
        </div>

        ${isPublic && publicUrl
          ? html`
              <div>
                <div
                  class=${settingsDescStyle}
                  style="margin-bottom:6px;font-weight:500"
                >
                  Public form URL
                </div>
                <div class=${publicUrlStyle}>${publicUrl}</div>
              </div>
            `
          : null}
      </div>
    `;
  }

  private _renderSubmitSuccess(): TemplateResult {
    const formTitle = this.logic.view.formTitle$.value || 'Form';
    return html`
      <div class=${submitSuccessStyle}>
        <div class=${submitSuccessTitleStyle}>Thank you!</div>
        <div class=${submitSuccessDescStyle}>
          Your response to "${formTitle}" has been submitted.
        </div>
        <button
          class=${buttonStyle}
          style="margin-top:24px"
          @click=${() => {
            this.logic.submitted$.value = false;
            this.logic.fieldValues$.value = {};
            this.logic.fieldErrors$.value = {};
          }}
        >
          Submit another response
        </button>
      </div>
    `;
  }

  override render(): TemplateResult {
    const view = this.logic.view;
    const isPreview = this.logic.previewMode$.value;
    const isSettingsOpen = this.logic.settingsOpen$.value;
    const isSubmitted = this.logic.submitted$.value;
    const formTitle = view.formTitle$.value || 'Untitled Form';
    const columns = view.formColumns$.value;

    return html`
      <!-- Header -->
      <div class=${formHeaderStyle}>
        <div class=${formHeaderTitleStyle}>
          ${isPreview ? formTitle : 'Form Builder'}
        </div>
        <div class=${headerActionsStyle}>
          ${!isPreview
            ? html`
                <button
                  class=${`${buttonStyle}${isSettingsOpen ? ' ' + activeButtonStyle : ''}`}
                  @click=${this.logic.toggleSettings}
                >
                  Settings
                </button>
              `
            : null}
          <button
            class=${`${buttonStyle}${isPreview ? ' ' + activeButtonStyle : ''}`}
            @click=${this.logic.togglePreview}
          >
            ${isPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      <!-- Settings panel (builder mode only) -->
      ${!isPreview && isSettingsOpen ? this._renderSettings() : null}

      <!-- Form body -->
      <div class=${formBodyStyle}>
        ${isPreview
          ? isSubmitted
            ? this._renderSubmitSuccess()
            : html`
                <!-- Form meta in preview mode -->
                ${formTitle
                  ? html`<div style="margin-bottom:4px">
                      <input
                        type="text"
                        class=${formTitleInputStyle}
                        placeholder="Untitled Form"
                        readonly
                        .value=${formTitle}
                      />
                      ${view.formDescription$.value
                        ? html`<div
                            style="font-size:14px;color:var(--affine-text-secondary-color,#888);margin-bottom:8px"
                          >
                            ${view.formDescription$.value}
                          </div>`
                        : null}
                    </div>`
                  : null}
                <!-- Preview mode: actual inputs -->
                ${columns
                  .filter(col => !col.hide)
                  .map(col => this._renderPreviewField(col))}
                <!-- Submit button -->
                <button
                  class=${primaryButtonStyle}
                  @click=${this.logic._validateAndSubmit}
                  style="align-self:flex-start;padding:8px 24px"
                >
                  Submit
                </button>
              `
          : html`
              <!-- Builder mode: form title/description editors -->
              <div>
                <input
                  type="text"
                  class=${formTitleInputStyle}
                  placeholder="Untitled Form"
                  .value=${view.formTitle$.value}
                  @input=${(e: Event) =>
                    view.setFormTitle((e.target as HTMLInputElement).value)}
                />
                <textarea
                  class=${formDescriptionInputStyle}
                  placeholder="Add a description..."
                  rows="2"
                  .value=${view.formDescription$.value}
                  @input=${(e: Event) =>
                    view.setFormDescription(
                      (e.target as HTMLTextAreaElement).value
                    )}
                ></textarea>
              </div>
              <!-- Builder mode: draggable field cards -->
              ${columns.map(col => this._renderBuilderField(col))}
            `}
      </div>
    `;
  }
}
