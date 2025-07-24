import { WebScraperTool } from '../../../src/tools/native/WebScraperTool.js';
import { chromium } from 'playwright';

jest.mock('playwright');

const mockChromium = chromium as jest.Mocked<typeof chromium>;

describe('WebScraperTool', () => {
  let webScraperTool: WebScraperTool;
  let mockBrowser: any;
  let mockContext: any;
  let mockPage: any;

  beforeEach(() => {
    webScraperTool = new WebScraperTool();
    
    mockBrowser = {
      newContext: jest.fn(),
      close: jest.fn(),
    };

    mockContext = {
      newPage: jest.fn(),
      close: jest.fn(),
    };

    mockPage = {
      goto: jest.fn(),
      waitForSelector: jest.fn(),
      $$: jest.fn(),
      title: jest.fn(),
      url: jest.fn().mockResolvedValue('https://example.com'),
      screenshot: jest.fn(),
    };

    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should scrape web page successfully', async () => {
      const mockData = {
        title: 'Test Page',
        content: 'Page content'
      };

      mockPage.goto.mockResolvedValue({} as any);
      mockPage.title.mockResolvedValue('Test Page');
      
      const mockElements = [
        { textContent: jest.fn().mockResolvedValue('Page content') }
      ];
      mockPage.$$.mockResolvedValue(mockElements as any);

      const result = await webScraperTool.execute({
        url: 'https://example.com',
        selectors: {
          content: '.content'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.url).toBe('https://example.com');
      expect(result.data.data.content).toBe('Page content');
      expect(result.data.title).toBe('Test Page');
    });

    it('should handle multiple elements', async () => {
      mockPage.goto.mockResolvedValue({} as any);
      mockPage.title.mockResolvedValue('Test Page');
      mockPage.url.mockResolvedValue('https://example.com' as any);
      
      const mockElements = [
        { textContent: jest.fn().mockResolvedValue('Item 1') },
        { textContent: jest.fn().mockResolvedValue('Item 2') },
        { textContent: jest.fn().mockResolvedValue('Item 3') }
      ];
      mockPage.$$.mockResolvedValue(mockElements as any);

      const result = await webScraperTool.execute({
        url: 'https://example.com',
        selectors: {
          items: '.item'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.data.items).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('should handle complex selectors with attributes', async () => {
      mockPage.goto.mockResolvedValue({} as any);
      mockPage.title.mockResolvedValue('Test Page');
      mockPage.url.mockResolvedValue('https://example.com' as any);
      
      const mockElements = [
        { 
          textContent: jest.fn().mockResolvedValue('Link text'),
          getAttribute: jest.fn().mockResolvedValue('https://example.com/link')
        }
      ];
      mockPage.$$.mockResolvedValue(mockElements as any);

      const result = await webScraperTool.execute({
        url: 'https://example.com',
        selectors: {
          link: {
            css: 'a',
            attribute: 'href'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.data.link).toBe('https://example.com/link');
    });

    it('should handle selectors with transforms', async () => {
      mockPage.goto.mockResolvedValue({} as any);
      mockPage.title.mockResolvedValue('Test Page');
      mockPage.url.mockResolvedValue('https://example.com' as any);
      
      const mockElements = [
        { textContent: jest.fn().mockResolvedValue('$99.99') }
      ];
      mockPage.$$.mockResolvedValue(mockElements as any);

      const result = await webScraperTool.execute({
        url: 'https://example.com',
        selectors: {
          price: {
            css: '.price',
            transform: { type: 'number' }
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.data.price).toBe(99.99);
    });

    it('should take screenshot when requested', async () => {
      mockPage.goto.mockResolvedValue({} as any);
      mockPage.title.mockResolvedValue('Test Page');
      mockPage.url.mockResolvedValue('https://example.com' as any);
      mockPage.$$.mockResolvedValue([]);
      mockPage.screenshot.mockResolvedValue(Buffer.from('fake-screenshot') as any);

      const result = await webScraperTool.execute({
        url: 'https://example.com',
        selectors: {},
        options: {
          takeScreenshot: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.screenshot).toBe('ZmFrZS1zY3JlZW5zaG90'); // base64 of 'fake-screenshot'
      expect(mockPage.screenshot).toHaveBeenCalledWith({ fullPage: true });
    });

    it('should wait for selector when specified', async () => {
      mockPage.goto.mockResolvedValue({} as any);
      mockPage.waitForSelector.mockResolvedValue({} as any);
      mockPage.title.mockResolvedValue('Test Page');
      mockPage.url.mockResolvedValue('https://example.com' as any);
      mockPage.$$.mockResolvedValue([]);

      await webScraperTool.execute({
        url: 'https://example.com',
        selectors: {},
        options: {
          waitForSelector: '.content'
        }
      });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.content', { timeout: 10000 });
    });


    it('should handle navigation errors', async () => {
      (mockPage.goto as jest.Mock).mockRejectedValue(new Error('Navigation timeout'));
      mockPage.title.mockResolvedValue('Test Page');
      mockPage.url.mockResolvedValue('https://example.com' as any);

      const result = await webScraperTool.execute({
        url: 'https://example.com',
        selectors: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation timeout');
    });

    it('should close browser and context even on error', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation error'));

      await webScraperTool.execute({
        url: 'https://example.com',
        selectors: {}
      });

      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should use custom timeout', async () => {
      mockPage.goto.mockResolvedValue({} as any);
      mockPage.title.mockResolvedValue('Test Page');
      mockPage.url.mockResolvedValue('https://example.com' as any);
      mockPage.$$.mockResolvedValue([]);

      await webScraperTool.execute({
        url: 'https://example.com',
        selectors: {},
        options: {
          timeout: 60000
        }
      });

      expect(mockChromium.launch).toHaveBeenCalledWith({
        headless: true,
        timeout: 60000
      });

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle',
        timeout: 60000
      });
    });
  });

  describe('validate', () => {
    it('should validate correct parameters', () => {
      expect(webScraperTool.validate({
        url: 'https://example.com',
        selectors: {
          title: 'h1'
        }
      })).toBe(true);
    });

    it('should reject missing URL', () => {
      expect(webScraperTool.validate({
        selectors: {
          title: 'h1'
        }
      })).toBe(false);
    });

    it('should reject missing selectors', () => {
      expect(webScraperTool.validate({
        url: 'https://example.com'
      })).toBe(false);
    });

    it('should reject non-string URL', () => {
      expect(webScraperTool.validate({
        url: 123,
        selectors: {}
      })).toBe(false);
    });

    it('should reject non-object selectors', () => {
      expect(webScraperTool.validate({
        url: 'https://example.com',
        selectors: 'invalid'
      })).toBe(false);
    });
  });

  describe('getSchema', () => {
    it('should return correct schema', () => {
      const schema = webScraperTool.getSchema();
      
      expect(schema.name).toBe('web_scraper');
      expect(schema.description).toBe('Web scraping tool for extracting data from websites using Playwright');
      expect(schema.inputSchema.type).toBe('object');
      expect(schema.inputSchema.required).toEqual(['url', 'selectors']);
    });
  });
});