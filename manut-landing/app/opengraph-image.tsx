import { ImageResponse } from 'next/og';

import { siteConfig } from '@/lib/site';

export const alt = siteConfig.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        background: 'linear-gradient(135deg, #fafaf2 0%, #f3efe6 100%)',
        fontFamily: 'Inter, sans-serif',
        color: '#101013',
        position: 'relative',
      }}
    >
      {/* Lime swatch */}
      <div
        style={{
          position: 'absolute',
          top: 72,
          right: 72,
          width: 120,
          height: 120,
          background: '#bef264',
          borderRadius: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 64,
          fontWeight: 700,
          color: '#101013',
        }}
      >
        S
      </div>

      {/* Top kicker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 22,
          letterSpacing: 4,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          color: '#5b5b62',
        }}
      >
        <div style={{ width: 40, height: 2, background: '#5b5b62' }} />
        {siteConfig.name}
      </div>

      {/* Title */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          maxWidth: 880,
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.02,
            display: 'flex',
            flexWrap: 'wrap',
          }}
        >
          The workspace that
          <span
            style={{
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              marginLeft: 16,
              fontWeight: 400,
            }}
          >
            thinks
          </span>
          <span style={{ marginLeft: 16 }}>with you.</span>
        </div>
        <div
          style={{
            fontSize: 30,
            color: '#3a3a40',
            maxWidth: 820,
            lineHeight: 1.4,
          }}
        >
          Docs, databases, whiteboards, and a true AI agent. Built for teams who
          ship fast.
        </div>
      </div>

      {/* Bottom row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 22,
          color: '#3a3a40',
        }}
      >
        <div style={{ display: 'flex', gap: 32 }}>
          <span>AI agent</span>
          <span>Multi-model</span>
          <span>Real-time</span>
        </div>
        <div style={{ fontFamily: 'monospace', color: '#5b5b62' }}>
          {siteConfig.domain}
        </div>
      </div>
    </div>,
    { ...size }
  );
}
