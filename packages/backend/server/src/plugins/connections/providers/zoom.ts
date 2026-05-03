import { OAuthProvider, OAuthTokens, UserInfo } from './base.js';

export class ZoomProvider extends OAuthProvider {
  name = 'zoom';
  displayName = 'Zoom';
  scopes = ['user:read', 'recording:read'];

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const clientId = process.env.ZOOM_CLIENT_ID ?? '';
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state });
    return `https://zoom.us/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.ZOOM_CLIENT_ID ?? '';
    const clientSecret = process.env.ZOOM_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) throw new Error('Zoom requires ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    const data = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope: string };
    return { accessToken: data.access_token, refreshToken: data.refresh_token, scopes: data.scope.split(' ') };
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch('https://api.zoom.us/v2/users/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    const user = await response.json() as { id: string; display_name: string; email: string; pic_url?: string };
    return { externalId: user.id, displayName: user.display_name, email: user.email, avatarUrl: user.pic_url };
  }

  async listMeetings(accessToken: string): Promise<{ id: string; topic: string; startTime: string; joinUrl: string }[]> {
    interface ZoomMeeting { id: number; uuid: string; topic: string; start_time: string; duration: number; join_url: string }
    const response = await fetch('https://api.zoom.us/v2/users/me/meetings?type=scheduled', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { meetings } = await response.json() as { meetings: ZoomMeeting[] };
    return meetings.map(m => ({ id: String(m.id), topic: m.topic, startTime: m.start_time, joinUrl: m.join_url }));
  }

  async listRecordings(accessToken: string): Promise<{ id: string; topic: string; startTime: string; downloadUrl: string }[]> {
    interface ZoomRecordingFile { file_type: string; download_url: string }
    interface ZoomRecordingMeeting { id: string; topic: string; start_time: string; recording_files: ZoomRecordingFile[] }
    const response = await fetch('https://api.zoom.us/v2/users/me/recordings?page_size=30', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { meetings } = await response.json() as { meetings: ZoomRecordingMeeting[] };
    return meetings.flatMap(m =>
      m.recording_files.map(f => ({ id: m.id, topic: m.topic, startTime: m.start_time, downloadUrl: f.download_url }))
    );
  }
}
