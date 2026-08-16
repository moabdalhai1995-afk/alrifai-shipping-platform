const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const obsolete = [
  'activity_main.xml',
  'admin-1-1.html',
  'admin-1-old.html',
  'admin-1.html',
  'alrifai_admin_v2-2.html',
  'android-apk.yml',
  'android-apk.yml (1).txt',
  'app/java',
  'app/src/java',
  'app/styles.xml',
  'colors.xml',
  'ic_launcher.xml',
  'strings.xml',
  'styles.xml',
  'AlRifaiShippingAndroid_READY.zip',
  'AlRifai_Admin_Auth_GitHub.zip',
  'AndroidManifest.xml',
  'MainActivity.java'
];

const required = [
  'admin.html',
  '.github/workflows/android-apk.yml',
  'app/src/main/AndroidManifest.xml',
  'app/src/main/java/com/alrifai/shipping/MainActivity.java',
  'app/src/main/res/layout/activity_main.xml'
];

for (const item of obsolete) {
  if (fs.existsSync(path.join(root, item))) {
    throw new Error(`obsolete repository path returned: ${item}`);
  }
}

for (const item of required) {
  if (!fs.existsSync(path.join(root, item))) {
    throw new Error(`required production path missing: ${item}`);
  }
}

console.log('Repository cleanup check passed');
