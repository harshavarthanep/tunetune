// Prepares the generated Android project: background playback permissions, cleartext radio, app icons and splash.
// Run after `npx cap add android` (the GitHub workflow does this for you).
const fs = require('fs'), path = require('path');
const RES = 'android/app/src/main/res';
const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
if (!fs.existsSync(MANIFEST)) { console.error('Run `npx cap add android` first.'); process.exit(1); }

let m = fs.readFileSync(MANIFEST, 'utf8');
const perms = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK', // Android 14+: required for music to keep playing with the screen off
  'android.permission.WAKE_LOCK',
  'android.permission.POST_NOTIFICATIONS',
];
for (const p of perms) if (!m.includes(`"${p}"`)) m = m.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
if (!m.includes('usesCleartextTraffic')) m = m.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
fs.writeFileSync(MANIFEST, m);

function copyDir(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); } else fs.copyFileSync(s, d);
  }
}
copyDir('build/android-res', RES);
const bg = path.join(RES, 'values/ic_launcher_background.xml');
if (fs.existsSync(bg)) fs.writeFileSync(bg, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FF375F</color>\n</resources>\n');
console.log('Android project prepared: permissions, icons and splash screens.');
