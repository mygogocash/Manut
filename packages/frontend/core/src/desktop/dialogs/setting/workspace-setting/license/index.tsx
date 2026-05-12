// MANUT: this file used to render the FOSS-vs-Teams upgrade prompt and
// the "Selfhosted workspace - Seats N/10" card with "Upload license file" /
// "Use purchased key" buttons. The Manut fork removes the License tab
// from the settings sidebar entirely (see `../index.tsx`'s `showLicense`
// flag) and lifts the seat cap on the backend. This module is kept as a
// defensive fallback so any deep-link or stale code path that still routes
// to `'workspace:license'` lands on a friendly notice instead of upgrade
// nags. To restore upstream behavior, `git revert` the v1.10.1 commit and
// the original implementation will return.
import { SettingHeader } from '@affine/component/setting-components';
import { useI18n } from '@affine/i18n';

export const WorkspaceSettingLicense = ({
  onCloseSetting: _onCloseSetting,
}: {
  onCloseSetting: () => void;
}) => {
  const t = useI18n();

  return (
    <>
      <SettingHeader
        title={t['com.affine.settings.workspace.license']()}
        subtitle="Manut self-hosted edition"
      />
      <div
        style={{
          padding: '16px 20px',
          borderRadius: '8px',
          border: '1px solid var(--affine-border-color)',
          backgroundColor: 'var(--affine-background-secondary-color)',
          fontSize: '14px',
          lineHeight: '20px',
          color: 'var(--affine-text-primary-color)',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>
          All features enabled - Manut self-hosted
        </p>
        <p style={{ marginTop: '8px', marginBottom: 0 }}>
          This is the Manut fork of AFFiNE. There are no seat limits and no
          license required. Invite as many members as you need.
        </p>
      </div>
    </>
  );
};
