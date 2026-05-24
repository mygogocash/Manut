export type LegalSection = {
  heading: string;
  paragraphs: readonly string[];
};

export type LegalPageContent = {
  title: string;
  description: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
};

export const privacySections = [
  {
    heading: '1. Information we collect',
    paragraphs: [
      'We collect account information such as your name, email address, authentication identifiers, workspace membership, and settings.',
      'We collect workspace content that you create, upload, import, or ask Manut to process. This may include documents, comments, attachments, meeting notes, and connected-app metadata.',
      'We collect operational data such as device type, browser, IP address, log data, crash reports, security events, and usage events needed to run, protect, and improve the Service.',
    ],
  },
  {
    heading: '2. How we use information',
    paragraphs: [
      'We use personal data to provide the Service, authenticate users, sync workspaces, support collaboration, operate AI features you request, prevent abuse, troubleshoot issues, and communicate service notices.',
      'We may use aggregated or de-identified data to understand product reliability and usage trends.',
    ],
  },
  {
    heading: '3. Google user data and OAuth scopes',
    paragraphs: [
      'When you choose to sign in with Google or connect a Google integration, Manut requests only the Google user data needed to provide the feature you selected. Google sign-in uses openid, email, and profile so we can authenticate you, show your account identity, and protect your workspace.',
      'Gmail import and AI Gmail search use https://www.googleapis.com/auth/gmail.readonly for read-only access to message metadata and message content that you explicitly ask Manut to search, summarize, or import into your workspace. Manut does not send email, modify email, delete email, or manage Gmail settings.',
      'Google Drive import uses https://www.googleapis.com/auth/drive.readonly for read-only access to file metadata and file content that you select for preview, search, or import. Manut does not create, modify, share, or delete files in your Google Drive.',
      'Google Calendar uses https://www.googleapis.com/auth/calendar.readonly for read-only access to calendars and events so Manut can show upcoming meetings beside your docs and let AI help prepare agendas. Manut does not create, modify, invite attendees to, or delete calendar events through this scope.',
      'OAuth tokens are stored encrypted and used only to call the Google APIs required for the connected feature. You can disconnect a Google integration in Manut settings or revoke Google access from your Google Account at any time.',
      'We do not sell Google user data, share it with advertisers, or use it for cross-context behavioral advertising. We do not use Google user data to train generalized AI models. We may process selected Google user data through AI providers only when you ask Manut to summarize, search, draft from, or import that data, and only to provide that requested feature.',
      'Manut use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.',
    ],
  },
  {
    heading: '4. Sharing and processors',
    paragraphs: [
      'We share personal data with service providers that help us host, secure, monitor, support, and operate Manut. These providers may process data only for our instructions and the Service purposes described in this policy.',
      'We may disclose information if required by law, to protect rights and safety, or as part of a merger, acquisition, financing, or sale of assets, subject to appropriate safeguards.',
    ],
  },
  {
    heading: '5. Security',
    paragraphs: [
      'We use technical and organizational safeguards such as encryption in transit, access controls, audit logging, and least-privilege operational access. No system is perfectly secure, but we work to protect workspace and account data against unauthorized access.',
    ],
  },
  {
    heading: '6. Retention and deletion',
    paragraphs: [
      'We keep your workspace content for as long as your account is active. After you delete your account, your workspace content and imported Google user data are deleted or anonymized within 30 days, with limited exceptions for legal retention obligations and disaster-recovery backups, which are purged within 90 days. Google user data imported into workspace content follows the same retention schedule unless you delete it sooner.',
    ],
  },
  {
    heading: '7. Your choices',
    paragraphs: [
      'You may access, correct, export, or delete workspace content in the Service. You may disconnect integrations, revoke OAuth access from the provider account, or contact us to request account deletion or privacy help.',
    ],
  },
  {
    heading: '8. Contact',
    paragraphs: [
      'For privacy questions or requests, contact GoGoCash at privacy@gogocash.co.',
    ],
  },
] satisfies readonly LegalSection[];

