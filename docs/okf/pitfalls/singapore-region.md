---
type: Pitfall
title: Singapore region
description: Supabase runs in `aws-1-ap-southeast-1`, so GitHub Actions runners (usually US) reach it over the shared pooler and can hit transient P1001s.
tags: [infra, database]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Singapore region

## Rule

Supabase is `aws-1-ap-southeast-1`. GitHub Actions runners are usually
US — connection works on the shared pooler (port 6543 transaction, port 5432
session/direct).

## Why

Expect occasional P1001s during transient pooler reboots.
