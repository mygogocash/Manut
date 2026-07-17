"use client";

import { CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  declineSigning,
  getSigningRequest,
  type PublicSigningRequest,
  submitSigning,
} from "@/services/legal-public.service";

type Mode = "loading" | "ready" | "signed" | "declined" | "error";

export default function PublicSignPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [mode, setMode] = useState<Mode>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<PublicSigningRequest | null>(null);

  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    if (!token) {
      setMode("error");
      setErrorMessage("Missing signing token");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await getSigningRequest(token);
        if (cancelled) return;
        setData(res);
        if (res.signature.status === "signed") {
          setMode("signed");
        } else if (
          res.signature.status === "declined" ||
          res.signature.status === "cancelled"
        ) {
          setMode("declined");
        } else if (
          res.signature.expiresAt &&
          new Date(res.signature.expiresAt).getTime() < Date.now()
        ) {
          setMode("error");
          setErrorMessage("This signing link has expired.");
        } else {
          setMode("ready");
          setSignature(res.signature.signerName);
        }
      } catch (err) {
        if (cancelled) return;
        setMode("error");
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not load signing request",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSign() {
    if (!data) return;
    try {
      setSubmitting(true);
      const sig = await submitSigning(token, {
        signatureText: signature,
        agreed: true,
      });
      setData({ ...data, signature: { ...data.signature, ...sig } });
      setMode("signed");
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not submit signature",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    if (!data || !declineReason.trim()) return;
    try {
      setSubmitting(true);
      const sig = await declineSigning(token, declineReason.trim());
      setData({ ...data, signature: { ...data.signature, ...sig } });
      setMode("declined");
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not decline",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className={`
        bg-background text-foreground flex min-h-screen items-center
        justify-center px-4 py-10
      `}
    >
      <div
        className={`
          border-border bg-surface w-full max-w-xl rounded-lg border p-6
          shadow-sm
        `}
      >
        <header className="mb-4 flex items-center gap-2">
          <FileText className="text-primary size-5" />
          <span className="text-sm font-semibold tracking-wide">
            Intranet · Sign
          </span>
        </header>

        {mode === "loading" ? (
          <div
            className={`
              text-muted-foreground flex items-center justify-center gap-2 py-12
              text-xs
            `}
          >
            <Loader2 className="size-3.5 animate-spin" />
            Loading…
          </div>
        ) : null}

        {mode === "error" ? (
          <div className="flex flex-col gap-3 py-6 text-center">
            <XCircle className="text-destructive mx-auto size-8" />
            <h1 className="text-base font-semibold">
              Couldn&apos;t load this request
            </h1>
            <p className="text-muted-foreground text-xs">
              {errorMessage ?? "Unknown error"}
            </p>
          </div>
        ) : null}

        {mode === "signed" && data ? (
          <div className="flex flex-col gap-3 py-4 text-center">
            <CheckCircle2 className="text-success mx-auto size-8" />
            <h1 className="text-base font-semibold">Document signed</h1>
            <p className="text-muted-foreground text-xs">
              You signed &quot;{data.document.title}&quot; on{" "}
              {data.signature.signedAt
                ? new Date(data.signature.signedAt).toLocaleString()
                : "—"}
              .
            </p>
            <p className="text-muted-foreground text-[11px]">
              You can close this window.
            </p>
          </div>
        ) : null}

        {mode === "declined" && data ? (
          <div className="flex flex-col gap-3 py-4 text-center">
            <XCircle className="text-destructive mx-auto size-8" />
            <h1 className="text-base font-semibold">Request closed</h1>
            <p className="text-muted-foreground text-xs">
              {data.signature.status === "cancelled"
                ? "The sender cancelled this signing request."
                : "You declined to sign this document."}
            </p>
            {data.signature.declineReason ? (
              <p className="text-muted-foreground text-[11px]">
                Reason: {data.signature.declineReason}
              </p>
            ) : null}
          </div>
        ) : null}

        {mode === "ready" && data ? (
          <>
            <h1 className="mb-1 text-lg font-semibold">
              {data.document.title}
            </h1>
            <p
              className={`
                text-muted-foreground mb-4 text-xs tracking-wide uppercase
              `}
            >
              {data.document.kind}
            </p>

            {data.document.fileUrl ? (
              <a
                href={data.document.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  border-border bg-background mb-4 flex items-center gap-2
                  rounded-md border px-3 py-2 text-xs
                  hover:bg-muted
                `}
              >
                <FileText className="size-3.5" />
                <span className="truncate">
                  {data.document.fileName ?? "Open document"}
                </span>
              </a>
            ) : (
              <p className="text-muted-foreground mb-4 text-[11px]">
                No file attached. Refer to the email body for the document
                contents.
              </p>
            )}

            {data.signature.inviteMessage ? (
              <blockquote
                className={`
                  border-primary text-foreground mb-4 border-l-2 pl-3 text-xs
                  italic
                `}
              >
                {data.signature.inviteMessage}
              </blockquote>
            ) : null}

            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor="signer-name" className="text-xs">
                  Signer
                </Label>
                <Input
                  id="signer-name"
                  value={data.signature.signerName}
                  readOnly
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="signature-text" className="text-xs">
                  Type your full name to sign *
                </Label>
                <Input
                  id="signature-text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Full legal name"
                  className="mt-1"
                />
              </div>
              <label className="flex items-start gap-2 text-xs leading-snug">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(v === true)}
                  className="mt-0.5"
                />
                <span>
                  I agree the typed name above is my legal signature and that I
                  have reviewed the document linked here.
                </span>
              </label>

              {errorMessage ? (
                <p className="text-destructive text-[11px]">{errorMessage}</p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={
                    submitting ||
                    !agreed ||
                    signature.trim().length === 0 ||
                    signature.trim().toLowerCase() !==
                      data.signature.signerName.trim().toLowerCase()
                  }
                  onClick={() => void handleSign()}
                  className="min-w-32"
                >
                  {submitting && (
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                  )}
                  Sign
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDecline((v) => !v)}
                  disabled={submitting}
                >
                  Decline
                </Button>
              </div>

              <p className="text-muted-foreground text-[11px]">
                Type the name exactly as shown above to enable the Sign button.
              </p>

              {showDecline ? (
                <div
                  className={`
                    border-border mt-2 flex flex-col gap-2 rounded-md border p-3
                  `}
                >
                  <Label className="text-xs">Reason</Label>
                  <Textarea
                    rows={3}
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Tell the sender why you're declining…"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDecline(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={submitting || declineReason.trim().length === 0}
                      onClick={() => void handleDecline()}
                    >
                      {submitting && (
                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                      )}
                      Confirm decline
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
