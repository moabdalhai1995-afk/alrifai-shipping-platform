const { decorateHtml, resolveSendFilePath } = require('./html-sendfile-ui-preload');

const sample = '<!doctype html><html lang="ar" dir="rtl"><head><title>اختبار</title></head><body><main class="panel"><h1>حساب الأستاذ</h1></main></body></html>';
const once = decorateHtml(sample);
const twice = decorateHtml(once);

if (!once.includes('platform-ui-v390')) throw new Error('clean-route HTML must receive the unified platform body class');
if (!once.includes('id="platform-ui-v390-style"')) throw new Error('clean-route HTML must receive the base platform style');
if (!once.includes('id="clean-route-ui-v393-style"')) throw new Error('clean-route HTML must receive the responsive clean-route style');
if ((twice.match(/id="platform-ui-v390-style"/g) || []).length !== 1) throw new Error('base UI style must remain idempotent');
if ((twice.match(/id="clean-route-ui-v393-style"/g) || []).length !== 1) throw new Error('clean-route style must remain idempotent');
if (!resolveSendFilePath('/tmp/accounting.html', {})) throw new Error('absolute HTML file paths must resolve');
if (!resolveSendFilePath('accounting.html', { root: '/tmp' }).endsWith('/tmp/accounting.html')) throw new Error('root-based HTML file paths must resolve');

console.log('HTML sendFile UI checks passed');
