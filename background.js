/*
    Comment Dump V4
    background.js  — service worker

    Fetches URLs on behalf of inject.js.
    Because the service worker runs in the extension origin (not the page origin),
    browser CORS rules do not apply — host_permissions:<all_urls> grants direct
    access to any URL with no Access-Control-Allow-Origin requirement and no
    console noise on the inspected page.
*/

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type !== 'CD_FETCH') return false;

  fetch(msg.url, { credentials: 'omit' })
    .then(function(res) {
      if (!res.ok) { sendResponse({ ok: false }); return; }
      var finalURL = res.url || msg.url;
      res.text().then(function(text) {
        sendResponse({ ok: true, text: text, finalURL: finalURL });
      });
    })
    .catch(function() {
      sendResponse({ ok: false });
    });

  return true; // keep message channel open for async sendResponse
});
