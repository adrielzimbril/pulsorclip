import puppeteer from 'puppeteer';

async function capture() {
  const browser = await puppeteer.launch();
  const page = (await browser.pages())[0];
  
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:10000', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'preview/home_light.png' });
  
  // Try to toggle dark mode if possible or take another page shot
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.reload({ waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'preview/home_dark.png' });

  await browser.close();
  console.log("Screenshots captured in preview directory.");
}

capture().catch(console.error);
