const { chromium } = require('playwright');

async function verifyDevServer() {
  console.log('Starting verification of dev server at http://localhost:3002...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Capture console messages
  const consoleMessages = [];
  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });

    if (msg.type() === 'error') {
      errors.push(text);
    } else if (msg.type() === 'warning') {
      warnings.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
  });

  try {
    console.log('Navigating to http://localhost:3002...');
    await page.goto('http://localhost:3002', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Page loaded successfully!\n');

    // Wait a bit for any late console messages
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({
      path: '.playwright-mcp/dev-server-verification.png',
      fullPage: true
    });
    console.log('Screenshot saved to .playwright-mcp/dev-server-verification.png\n');

    // Get page title
    const title = await page.title();
    console.log(`Page Title: ${title}\n`);

    // Check for specific errors
    const hasWebpackErrors = errors.some(e =>
      e.includes('webpack') ||
      e.includes('Cannot read properties of undefined') ||
      e.includes('module')
    );

    const hasReactErrors = errors.some(e =>
      e.includes('React') ||
      e.includes('Hydration')
    );

    // Report results
    console.log('='.repeat(60));
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(60));
    console.log(`\nTotal Console Messages: ${consoleMessages.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);

    console.log('\n' + '-'.repeat(60));
    console.log('CRITICAL CHECKS');
    console.log('-'.repeat(60));
    console.log(`Webpack Errors: ${hasWebpackErrors ? 'FOUND ❌' : 'NONE ✅'}`);
    console.log(`React Errors: ${hasReactErrors ? 'FOUND ❌' : 'NONE ✅'}`);
    console.log(`"Cannot read properties" Errors: ${errors.some(e => e.includes('Cannot read properties')) ? 'FOUND ❌' : 'NONE ✅'}`);

    if (errors.length > 0) {
      console.log('\n' + '-'.repeat(60));
      console.log('ERRORS FOUND:');
      console.log('-'.repeat(60));
      errors.forEach((err, i) => {
        console.log(`\n${i + 1}. ${err}`);
      });
    } else {
      console.log('\n✅ NO ERRORS FOUND - Server is working correctly!');
    }

    if (warnings.length > 0) {
      console.log('\n' + '-'.repeat(60));
      console.log('WARNINGS:');
      console.log('-'.repeat(60));
      warnings.forEach((warn, i) => {
        console.log(`\n${i + 1}. ${warn}`);
      });
    }

    console.log('\n' + '-'.repeat(60));
    console.log('ALL CONSOLE MESSAGES:');
    console.log('-'.repeat(60));
    consoleMessages.forEach((msg, i) => {
      console.log(`\n${i + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));

    if (errors.length === 0) {
      console.log('\n✅ SUCCESS: The dev server is running without errors!');
      console.log('The webpack/React module loading errors have been resolved.');
    } else {
      console.log('\n❌ ISSUES DETECTED: Please review the errors above.');
    }

    console.log('\n');

  } catch (error) {
    console.error('Failed to verify dev server:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

verifyDevServer().catch(console.error);
