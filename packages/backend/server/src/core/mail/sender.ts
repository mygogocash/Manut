import { Injectable, Logger } from '@nestjs/common';
import {
  createTestAccount,
  createTransport,
  getTestMessageUrl,
  SendMailOptions,
  Transporter,
} from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

import { Config, metrics, OnEvent } from '../../base';
import { resolveSMTPHeloHostname } from './utils';

export type SendOptions = Omit<SendMailOptions, 'to' | 'subject' | 'html'> & {
  to: string;
  subject: string;
  html: string;
};

type MailAttachment = NonNullable<SendOptions['attachments']>[number];
type ResendAttachment = {
  content?: string;
  contentId?: string;
  contentType?: string;
  filename?: string;
  path?: string;
};

function attachmentContentToBase64(attachment: MailAttachment) {
  const { content } = attachment;

  if (content === undefined || content === null) {
    return undefined;
  }

  if (Buffer.isBuffer(content)) {
    return content.toString('base64');
  }

  if (content instanceof Uint8Array) {
    return Buffer.from(content).toString('base64');
  }

  if (typeof content === 'string') {
    if (attachment.encoding?.toLowerCase() === 'base64') {
      return content;
    }

    const encoding =
      attachment.encoding && Buffer.isEncoding(attachment.encoding)
        ? attachment.encoding
        : 'utf8';
    return Buffer.from(content, encoding).toString('base64');
  }

  return null;
}

function toResendAttachment(attachment: MailAttachment) {
  const resendAttachment: ResendAttachment = {};

  if (typeof attachment.filename === 'string') {
    resendAttachment.filename = attachment.filename;
  }

  if (typeof attachment.contentType === 'string') {
    resendAttachment.contentType = attachment.contentType;
  }

  if (typeof attachment.cid === 'string') {
    resendAttachment.contentId = attachment.cid;
  }

  if (typeof attachment.path === 'string') {
    resendAttachment.path = attachment.path;
    return resendAttachment;
  }

  const content = attachmentContentToBase64(attachment);
  if (content === null) {
    return null;
  }
  if (content !== undefined) {
    resendAttachment.content = content;
    return resendAttachment;
  }

  return null;
}

function configToSMTPOptions(
  config: AppConfig['mailer']['SMTP']
): SMTPTransport.Options {
  const name = resolveSMTPHeloHostname(config.name);

  return {
    ...(name ? { name } : {}),
    host: config.host,
    port: config.port,
    tls: {
      rejectUnauthorized: !config.ignoreTLS,
    },
    auth: {
      user: config.username,
      pass: config.password,
    },
  };
}

@Injectable()
export class MailSender {
  private readonly logger = new Logger(MailSender.name);
  private smtp: Transporter<SMTPTransport.SentMessageInfo> | null = null;
  private fallbackSMTP: Transporter<SMTPTransport.SentMessageInfo> | null =
    null;
  private usingTestAccount = false;
  constructor(private readonly config: Config) {}

  static create(config: Config['mailer']['SMTP']) {
    return createTransport(configToSMTPOptions(config));
  }

  get configured() {
    const mail = this.config.mailer;
    const useResend =
      (mail.provider ?? 'smtp').toLowerCase() === 'resend' &&
      Boolean(mail.resend?.apiKey);
    // NOTE: testing environment will use mock queue, so we need to return true
    return this.smtp !== null || useResend || env.testing;
  }

  @OnEvent('config.init')
  onConfigInit() {
    this.setup();
  }

  @OnEvent('config.changed')
  onConfigChanged(event: Events['config.changed']) {
    if ('mailer' in event.updates) {
      this.setup();
    }
  }

