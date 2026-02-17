/*
    Comment Dump V4
    By : Pierre-Nicolas Allard-Coutu (PN-Tester)
    popup.js
*/

document.addEventListener('DOMContentLoaded', function () {
  const extractBtn  = document.getElementById('extractBtn');
  const btnWrap     = document.getElementById('btnWrap');
  const keywordsInput = document.getElementById('keywords');
  const statusEl    = document.getElementById('status');
  const kwToggle    = document.getElementById('kwToggle');
  const kwSection   = document.getElementById('kwSection');
  const kwArrow     = document.getElementById('kwArrow');
  const kwLabel     = document.getElementById('kwLabel');

  /* ── Collapsible keywords toggle ── */
  kwToggle.addEventListener('click', function () {
    const isOpen = kwSection.classList.contains('open');
    kwSection.classList.toggle('open', !isOpen);
    kwArrow.classList.toggle('open', !isOpen);
    kwLabel.classList.toggle('active', !isOpen);
  });

  /* ── Expand if user already typed something (e.g. re-opened popup) ── */
  if (keywordsInput.value.trim().length > 0) {
    kwSection.classList.add('open');
    kwArrow.classList.add('open');
    kwLabel.classList.add('active');
  }

  /* ── Extract button ── */
  extractBtn.addEventListener('click', function () {
    const keywords = keywordsInput.value.trim();

    extractBtn.classList.remove('ready');
    extractBtn.classList.add('scanning');
    extractBtn.textContent = 'SCANNING…';
    statusEl.textContent = 'Injecting scanner…';
    statusEl.className = 'status active';

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) {
        showError('No active tab found.');
        return;
      }

      const tabId = tabs[0].id;

      chrome.scripting.executeScript(
        { target: { tabId }, files: ['inject.js'] },
        function () {
          if (chrome.runtime.lastError) {
            showError(chrome.runtime.lastError.message);
            return;
          }

          chrome.scripting.executeScript(
            {
              target: { tabId },
              func: function (kw) {
                if (typeof window.__cdRun === 'function') window.__cdRun(kw);
              },
              args: [keywords]
            },
            function () {
              if (chrome.runtime.lastError) {
                showError(chrome.runtime.lastError.message);
                return;
              }
              showSuccess('Scan started — check DevTools (F12)');
            }
          );
        }
      );
    });
  });

  function showSuccess(msg) {
    extractBtn.textContent = 'DONE';
    extractBtn.classList.remove('scanning');
    extractBtn.classList.add('done');
    btnWrap.classList.add('done');
    statusEl.textContent = msg;
    statusEl.className = 'status success';
    setTimeout(resetBtn, 2500);
  }

  function showError(msg) {
    extractBtn.textContent = 'ERROR';
    extractBtn.classList.remove('scanning');
    extractBtn.classList.add('error');
    btnWrap.classList.add('error');
    statusEl.textContent = msg;
    statusEl.className = 'status error';
    setTimeout(resetBtn, 3000);
  }

  function resetBtn() {
    extractBtn.textContent = 'EXTRACT';
    extractBtn.className = 'extract-btn ready';
    btnWrap.className = 'btn-wrap';
    statusEl.className = 'status';
    statusEl.textContent = 'Open DevTools console (F12) to see results';
  }
});
