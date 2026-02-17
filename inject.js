/*
    Comment Dump V4
    inject.js

    By : Pierre-Nicolas Allard-Coutu (PN-Tester)
    Ported to Manifest V3, improved UI and Output , silently handles xhr errors like 400/404 etc

*/

window.__cdRun = function (customKeywords) {

  /* ─── REGEXES ─────────────────────────────────────────────────────────── */

  const reComments = /(?:(?<!(:|"|'|\\))\/\/[^\n\r]+)|(?:\/\*(?:[^*]|[\r\n]|(?:\*+(?:[^*/]|[\r\n])))*\*+\/)|(?:[ \t]*<!--(?:[\s\S]*?)-->\n*)/gm;

  const reDefaultKeywords = /(ADMIN|PASSWORD|CREDENTIALS|DEBUG|ADMINISTRATOR|PASSWD|PWD|APIKEY|API[_\-]?KEY|SECRET|TOKEN|USERNAME|UPLOAD|INTERNAL|AUTH|PRIVATE|TODO|FIXME|HACK|VULN|EXPLOIT|UNSAFE|BYPASS|BACKDOOR|HARDCODED|DISABLE|DISABLED|REMOVE|TEMP|TEMPORARY)/i;

  const reSkipFiles = /\.(?:jpg|jpeg|png|gif|ico|gz|svg|woff2?|ttf|tif|mp4|webp|bmp|mp3|wav|ogg|pdf|zip|tar|bin|exe)(\?|#|$)/i;

  const reValidURL = /^https?:\/\/.+/;

  const reBinarySignature = /^(JFIF|RIFF|WOF2|2EXIF|PNG|EXIF)/i;

  /* ─── KEYWORD SETUP ───────────────────────────────────────────────────── */

  let reKeywords;
  let keywordList = []; // individual terms for matching which keyword triggered

  if (customKeywords && customKeywords.trim().length > 0) {
    keywordList = customKeywords.trim()
      .split(/\s*,\s*/)
      .map(function(k) { return k.trim(); })
      .filter(function(k) { return k.length > 0; });
    const escaped = keywordList
      .map(function(k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); })
      .join('|');
    if (escaped.length > 0) {
      reKeywords = new RegExp('(' + escaped + ')', 'i');
    } else {
      reKeywords = reDefaultKeywords;
      keywordList = [];
    }
  } else {
    reKeywords = reDefaultKeywords;
    keywordList = [];
  }

  /* ─── HELPERS ─────────────────────────────────────────────────────────── */

  // Find which specific keyword(s) matched in a comment
  function findMatchedKeywords(comment) {
    if (keywordList.length > 0) {
      var hits = keywordList.filter(function(k) {
        return new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(comment);
      });
      return hits.length > 0 ? hits.join(', ') : 'keyword match';
    }
    // For default list, extract the actual word that matched
    var m = comment.match(reDefaultKeywords);
    return m ? m[0].toUpperCase() : 'keyword match';
  }

  function removeDuplicates(arr) {
    return arr.filter(function(v, i, a) { return a.indexOf(v) === i; });
  }

  /* ─── CONSOLE WRAPPER ─────────────────────────────────────────────────── */
  // All output is routed through this single object so every log call
  // originates from the same source line — suppressing the per-call
  // inject.js line numbers that would otherwise appear in the console gutter.
  var out = {
    log:            function() { console.log.apply(console, arguments); },
    group:          function() { console.group.apply(console, arguments); },
    groupCollapsed: function() { console.groupCollapsed.apply(console, arguments); },
    groupEnd:       function() { console.groupEnd(); },
    clear:          function() { console.clear(); }
  };

  /* ─── STORAGE: collect everything before printing ─────────────────────── */
  // We two-pass: first gather all results, then print hits up top, then grouped

  var allKeywordHits = []; // { comment, source, matchedKw }
  var allSources     = []; // { label, url, comments: [{comment,isHit}] }

  /* ─── COUNTERS ────────────────────────────────────────────────────────── */
  var totalComments      = 0;
  var totalKeywordHits   = 0;
  var sourcesWithComments = 0;

  /* ─── PRINT FUNCTIONS ─────────────────────────────────────────────────── */

  function printKeywordHitsSection() {
    if (allKeywordHits.length === 0) return;

    out.group(
      '%c *** INTERESTING KEYWORD DETECTED — ' + allKeywordHits.length + ' hit(s) ***',
      'background:#8b0000; color:#ff9999; font-weight:bold; font-size:12px; padding:3px 8px; border-radius:2px;'
    );

    allKeywordHits.forEach(function(hit) {
      out.log(
        '%c KEYWORD: ' + hit.matchedKw,
        'color:#ff6666; font-weight:bold; font-size:11px;'
      );
      if (hit.source) {
        out.log('%c Location: ' + hit.source, 'color:#aa4444; font-size:10px;');
      }
      out.log('%c' + hit.comment.trim(), 'color:#ff7070; font-family:monospace; font-size:11px;');
      out.log(' '); // spacer
    });

    out.groupEnd();
  }

  function printSourceSection(src) {
    var label = src.label
      + '  [' + src.comments.length + ' comment'
      + (src.comments.length !== 1 ? 's' : '') + ']';

    out.groupCollapsed('%c' + label, 'color:#7090c0; font-size:11px; font-family:monospace;');

    if (src.url) {
      out.log('%c' + src.url, 'color:#445; font-size:10px;');
    }

    src.comments.forEach(function(item) {
      if (item.isHit) {
        // Already shown above — mark it lightly so user knows
        out.log('%c[keyword hit — see above]', 'color:#664444; font-size:10px; font-style:italic;');
      } else {
        out.log('%c' + item.comment.trim(), 'color:#8ea4a5; font-family:monospace; font-size:11px;');
      }
    });

    out.groupEnd();
  }

  function printAll() {
    // 1. Keyword hits section — always at the top, always visible
    printKeywordHitsSection();

    // 2. Per-source collapsed groups
    allSources.forEach(function(src) {
      if (src.comments.length > 0) {
        printSourceSection(src);
        sourcesWithComments++;
      }
    });

    // 3. Summary
    var hitStyle = totalKeywordHits > 0
      ? 'background:#3a0000; color:#ff5555; font-weight:bold;'
      : 'background:#001a00; color:#1eff45; font-weight:bold;';
    out.log(
      '\n%c Scan complete  |  ' + totalComments + ' comments  |  '
      + totalKeywordHits + ' keyword hit(s)  |  '
      + sourcesWithComments + ' source(s) with comments ',
      'font-size:12px; padding:4px 10px; border-radius:3px; font-family:monospace; ' + hitStyle
    );
  }

  /* ─── PROCESS COMMENTS from one source ───────────────────────────────── */

  function processComments(comments, sourceURL, sourceLabel) {
    if (!comments || comments.length === 0) return;

    var srcEntry = { label: sourceLabel, url: sourceURL, comments: [] };

    comments.forEach(function(c) {
      var isHit = reKeywords.test(c);
      totalComments++;

      srcEntry.comments.push({ comment: c, isHit: isHit });

      if (isHit) {
        totalKeywordHits++;
        allKeywordHits.push({
          comment:   c,
          source:    sourceURL,
          matchedKw: findMatchedKeywords(c),
        });
      }
    });

    allSources.push(srcEntry);
  }

  /* ─── BANNER ──────────────────────────────────────────────────────────── */

  out.clear();
  out.log(
    '\n%c /**/ CommentDump V4 /**/ ',
    'font-family:monospace; font-size:26px; color:#2bd2ff; font-weight:bold; background:#050510; border:2px solid #2bd2ff; border-radius:6px; padding:10px 20px; letter-spacing:3px;'
  );
  var kwDisplay = (customKeywords && customKeywords.trim()) ? customKeywords.trim() : 'default list';
  out.log('%c Keywords: ' + kwDisplay, 'color:#888; font-size:11px; font-style:italic;');

  /* ─── 1. INLINE PAGE SOURCE ───────────────────────────────────────────── */

  var pageSource;
  try {
    pageSource = new XMLSerializer().serializeToString(document);
  } catch (e) {
    pageSource = document.documentElement.outerHTML;
  }

  var pageComments = pageSource.match(reComments);
  if (pageComments && pageComments.length > 0) {
    processComments(pageComments, null, 'Inline page source');
  } else {
    allSources.push({ label: 'Inline page source', url: null, comments: [] });
  }

  /* ─── 2. COLLECT EXTERNAL RESOURCE URLS ──────────────────────────────── */

  // Use PerformanceResourceTiming to only include URLs that the browser
  // actually loaded successfully. This is the key to suppressing 4xx/5xx
  // console errors — we never re-request something that already failed.
  //
  // Filters applied:
  //   - transferSize > 0   : resource was fetched over the network (not blocked/failed)
  //                          a 404/400 results in transferSize === 0 or a very small value
  //                          with no decodedBodySize, so we check decodedBodySize too.
  //   - responseStatus     : available in newer browsers; skip if not 200 when present.
  //   - reValidURL         : must be an http(s) URL
  //   - reSkipFiles        : skip binary file types

  var perfEntries = window.performance.getEntriesByType('resource');
  var allURLs = perfEntries
    .filter(function(e) {
      // responseStatus is available in Chrome 109+ / Firefox 109+
      if (typeof e.responseStatus === 'number' && e.responseStatus !== 200) return false;
      // decodedBodySize > 0 means the browser actually received a body
      // transferSize > 0 means it wasn't a failed/blocked request
      if (e.decodedBodySize === 0 && e.transferSize === 0) return false;
      return reValidURL.test(e.name);
    })
    .map(function(e) { return e.name; });

  var sources = removeDuplicates(allURLs).filter(function(url) {
    return !reSkipFiles.test(url);
  });

  if (sources.length === 0) {
    printAll();
    return;
  }

  /* ─── 3. FETCH & PARSE RESOURCES ─────────────────────────────────────── */

  var pending = sources.length;

  function onRequestDone() {
    pending--;
    if (pending <= 0) printAll();
  }

  // Use fetch() instead of XHR. Neither can fully silence browser network logs,
  // but combined with the pre-filter above, we only request URLs already known
  // to be good — so errors here should be extremely rare edge cases only.
  sources.forEach(function(url) {
    var controller = new AbortController();
    var timeoutId  = setTimeout(function() { controller.abort(); }, 3000);

    fetch(url, { signal: controller.signal, credentials: 'omit' })
      .then(function(res) {
        clearTimeout(timeoutId);
        if (!res.ok) { onRequestDone(); return null; }
        var finalURL = res.url || url;
        return res.text().then(function(text) { return { text: text, url: finalURL }; });
      })
      .then(function(result) {
        if (!result) { onRequestDone(); return; }
        try {
          if (reBinarySignature.test(result.text.substring(0, 20))) { onRequestDone(); return; }
          var comments = result.text.match(reComments);
          if (comments && comments.length > 0) {
            var fname = result.url.split('/').pop().split('?')[0] || result.url;
            processComments(comments, result.url, fname);
          }
        } catch (e) { /* binary/malformed — swallow silently */ }
        onRequestDone();
      })
      .catch(function() {
        clearTimeout(timeoutId);
        onRequestDone();
      });
  });

};