export const termsSections = [
  {
    heading: '1. Agreement',
    paragraphs: [
      'These Terms of Service form a binding agreement between you and GoGoCash, governing your access to and use of Manut at manut.xyz.',
      'By creating an account, accessing a workspace, or using the Service, you agree to these Terms. If you use Manut for an organization, you represent that you have authority to bind that organization.',
    ],
  },
  {
    heading: '2. Accounts and workspaces',
    paragraphs: [
      'You are responsible for your account credentials, workspace membership, permissions, and activity under your account. Keep account access secure and notify us if you suspect unauthorized use.',
      'Workspace owners and administrators control member access, connected apps, and workspace data. Users must follow the policies set by their workspace owner.',
    ],
  },
  {
    heading: '3. Acceptable use',
    paragraphs: [
      'You may not misuse the Service, interfere with its operation, attempt unauthorized access, upload malicious code, violate law, infringe rights, or use Manut to process data you do not have the right to use.',
      'We may suspend or restrict access to protect the Service, users, or third parties.',
    ],
  },
  {
    heading: '4. Your content',
    paragraphs: [
      'You retain ownership of content you submit to Manut. You grant us the limited rights needed to host, sync, display, process, back up, secure, and provide the Service and the features you request.',
      'You are responsible for ensuring that your content and connected-account data comply with applicable law and these Terms.',
    ],
  },
  {
    heading: '5. AI features',
    paragraphs: [
      'Manut may provide AI-assisted features such as search, summarization, drafting, organization, and workflow assistance. AI outputs may be incomplete or inaccurate, and you are responsible for reviewing outputs before relying on them.',
      'Do not use AI features for decisions that require professional judgment without appropriate human review.',
    ],
  },
  {
    heading: '6. Connected services',
    paragraphs: [
      'If you connect third-party services, you authorize Manut to access and process data from those services only as needed to provide the connected feature. Third-party service terms and privacy policies also apply.',
    ],
  },
  {
    heading: '7. Google OAuth integrations',
    paragraphs: [
      'Manut offers optional Google OAuth integrations for sign-in and for workspace features that use Gmail, Drive, and Calendar. You authorize only the Google scopes shown on the consent screen, and Manut uses Google user data only to provide the feature you selected.',
      'Google sign-in uses your Google profile and email to authenticate your account. Gmail, Drive, and Calendar integrations may read selected messages, files, calendars, and events so Manut can search, summarize, display, or import that information into your workspace at your request.',
      'You can disconnect Google integrations in Manut settings or revoke Manut access from your Google Account. Disconnecting an integration stops future API access but does not automatically delete workspace content you already imported; you can delete that content from your workspace.',
      'You are responsible for ensuring that you have the right to connect any Google account and import or process any Google user data through Manut.',
    ],
  },
  {
    heading: '8. Privacy',
    paragraphs: [
      'Our Privacy Policy explains how we collect, use, and protect personal data. By using the Service, you agree to the Privacy Policy.',
    ],
  },
  {
    heading: '9. Changes and termination',
    paragraphs: [
      'We may update the Service and these Terms from time to time. If changes are material, we will provide notice through the Service or another reasonable method.',
      'You may stop using Manut at any time. We may suspend or terminate access if you violate these Terms or create risk for the Service or other users.',
    ],
  },
  {
    heading: '10. Contact',
    paragraphs: [
      'For questions about these Terms, contact GoGoCash at legal@gogocash.co.',
    ],
  },
] satisfies readonly LegalSection[];

export const privacyContent: LegalPageContent = {
  title: 'Privacy Policy',
  description: 'How Manut handles personal data and Google user data.',
  lastUpdated: 'May 24, 2026',
  sections: privacySections,
};

export const termsContent: LegalPageContent = {
  title: 'Terms of Service',
  description: 'Terms for using Manut and its connected workspace features.',
  lastUpdated: 'May 24, 2026',
  sections: termsSections,
};
