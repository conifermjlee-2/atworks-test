const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Navigating to http://localhost:3002...');
    const observed = [];
    page.on('response', response => {
        observed.push(response.url());
        console.log('Response:', response.url());
    });

    await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
    await browser.close();

    console.log('Does it contain api/products?', observed.some(u => u.includes('api/products')));
    console.log('Does it contain api/cart?', observed.some(u => u.includes('api/cart')));
})();
