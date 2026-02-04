const fs = require('fs');
const { log } = require('./logger');

async function saveCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
  log("Cookies saved successfully.");
}

module.exports = { saveCookies };
