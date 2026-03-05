const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('http://127.0.0.1:3000/surplus-goods.html?section=MOLDING');

    // login MSNV
    await page.waitForSelector('#msnv-input');
    await page.type('#msnv-input', '04126');
    await page.click('#btn-msnv-ok');

    // wait for modal to hide
    await new Promise(r => setTimeout(r, 1000));

    const molding = await page.evaluate(() => {
        const el = document.getElementById('molding-search-container');
        return el ? el.outerHTML : 'NOT_FOUND';
    });
    console.log("MOLDING:", molding);

    const def = await page.evaluate(() => {
        const el = document.getElementById('default-search-container');
        return el ? el.outerHTML : 'NOT_FOUND';
    });
    console.log("DEFAULT:", def);

    await browser.close();
})();
