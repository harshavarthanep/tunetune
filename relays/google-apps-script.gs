/**
 * Tune Tune relay for Google Apps Script — free.
 * Google allows 20,000 web fetches a day per Google account; this relay stops itself at DAILY_CAP,
 * so your account never hits Google's limit. Answers are cached for 10 minutes (repeats cost nothing).
 *
 * Set up (about 3 minutes):
 *  1. Open script.google.com → New project. Delete what's there and paste this whole file. Save.
 *  2. Deploy → New deployment → gear icon → Web app.
 *     Execute as: Me.   Who has access: Anyone.   → Deploy → Authorize access (allow).
 *  3. Copy the Web app URL (it ends in /exec).
 *  4. In tunetune-sources.json → "backupServers", replace the XXXX in the Google relay line with your link:
 *     { "name": "Google relay", "url": "https://script.google.com/macros/s/…/exec?url={url}", "dailyCap": 1500 }
 *  Open the /exec link in a browser any time to see how many fetches were used today.
 */
var DAILY_CAP = 18000;                                              // Google's limit is 20,000 a day
var ALLOW = /(^|\.)(jiosaavn\.com|saavn\.com|youtube\.com)$/i;      // music data and YouTube search only (no audio files)

function doGet(e) {
  var target = (e && e.parameter && e.parameter.url) || '';
  if (!target) return json_({ ok: true, relay: 'Tune Tune', usedToday: used_(), dailyCap: DAILY_CAP });
  var m = /^https:\/\/([^\/?#:]+)/i.exec(target);
  if (!m || !ALLOW.test(m[1])) return json_({ ttRelayError: 'not-allowed' });

  var cache = CacheService.getScriptCache();
  var key = 'r' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, target));
  var hit = cache.get(key);
  if (hit) return text_(hit);

  if (used_() >= DAILY_CAP) return json_({ ttRelayError: 'limit' });
  bump_();
  try {
    var headers = { 'Accept-Language': 'en-IN,en;q=0.9' };
    if (/saavn/i.test(m[1])) { headers['Referer'] = 'https://www.jiosaavn.com/'; headers['Cookie'] = 'gdpr_acceptance=true; DL=english'; }
    if (/youtube/i.test(m[1])) headers['Cookie'] = 'CONSENT=YES+1';
    var r = UrlFetchApp.fetch(target, { muteHttpExceptions: true, followRedirects: true, headers: headers });
    var body = r.getContentText();
    if (r.getResponseCode() === 200 && body.length < 95000) { try { cache.put(key, body, 600); } catch (x) {} }
    return text_(body);
  } catch (err) {
    return json_({ ttRelayError: /too many times|quota|limit/i.test(String(err)) ? 'limit' : 'fetch' });
  }
}

function today_() { return Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyy-MM-dd'); }
function used_() { var p = PropertiesService.getScriptProperties(); return p.getProperty('day') === today_() ? Number(p.getProperty('n') || 0) : 0; }
function bump_() {
  var p = PropertiesService.getScriptProperties(), d = today_();
  if (p.getProperty('day') !== d) p.setProperties({ day: d, n: '1' });
  else p.setProperty('n', String(Number(p.getProperty('n') || 0) + 1));
}
function text_(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
