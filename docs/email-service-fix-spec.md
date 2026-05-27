# Email Service Fix Spec

## Goal

Make the production Resend mail transport handle the same message shapes that
the app already queues for SMTP, including inline workspace-avatar attachments
used by invitation emails.

## Scope In

- Verify the live mail configuration and recent production logs.
- Patch the Resend transport path in `MailSender`.
- Add focused coverage for Resend attachment payload conversion.
- Run the relevant mail tests and lint checks.

## Scope Out

- Sending a real email to a user without an explicit recipient.
- Changing SMTP behavior.
- Adding provider delivery-receipt ingestion.

## Intended Behavior

- `MAIL_PROVIDER=resend` should send regular HTML emails.
- Attachment-free emails should keep their existing payload.
- Inline attachments with Nodemailer `cid` should be sent to Resend with
  Base64 `content`, `filename`, and `contentId`.
- Unsupported attachment content should fail explicitly instead of being
  silently dropped.

## Verification

- Unit test for Resend attachment payload conversion.
- Existing mail renderer test.
- Focused ESLint and Prettier checks.
- Production config/log read-only verification.

## Risk

R2. This is limited to the Resend transport serialization path and can be
reverted independently.

## Rollback

Revert the mail transport commit and redeploy the previous Cloud Run revision.
