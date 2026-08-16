const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const gradle = fs.readFileSync(path.join(root, 'app', 'build.gradle'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'android-apk.yml'), 'utf8');

for (const token of [
  "System.getenv('ALRIFAI_VERSION_CODE')",
  "System.getenv('ALRIFAI_VERSION_NAME')",
  "groovy.json.JsonSlurper()",
  "file('../package.json')",
  'versionCode buildVersionCode',
  'versionName buildVersionName ?: packageVersion'
]) {
  if (!gradle.includes(token)) throw new Error(`missing Gradle Android version token: ${token}`);
}

for (const token of [
  'Resolve Android build version',
  'github.run_number',
  'ALRIFAI_VERSION_CODE',
  'ALRIFAI_VERSION_NAME',
  "require('./package.json').version",
  'Google-Play-AAB',
  'Publish GitHub Release'
]) {
  if (!workflow.includes(token)) throw new Error(`missing Android workflow version token: ${token}`);
}

console.log('Android automatic and local versioning check passed');
