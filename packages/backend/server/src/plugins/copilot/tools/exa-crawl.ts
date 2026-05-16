import Exa from 'exa-js';
import { z } from 'zod';

import { assertSsrFSafeUrl, Config } from '../../../base';
import { toolError } from './error';
import { defineTool } from './tool';

export const createExaCrawlTool = (config: Config) => {
  return defineTool({
    description: 'Crawl the web url for information',
    inputSchema: z.object({
      url: z
        .string()
        .describe('The URL to crawl (including http:// or https://)'),
    }),
    execute: async ({ url }) => {
      try {
        // SSRF preflight: reject private/reserved IP ranges (10/8,
        // 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7,
        // link-local, multicast) and localhost before the Exa SDK
        // makes any outbound request. Without this gate, an attacker
        // could ask the AI tool to crawl http://169.254.169.254/ or
        // http://localhost:5432 and exfiltrate internal services.
        try {
          await assertSsrFSafeUrl(url);
        } catch {
          throw new Error('URL rejected by SSRF policy');
        }

        const { key } = config.copilot.exa;
        const exa = new Exa(key);
        const result = await exa.getContents([url], {
          livecrawl: 'always',
          text: { maxCharacters: 100000 },
        });
        return result.results.map(data => ({
          title: data.title,
          url: data.url,
          content: data.text,
          favicon: data.favicon,
          publishedDate: data.publishedDate,
          author: data.author,
        }));
      } catch (e: any) {
        return toolError('Exa Crawl Failed', e.message);
      }
    },
  });
};
