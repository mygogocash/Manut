import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

const files = {
  privacy: readFileSync(join(root, 'app/privacy-policy/page.tsx'), 'utf8'),
  terms: readFileSync(join(root, 'app/terms-of-service/page.tsx'), 'utf8'),
};

const required = {
  privacy: [
    'Google user data',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'read-only access',
    'We do not sell Google user data',
    'We do not use Google user data to train generalized AI models',
    'revoke Google access',
    'deleted or anonymized within 30 days',
  ],
  terms: [
    'Google OAuth integrations',
    'Google user data',
    'You authorize only the Google scopes shown on the consent screen',
    'Gmail, Drive, and Calendar',
    'You can disconnect Google integrations',
  ],
};

let failed = false;

for (const [file, snippets] of Object.entries(required)) {
  for (const snippet of snippets) {
    if (!files[file].includes(snippet)) {
      failed = true;
      console.error(`${file} missing required Google disclosure: ${snippet}`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('Google verification legal disclosures are present.');
