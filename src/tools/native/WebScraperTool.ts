import { BaseTool } from '../BaseTool.js';
import { chromium, Browser, BrowserContext } from 'playwright';

/**
 * Web scraping tool using Playwright
 */
export class WebScraperTool extends BaseTool {
  constructor(config: any = {}) {
    super(
      'web_scraper',
      'Web scraping tool for extracting data from websites using Playwright',
      config
    );
  }

  /**
   * Execute web scraping
   */
  async execute(parameters: any): Promise<any> {
    if (!this.validate(parameters)) {
      return this.createResult(false, null, 'Invalid parameters');
    }

    const { url, selectors, options = {} } = parameters;
    
    const browser = await chromium.launch({
      headless: options.headless !== false,
      timeout: options.timeout || 30000
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: options.timeout || 30000 
      });

      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
      }

      const data = await this.extractData(page, selectors);

      let screenshot = null;
      if (options.takeScreenshot) {
        screenshot = await page.screenshot({ 
          fullPage: options.fullPageScreenshot !== false 
        });
      }

      const result = {
        url,
        data,
        screenshot: screenshot?.toString('base64') || null,
        title: await page.title(),
        url_final: page.url()
      };

      return this.createResult(true, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.createResult(false, null, message);
    } finally {
      await context.close();
      await browser.close();
    }
  }

  /**
   * Validate input parameters
   */
  validate(parameters: any): boolean {
    return !!(parameters.url && parameters.selectors && 
              typeof parameters.url === 'string' &&
              typeof parameters.selectors === 'object');
  }

  /**
   * Extract data from page using selectors
   */
  private async extractData(page: any, selectors: any): Promise<any> {
    const data: any = {};
    
    for (const [key, selector] of Object.entries(selectors)) {
      try {
        if (typeof selector === 'string') {
          const elements = await page.$$(selector);
          if (elements.length === 1) {
            data[key] = await elements[0].textContent() || '';
          } else {
            data[key] = await Promise.all(
              elements.map((el: any) => el.textContent() || '')
            );
          }
        } else {
          const { css, attribute = 'textContent', transform } = selector as any;
          const elements = await page.$$(css);
          
          if (elements.length === 1) {
            const text = await this.getElementText(elements[0], attribute);
            data[key] = transform ? this.applyTransform(text, transform) : text;
          } else {
            const texts = await Promise.all(
              elements.map((el: any) => this.getElementText(el, attribute))
            );
            data[key] = transform 
              ? texts.map(t => this.applyTransform(t, transform)) 
              : texts;
          }
        }
      } catch {
        data[key] = null;
      }
    }
    
    return data;
  }

  private async getElementText(element: any, attribute: string): Promise<string> {
    return attribute === 'textContent' 
      ? await element.textContent() || ''
      : await element.getAttribute(attribute) || '';
  }

  /**
   * Apply transformation to extracted data
   */
  private applyTransform(value: string, transform: any): any {
    if (!transform || !value) return value;
    
    switch (transform.type) {
      case 'number':
        return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
      case 'date':
        return new Date(value).toISOString();
      case 'clean':
        return value.trim().replace(/\s+/g, ' ');
      case 'regex':
        const match = value.match(new RegExp(transform.pattern, transform.flags));
        return match ? match[transform.group || 0] : null;
      default:
        return value;
    }
  }

  /**
   * Get tool schema
   */
  getSchema(): any {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to scrape'
          },
          selectors: {
            type: 'object',
            description: 'CSS selectors for data extraction',
            additionalProperties: {
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    css: { type: 'string' },
                    attribute: { type: 'string', default: 'textContent' },
                    transform: { type: 'object' }
                  },
                  required: ['css']
                }
              ]
            }
          },
          options: {
            type: 'object',
            properties: {
              headless: { type: 'boolean', default: true },
              timeout: { type: 'number', default: 30000 },
              waitForSelector: { type: 'string' },
              takeScreenshot: { type: 'boolean', default: false },
              fullPageScreenshot: { type: 'boolean', default: true }
            }
          }
        },
        required: ['url', 'selectors']
      }
    };
  }
}

/**
 * Web scraping results interface
 */
export interface WebScrapeResult {
  url: string;
  data: Record<string, any>;
  screenshot?: string;
  title: string;
  url_final: string;
}