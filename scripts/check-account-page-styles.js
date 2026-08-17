const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'account.html'), 'utf8');

for (const token of [
  '/public-sections.css?v=3.8.4',
  'Critical account-page styles are intentionally inline',
  '.account-grid{display:grid',
  '.field{display:block;width:100%',
  '@media(max-width:800px)',
  'viewport-fit=cover',
  'aria-label="التنقل الرئيسي"'
]) {
  if (!html.includes(token)) throw new Error(`missing account style safeguard: ${token}`);
}

console.log('Account page responsive style safeguards passed');
