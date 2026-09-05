---
type: Playbook
title: Signed-URL downloads
description: For files in the private `documents` Supabase bucket, expose a download route that re-checks ownership and returns a short-lived signed URL instead of the raw file URL.
tags: [backend, storage, security]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Signed-URL downloads

Used by `hrms agreements`.

## Shape

The `documents` Supabase bucket is **private** (only `article` / `avatars` /
`blog` / `uploads` are public). For any download in `documents`, expose a `GET
/<resource>/:id/download` route that re-checks ownership, parses the stored
URL via `parseStorageUrl`, and returns a 5-minute signed URL. Never link the
raw `fileUrl` from the client.

## Reference

`hrms agreements`; `parseStorageUrl`.
