import z from 'zod';

import { defineModuleConfig } from '../../base';

declare global {
  interface AppConfigSchema {
    mailer: {
      SMTP: {
        name: string;
        host: string;
        port: number;
        username: string;
        password: string;
        ignoreTLS: boolean;
        sender: string;
      };

      fallbackDomains: ConfigItem<string[]>;
      fallbackSMTP: {
        name: string;
        host: string;
        port: number;
        username: string;
        password: string;
        ignoreTLS: boolean;
        sender: string;
      };

      /** `smtp` (default) or `resend` */
      provider: string;
      resend: {
        apiKey: string;
        from: string;
      };
    };
  }
}

defineModuleConfig('mailer', {
  'SMTP.name': {
    desc: 'Hostname used for SMTP HELO/EHLO (e.g. mail.example.com). Leave empty to use the system hostname.',
    default: '',
    env: 'MAILER_SERVERNAME',
  },
  'SMTP.host': {
    desc: 'Host of the email server (e.g. smtp.gmail.com)',
    default: '',
    env: 'MAILER_HOST',
  },
  'SMTP.port': {
    desc: 'Port of the email server (they commonly are 25, 465 or 587)',
    default: 465,
    env: ['MAILER_PORT', 'integer'],
  },
  'SMTP.username': {
    desc: 'Username used to authenticate the email server',
    default: '',
    env: 'MAILER_USER',
  },
  'SMTP.password': {
    desc: 'Password used to authenticate the email server',
    default: '',
    env: 'MAILER_PASSWORD',
  },
  'SMTP.sender': {
    desc: 'Sender of all the emails (e.g. "AFFiNE Self Hosted &lt;noreply@example.com&gt;")',
    default: 'AFFiNE Self Hosted <noreply@example.com>',
    env: 'MAILER_SENDER',
  },
  'SMTP.ignoreTLS': {
    desc: "Whether ignore email server's TLS certificate verification. Enable it for self-signed certificates.",
    default: false,
    env: ['MAILER_IGNORE_TLS', 'boolean'],
  },

  fallbackDomains: {
    desc: 'The emails from these domains are always sent using the fallback SMTP server.',
    default: [],
    shape: z.array(z.string()),
  },
  'fallbackSMTP.name': {
    desc: 'Hostname used for fallback SMTP HELO/EHLO (e.g. mail.example.com). Leave empty to use the system hostname.',
    default: '',
  },
  'fallbackSMTP.host': {
    desc: 'Host of the email server (e.g. smtp.gmail.com)',
    default: '',
  },
  'fallbackSMTP.port': {
    desc: 'Port of the email server (they commonly are 25, 465 or 587)',
    default: 465,
  },
  'fallbackSMTP.username': {
    desc: 'Username used to authenticate the email server',
    default: '',
  },
  'fallbackSMTP.password': {
    desc: 'Password used to authenticate the email server',
    default: '',
  },
  'fallbackSMTP.sender': {
    desc: 'Sender of all the emails (e.g. "AFFiNE Self Hosted &lt;noreply@example.com&gt;")',
    default: '',
  },
  'fallbackSMTP.ignoreTLS': {
    desc: "Whether ignore email server's TLS certificate verification. Enable it for self-signed certificates.",
    default: false,
  },

  provider: {
    desc: 'Mail transport: `smtp` (default) or `resend`.',
    default: 'smtp',
    env: 'MAIL_PROVIDER',
  },
  'resend.apiKey': {
    desc: 'Resend API key when MAIL_PROVIDER=resend. Never commit this value.',
    default: '',
    env: 'RESEND_API_KEY',
  },
  'resend.from': {
    desc: 'Verified sender for Resend. Falls back to MAILER_SENDER if empty.',
    default: '',
    env: 'RESEND_FROM',
  },
});
