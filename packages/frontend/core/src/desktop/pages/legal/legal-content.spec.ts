// @vitest-environment happy-dom

import { describe, expect, test } from 'vitest';

import { topLevelRoutes } from '../../router';
import { privacySections, termsSections } from './legal-content';

const routePaths = topLevelRoutes.flatMap(route =>
  route.children?.map(child => child.path).filter(Boolean)
);

const sectionText = (
  sections: readonly { heading: string; paragraphs: readonly string[] }[]
) =>
  sections
    .flatMap(section => [section.heading, ...section.paragraphs])
    .join('\n');

describe('legal pages for Google verification', () => {
  test('legal pages > given public Google verification links > then SPA routes privacy and terms before catch all', () => {
    expect(routePaths).toContain('/privacy');
    expect(routePaths).toContain('/terms');
    expect(routePaths.indexOf('/privacy')).toBeLessThan(
      routePaths.indexOf('*')
    );
    expect(routePaths.indexOf('/terms')).toBeLessThan(routePaths.indexOf('*'));
  });

  test('legal pages > given privacy page > then it discloses Google OAuth scopes and limited use', () => {
    const text = sectionText(privacySections);

    expect(text).toContain('Google user data');
    expect(text).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(text).toContain('https://www.googleapis.com/auth/drive.readonly');
    expect(text).toContain('https://www.googleapis.com/auth/calendar.readonly');
    expect(text).toContain('read-only access');
    expect(text).toContain('We do not sell Google user data');
    expect(text).toContain(
      'We do not use Google user data to train generalized AI models'
    );
    expect(text).toContain('revoke Google access');
    expect(text).toContain('deleted or anonymized within 30 days');
    expect(text).toContain('Limited Use requirements');
  });

  test('legal pages > given terms page > then it explains optional Google integrations and disconnect behavior', () => {
    const text = sectionText(termsSections);

    expect(text).toContain('Google OAuth integrations');
    expect(text).toContain('Google user data');
    expect(text).toContain('Gmail, Drive, and Calendar');
    expect(text).toContain('scopes shown on the consent screen');
    expect(text).toContain('disconnect Google integrations');
    expect(text).toContain('stops future API access');
  });
});
