import { Injectable } from '@nestjs/common';

import { GoogleOAuthService } from './google-oauth.service';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_FILE_FIELDS =
  'files(id,name,mimeType,iconLink,webViewLink,modifiedTime,size)';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  modifiedTime?: string;
  /**
   * Size in bytes, as a stringified integer per the Drive v3 API.
   * Folders / Google-native docs (Docs / Sheets / Slides) don't have a
   * size and Drive omits the field — we propagate `null` rather than
   * coercing to 0 so the UI can show "—".
   */
  size?: string | null;
}

interface DriveListResponse {
  files?: {
    id?: string;
    name?: string;
    mimeType?: string;
    iconLink?: string;
    webViewLink?: string;
    modifiedTime?: string;
    size?: string;
  }[];
  nextPageToken?: string;
}

/**
 * Live Drive integration for v1.10.2.
 *
 * Scope is intentionally narrow: list files. We do NOT auto-import file
 * content because Drive serves a zoo of MIME types (PDF, Google Docs,
 * Sheets, images, native Office formats) — each needs its own renderer
 * and the right UX is "let the user paste a Drive link into a doc",
 * which both works today and renders nicely in AFFiNE's link previews.
 *
 * Token refresh + error model lives in
 * {@link GoogleOAuthService.getValidAccessToken}.
 */
@Injectable()
export class DriveService {
  constructor(private readonly oauth: GoogleOAuthService) {}

  async listFiles(
    userId: string,
    workspaceId: string,
    query: string | undefined,
    pageSize: number
  ): Promise<DriveFile[]> {
    const accessToken = await this.oauth.getValidAccessToken(
      userId,
      workspaceId,
      'drive'
    );

    const params = new URLSearchParams({
      pageSize: String(Math.max(1, Math.min(pageSize, 100))),
      fields: DRIVE_FILE_FIELDS,
      // Exclude trashed files — users almost never want them in a picker.
      q: this.buildDriveQuery(query),
      orderBy: 'modifiedTime desc',
    });

    const response = await fetch(
      `${DRIVE_API_BASE}/files?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Drive API ${response.status}: ${text.slice(0, 200)}`);
    }
    const data = (await response.json()) as DriveListResponse;
    const files = data.files ?? [];

    return files
      .filter(
        (f): f is { id: string; name: string; mimeType: string } & typeof f =>
          Boolean(f.id) && Boolean(f.name)
      )
      .map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType ?? 'application/octet-stream',
        iconLink: f.iconLink,
        webViewLink: f.webViewLink,
        modifiedTime: f.modifiedTime,
        size: f.size ?? null,
      }));
  }

  /**
   * Build the Drive `q` parameter. We always exclude trashed items.
   * If the user typed a search term, we add a name match — Drive's `q`
   * grammar uses `name contains 'foo'` and only matches whole tokens,
   * which is fine for a UI search box.
   *
   * Single quotes in user input must be backslash-escaped per the Drive
   * query reference; double quotes don't need escaping since we wrap in
   * single quotes.
   */
  private buildDriveQuery(query: string | undefined): string {
    const base = 'trashed = false';
    const trimmed = query?.trim();
    if (!trimmed) return base;
    const escaped = trimmed.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `${base} and name contains '${escaped}'`;
  }
}