  private setup() {
    const mail = this.config.mailer;
    const { SMTP, fallbackDomains, fallbackSMTP } = mail;
    const opts = configToSMTPOptions(SMTP);

    if (
      (mail.provider ?? 'smtp').toLowerCase() === 'resend' &&
      mail.resend?.apiKey
    ) {
      this.smtp = null;
      this.fallbackSMTP = null;
      this.logger.log('Mailer using Resend API (MAIL_PROVIDER=resend).');
      return;
    }

    if (SMTP.host) {
      this.smtp = createTransport(opts);
      if (fallbackDomains.length > 0 && fallbackSMTP?.host) {
        this.logger.warn(
          `Fallback SMTP is configured for domains: ${fallbackDomains.join(', ')}`
        );
        this.fallbackSMTP = createTransport(configToSMTPOptions(fallbackSMTP));
      }
    } else if (env.dev) {
      createTestAccount((err, account) => {
        if (!err) {
          this.smtp = createTransport({
            ...opts,
            ...account.smtp,
            auth: {
              user: account.user,
              pass: account.pass,
            },
          });
          this.usingTestAccount = true;
        }
      });
    } else {
      this.logger.warn('Mailer SMTP transport is not configured.');
      this.smtp = null;
      this.fallbackSMTP = null;
    }
  }

  private getSender(domain: string) {
    const { SMTP, fallbackSMTP, fallbackDomains } = this.config.mailer;
    if (this.fallbackSMTP && fallbackDomains.includes(domain)) {
      return [this.fallbackSMTP, fallbackSMTP.sender] as const;
    }
    return [this.smtp, SMTP.sender] as const;
  }

  async send(name: string, options: SendOptions) {
    const mail = this.config.mailer;
    if (
      (mail.provider ?? 'smtp').toLowerCase() === 'resend' &&
      mail.resend?.apiKey
    ) {
      const from = mail.resend.from?.trim() || mail.SMTP.sender?.trim();
      if (!from) {
        metrics.mail.counter('failed_total').add(1, { name });
        this.logger.error(
          'Resend mail provider is configured, but no sender address is set.'
        );
        return false;
      }
      return this.sendViaResend(name, from, options, mail.resend.apiKey);
    }

    const [, domain, ...rest] = options.to.split('@');
    if (rest.length || !domain) {
      this.logger.error(`Invalid email address: ${options.to}`);
      return null;
    }

    const [smtpClient, from] = this.getSender(domain);
    if (!smtpClient) {
      this.logger.warn(`Mailer SMTP transport is not configured to send mail.`);
      return null;
    }

    metrics.mail.counter('send_total').add(1, { name });
    try {
      const result = await smtpClient.sendMail({ from, ...options });

      if (result.rejected.length > 0) {
        metrics.mail.counter('rejected_total').add(1, { name });
        this.logger.error(
          `Mail [${name}] rejected with response: ${result.response}`
        );
        return false;
      }

      metrics.mail.counter('accepted_total').add(1, { name });
      this.logger.debug(`Mail [${name}] sent successfully.`);
      if (this.usingTestAccount) {
        this.logger.debug(
          `  ⚙️ Mail preview url: ${getTestMessageUrl(result)}`
        );
      }

      return true;
    } catch (e) {
      metrics.mail.counter('failed_total').add(1, { name });
      this.logger.error(`Failed to send mail [${name}].`, e);
      return false;
    }
  }

  private async sendViaResend(
    name: string,
    from: string,
    options: SendOptions,
    apiKey: string
  ): Promise<boolean | null> {
    metrics.mail.counter('send_total').add(1, { name });
    let attachments: ResendAttachment[] | undefined;

    if (options.attachments?.length) {
      const converted = options.attachments.map(toResendAttachment);
      if (converted.some(attachment => attachment === null)) {
        metrics.mail.counter('failed_total').add(1, { name });
        this.logger.error(
          `Resend mail [${name}] has unsupported attachment content.`
        );
        return false;
      }
      attachments = converted as ResendAttachment[];
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          ...(attachments?.length ? { attachments } : {}),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(
          `Resend mail [${name}] failed: HTTP ${res.status} ${text.slice(0, 500)}`
        );
        metrics.mail.counter('failed_total').add(1, { name });
        return false;
      }
      metrics.mail.counter('accepted_total').add(1, { name });
      this.logger.debug(`Mail [${name}] sent successfully via Resend.`);
      return true;
    } catch (e) {
      metrics.mail.counter('failed_total').add(1, { name });
      this.logger.error(`Failed to send mail [${name}] via Resend.`, e);
      return false;
    }
  }
}
