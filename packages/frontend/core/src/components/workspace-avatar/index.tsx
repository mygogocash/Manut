import { Avatar, type AvatarProps } from '@affine/component';
import {
  type WorkspaceMetadata,
  WorkspacesService,
} from '@affine/core/modules/workspace';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useLayoutEffect, useState } from 'react';

const cache = new Map<string, { imageBitmap: ImageBitmap; key: string }>();

// Tracks (workspaceId:avatarKey) pairs we have already reported as failing,
// so a blob that stays unavailable does not flood the log every time this
// avatar component re-mounts on a different surface.
const reportedAvatarFailures = new Set<string>();

/**
 * workspace avatar component with automatic cache, and avoid flashing
 */
export const WorkspaceAvatar = ({
  meta,
  ...otherProps
}: { meta: WorkspaceMetadata } & AvatarProps) => {
  const workspacesService = useService(WorkspacesService);

  const profile = workspacesService.getProfile(meta);

  useEffect(() => {
    profile.revalidate();
  }, [meta, profile]);

  const avatarKey = useLiveData(profile.profile$.map(v => v?.avatar));

  const [downloadedAvatar, setDownloadedAvatar] = useState<
    { imageBitmap: ImageBitmap; key: string } | undefined
  >(cache.get(meta.id));

  useLayoutEffect(() => {
    if (!avatarKey || !meta) {
      setDownloadedAvatar(undefined);
      return;
    }

    let canceled = false;
    workspacesService
      .getWorkspaceBlob(meta, avatarKey)
      .then(async blob => {
        if (canceled) {
          return;
        }
        if (!blob) {
          // The avatar key is set in workspace meta, but the underlying
          // content-addressed blob could not be retrieved from local or
          // cloud storage (e.g. the upload never finished syncing, or the
          // cloud GET 404s on another device). This is NOT the same as
          // "no avatar configured" (avatarKey falsy, handled above) — it
          // is a real failure that would otherwise silently fall back to
          // the colored placeholder. Surface it instead of swallowing.
          throw new Error(
            `workspace avatar blob unavailable (workspace=${meta.id}, key=${avatarKey})`
          );
        }
        const image = document.createElement('img');
        const objectUrl = URL.createObjectURL(blob);
        image.src = objectUrl;
        await image.decode();
        // limit the size of the image data to reduce memory usage
        const hRatio = 128 / image.naturalWidth;
        const vRatio = 128 / image.naturalHeight;
        const ratio = Math.min(hRatio, vRatio);
        const imageBitmap = await createImageBitmap(image, {
          resizeWidth: image.naturalWidth * ratio,
          resizeHeight: image.naturalHeight * ratio,
        });
        URL.revokeObjectURL(objectUrl);
        setDownloadedAvatar(prev => {
          if (prev?.key === avatarKey) {
            return prev;
          }
          return { imageBitmap, key: avatarKey };
        });
        cache.set(meta.id, {
          imageBitmap,
          key: avatarKey,
        });
      })
      .catch(err => {
        // Deduplicate per (workspace, key) so a component rendered across
        // many surfaces (sidebar, cmdk, settings) does not spam the log on
        // every mount while the blob stays unavailable.
        const failureKey = `${meta.id}:${avatarKey}`;
        if (reportedAvatarFailures.has(failureKey)) {
          return;
        }
        reportedAvatarFailures.add(failureKey);
        console.error('get workspace blob error: ' + err);
      });

    return () => {
      canceled = true;
    };
  }, [meta, workspacesService, avatarKey]);

  return <Avatar image={downloadedAvatar?.imageBitmap} {...otherProps} />;
};
