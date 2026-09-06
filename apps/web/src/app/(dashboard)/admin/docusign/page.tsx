"use client";

import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type DocusignStatus,
  getDocusignConsentUrl,
  getDocusignStatus,
} from "@/services/legal.service";

export default function DocusignAdminPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("legal:sign-docusign-admin");

  if (!canManage) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        You don&apos;t have permission to manage the DocuSign integration.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="DocuSign integration"
        subtitle="Connect Manut to DocuSign for envelope sending"
      />

      <div className="flex flex-col gap-4">
        <AdminSection />
        <WebhookSection />
      </div>
    </div>
  );
}

function AdminSection() {
  const [status, setStatus] = useState<DocusignStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingConsent, setOpeningConsent] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getDocusignStatus();
      setStatus(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load status";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleOpenConsent() {
    try {
      setOpeningConsent(true);
      const res = await getDocusignConsentUrl();
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to build consent URL";
      toast.error(message);
    } finally {
      setOpeningConsent(false);
    }
  }

  return (
    <section
      className={`border-border bg-surface rounded-lg border p-4 shadow-sm`}
    >
      <h2 className="mb-1 text-sm font-semibold">
        Workspace integration (JWT-grant)
      </h2>
      <p className="text-muted-foreground mb-3 text-xs">
        Envelopes are sent on behalf of the configured impersonation user after
        an admin grants consent once.
      </p>
      {loading ? (
        <div
          className={`text-muted-foreground flex items-center gap-2 text-xs`}
        >
          <Loader2 className="size-3.5 animate-spin" />
          Checking…
        </div>
      ) : status ? (
        <ul className="flex flex-col gap-2 text-xs">
          <StatusRow
            label="Environment vars configured"
            ok={status.configured}
            detail={
              status.configured
                ? `Account ${status.accountId ?? "?"} on ${status.apiBase ?? "?"}`
                : "Set DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_RSA_PRIVATE_KEY, DOCUSIGN_AUTH_BASE_URL, DOCUSIGN_API_BASE_URL"
            }
          />
          <StatusRow
            label="Admin consent granted"
            ok={status.consentGranted}
            detail={
              status.consentGranted
                ? "JWT-grant exchange succeeds — envelopes can be created"
                : "Click 'Grant consent' below and approve the impersonation scope"
            }
          />
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">No status returned.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={handleOpenConsent}
          disabled={openingConsent || !status?.configured}
        >
          {openingConsent && <Loader2 className="mr-2 size-3.5 animate-spin" />}
          <ExternalLink className="size-3.5" />
          Grant consent
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void refresh()}
          disabled={loading}
        >
          Re-check status
        </Button>
      </div>
    </section>
  );
}

function WebhookSection() {
  return (
    <section
      className={`border-border bg-surface rounded-lg border p-4 shadow-sm`}
    >
      <h2 className="mb-2 text-sm font-semibold">Webhook</h2>
      <p className="text-muted-foreground text-xs">
        Point DocuSign Connect at:{" "}
        <code className="bg-muted rounded px-1.5 py-0.5 text-[11px]">
          {typeof window !== "undefined"
            ? `${window.location.origin}/api/legal-public/docusign/webhook`
            : "/api/legal-public/docusign/webhook"}
        </code>
      </p>
      <p className="text-muted-foreground mt-2 text-xs">
        Set the HMAC secret on the Connect listener and mirror it into{" "}
        <code className="bg-muted rounded px-1.5 py-0.5 text-[11px]">
          DOCUSIGN_HMAC_SECRET
        </code>
        . Required envelope events: <em>envelope-completed</em>,{" "}
        <em>envelope-declined</em>, <em>envelope-voided</em>,{" "}
        <em>recipient-completed</em>.
      </p>
    </section>
  );
}

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
      ) : (
        <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
      )}
      <div className="leading-snug">
        <p className="text-foreground font-medium">{label}</p>
        <p className="text-muted-foreground text-[11px]">{detail}</p>
      </div>
    </li>
  );
}
