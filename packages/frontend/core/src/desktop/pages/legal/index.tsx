import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

import type { LegalPageContent } from './legal-content';
import { privacyContent, termsContent } from './legal-content';
import * as styles from './styles.css';

const useLegalContent = (): LegalPageContent => {
  const location = useLocation();

  return useMemo(() => {
    if (location.pathname.endsWith('/terms')) {
      return termsContent;
    }
    return privacyContent;
  }, [location.pathname]);
};

export const ManutLegalPage = () => {
  const content = useLegalContent();
  const alternate = content === privacyContent ? termsContent : privacyContent;
  const alternatePath = content === privacyContent ? '/terms' : '/privacy';

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${content.title} - Manut`;
    return () => {
      document.title = previousTitle;
    };
  }, [content.title]);

  return (
    <main className={styles.root} data-testid="manut-legal-page">
      <article className={styles.shell}>
        <a className={styles.backLink} href="/">
          Back to Manut
        </a>
        <p className={styles.eyebrow}>Last updated {content.lastUpdated}</p>
        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.description}>{content.description}</p>
        <nav className={styles.nav} aria-label="Legal pages">
          <Link className={styles.navLink} to={alternatePath}>
            {alternate.title}
          </Link>
          <a className={styles.navLink} href="mailto:legal@gogocash.co">
            Contact legal
          </a>
        </nav>
        <div className={styles.content}>
          {content.sections.map(section => (
            <section className={styles.section} key={section.heading}>
              <h2 className={styles.sectionHeading}>{section.heading}</h2>
              {section.paragraphs.map(paragraph => (
                <p className={styles.paragraph} key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
};

export const Component = () => {
  return <ManutLegalPage />;
};
