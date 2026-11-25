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
// Listed as a music app (default music player pickers, headset music key), "Open with Tune Tune" for music files,
// and tunetune:// links (widget buttons, notifications)
if (!m.includes('android:scheme="tunetune"')) {
  const filters = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="tunetune" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <action android:name="android.intent.action.MUSIC_PLAYER" />
                <category android:name="android.intent.category.APP_MUSIC" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="content" />
                <data android:scheme="file" />
                <data android:mimeType="audio/*" />
            </intent-filter>`;
  const i = m.indexOf('</intent-filter>');
  if (i > 0) m = m.slice(0, i + '</intent-filter>'.length) + filters + m.slice(i + '</intent-filter>'.length);
}
// home-screen widget
if (!m.includes('TuneWidget')) m = m.replace('</application>', `    <receiver android:name=".TuneWidget" android:exported="false" android:label="Tune Tune">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/tune_widget_info" />
        </receiver>
    </application>`);
fs.writeFileSync(MANIFEST, m);

function copyDir(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); } else fs.copyFileSync(s, d);
  }
}
copyDir('build/android-res', RES);
copyDir('build/android-extra/res', RES);
const JAVA = 'android/app/src/main/java/com/h24creationz/tunetune';
fs.mkdirSync(JAVA, { recursive: true });
fs.copyFileSync('build/android-extra/java/TuneWidget.java', path.join(JAVA, 'TuneWidget.java'));
const bg = path.join(RES, 'values/ic_launcher_background.xml');
if (fs.existsSync(bg)) fs.writeFileSync(bg, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FF375F</color>\n</resources>\n');
console.log('Android project prepared: permissions, open-with, widget, notification icon, app icons and splash screens.');
