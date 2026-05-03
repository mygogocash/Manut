import { Button, IconButton, Input } from '@affine/component';
import { CloseIcon, LinkIcon } from '@blocksuite/icons/rc';
import { type FC, useCallback, useState } from 'react';

import * as styles from './links.css';

export interface AgentLink {
  id: string;
  url: string;
  label?: string;
}

export interface LinksSectionProps {
  links: AgentLink[];
  onAdd: (url: string, label?: string) => void;
  onRemove: (linkId: string) => void;
  disabled?: boolean;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const LinksSection: FC<LinksSectionProps> = ({
  links,
  onAdd,
  onRemove,
  disabled,
}) => {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('URL is required');
      return;
    }
    if (!isValidHttpUrl(trimmed)) {
      setError('Enter a valid http or https URL');
      return;
    }
    setError(null);
    onAdd(trimmed, label.trim() || undefined);
    setUrl('');
    setLabel('');
  }, [url, label, onAdd]);

  return (
    <section className={styles.section} aria-labelledby="agent-links-heading">
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <LinkIcon />
        </span>
        <h3 id="agent-links-heading" className={styles.sectionTitle}>
          Links
        </h3>
      </div>
      <p className={styles.sectionDescription}>
        Add websites that Computer should prioritize when running tasks.
      </p>

      {links.length > 0 ? (
        <ul className={styles.list}>
          {links.map(link => (
            <li key={link.id} className={styles.item}>
              <span className={styles.itemIcon} aria-hidden="true">
                <LinkIcon />
              </span>
              <div className={styles.itemContent}>
                <span className={styles.itemLabel}>
                  {link.label ?? link.url}
                </span>
                {link.label ? (
                  <span className={styles.itemUrl}>{link.url}</span>
                ) : null}
              </div>
              <IconButton
                size="20"
                icon={<CloseIcon />}
                onClick={() => onRemove(link.id)}
                disabled={disabled}
                aria-label={`Remove ${link.label ?? link.url}`}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.addRow}>
        <div className={styles.addInputs}>
          <Input
            placeholder="https://example.com"
            value={url}
            onChange={value => setUrl(value)}
            onEnter={handleAdd}
            disabled={disabled}
            aria-label="Link URL"
          />
          <Input
            placeholder="Label (optional)"
            value={label}
            onChange={value => setLabel(value)}
            onEnter={handleAdd}
            disabled={disabled}
            aria-label="Link label"
          />
          <Button onClick={handleAdd} disabled={disabled || !url.trim()}>
            Add
          </Button>
        </div>
        {error ? <span className={styles.addError}>{error}</span> : null}
      </div>
    </section>
  );
};
