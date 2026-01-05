/**
 * PDF Generator Module
 * Handles Puppeteer-based PDF generation with singleton browser pattern
 *
 * Extracted from resume-builder-ai/src/lib/export.ts (lines 15-53)
 * Phase 2: PDF Generation Logic
 */

const puppeteer = require('puppeteer-core');
const logger = require('../utils/logger');

// Singleton browser instance
let browserInstance = null;
let isShuttingDown = false;

/**
 * Get or create singleton browser instance
 * Reduces overhead by reusing the same browser for multiple PDF generations
 */
async function getBrowser() {
  if (isShuttingDown) {
    throw new Error('Browser is shutting down');
  }

  if (browserInstance && browserInstance.isConnected()) {
    logger.info('[PDF-Generator] Reusing existing browser instance');
    return browserInstance;
  }

  logger.info('[PDF-Generator] Launching new Chromium browser instance');

  try {
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium', // Docker container path
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-software-rasterizer',
        '--disable-web-security', // Allow loading local fonts
      ],
    });

    logger.info('[PDF-Generator] Browser launched successfully', {
      version: await browserInstance.version(),
    });

    // Handle browser disconnection
    browserInstance.on('disconnected', () => {
      logger.warn('[PDF-Generator] Browser disconnected');
      browserInstance = null;
    });

    return browserInstance;
  } catch (error) {
    logger.error('[PDF-Generator] Failed to launch browser', { error: error.message });
    throw new Error('BROWSER_LAUNCH_ERROR: ' + error.message);
  }
}

/**
 * Generate PDF from HTML string
 *
 * @param {string} html - Complete HTML document
 * @param {Object} options - PDF generation options
 * @param {string} options.format - Paper format (default: 'letter')
 * @param {boolean} options.printBackground - Print background graphics (default: true)
 * @param {Object} options.margin - Page margins (default: 0)
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePdfFromHtml(html, options = {}) {
  const startTime = Date.now();
  let page = null;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    logger.info('[PDF-Generator] Loading HTML content into page');

    // Set content with proper wait conditions
    await page.setContent(html, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: 30000, // 30 second timeout
    });

    logger.info('[PDF-Generator] Generating PDF');

    // Generate PDF with specified options
    const pdfBuffer = await page.pdf({
      format: options.format || 'letter',
      printBackground: options.printBackground !== false,
      preferCSSPageSize: true,
      margin: options.margin || {
        top: '0in',
        right: '0in',
        bottom: '0in',
        left: '0in',
      },
    });

    const duration = Date.now() - startTime;
    logger.info('[PDF-Generator] PDF generated successfully', {
      size: pdfBuffer.length,
      duration: `${duration}ms`,
    });

    // Convert to Buffer if needed
    return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[PDF-Generator] PDF generation failed', {
      error: error.message,
      duration: `${duration}ms`,
    });

    if (error.message.includes('timeout')) {
      throw new Error('TIMEOUT_ERROR: Page load timeout exceeded');
    }
    throw new Error('RENDER_ERROR: ' + error.message);
  } finally {
    // Always close the page to free resources
    if (page) {
      try {
        await page.close();
      } catch (err) {
        logger.warn('[PDF-Generator] Failed to close page', { error: err.message });
      }
    }
  }
}

/**
 * Gracefully shutdown browser instance
 * Should be called on process exit
 */
async function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('[PDF-Generator] Shutting down browser');

  if (browserInstance) {
    try {
      await browserInstance.close();
      logger.info('[PDF-Generator] Browser closed successfully');
    } catch (error) {
      logger.error('[PDF-Generator] Error closing browser', { error: error.message });
    } finally {
      browserInstance = null;
    }
  }
}

// Register shutdown handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('exit', () => {
  if (browserInstance) {
    logger.warn('[PDF-Generator] Force closing browser on exit');
  }
});

module.exports = {
  generatePdfFromHtml,
  getBrowser,
  shutdown,
};
