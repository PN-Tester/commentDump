/*
    Comment Dump V4
    inject.js

    By : Pierre-Nicolas Allard-Coutu (PN-Tester)
    Ported to Manifest V3, improved UI and Output
*/

window.__cdRun = function (customKeywords, options) {

  /* ─── OPTIONS (from popup checkboxes) ────────────────────────────────── */

  var parseJS       = !options || options.parseJS       !== false;
  var parseCSS      = !options || options.parseCSS      !== false;
  var parseHTML     = !options || options.parseHTML     !== false;
  var sameOriginOnly = !options || options.sameOriginOnly !== false;

  /* ─── REGEXES ─────────────────────────────────────────────────────────── */

  const reComments = /(?:(?<!(:|"|'|\\))\/\/[^\n\r]+)|(?:\/\*(?:[^*]|[\r\n]|(?:\*+(?:[^*/]|[\r\n])))*\*+\/)|(?:[ \t]*<!--(?:[\s\S]*?)-->\n*)/gm;

  const reDefaultKeywords = /(ADMIN|PASSWORD|CREDENTIALS|DEBUG|ADMINISTRATOR|PASSWD|PWD|APIKEY|API[_\-]?KEY|SECRET|TOKEN|USERNAME|UPLOAD|INTERNAL|AUTH|PRIVATE|TODO|FIXME|HACK|VULN|EXPLOIT|UNSAFE|BYPASS|BACKDOOR|HARDCODED|DISABLE|DISABLED|REMOVE|TEMP|TEMPORARY)/i;

  const reSkipFiles = /\.(?:jpg|jpeg|png|gif|ico|gz|svg|woff2?|ttf|tif|mp4|webp|bmp|mp3|wav|ogg|pdf|zip|tar|bin|exe)(\?|#|$)/i;

  // Library noise filter: skip anything with these framework names or that is minified
  const reSkipLibraries = /(angular|moment|bootstrap|jquery|lodash|rxjs|zone\.js|core-js|polyfill|vendor|runtime|hammer|chart\.js|d3\.min|three\.min)|(\.min\.js(\?|#|$))/i;

  // File type detectors (applied to the filename portion of the URL)
  const reIsJS   = /\.m?js(\?|#|$)/i;
  const reIsCSS  = /\.css(\?|#|$)/i;
  const reIsHTML = /\.html?(\?|#|$)/i;

  const reValidURL = /^https?:\/\/.+/;

  const reBinarySignature = /^(JFIF|RIFF|WOF2|2EXIF|PNG|EXIF)/i;

  /* ─── KEYWORD SETUP ───────────────────────────────────────────────────── */

  let reKeywords;
  let keywordList = [];

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

  function findMatchedKeywords(comment) {
    if (keywordList.length > 0) {
      var hits = keywordList.filter(function(k) {
        return new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(comment);
      });
      return hits.length > 0 ? hits.join(', ') : 'keyword match';
    }
    var m = comment.match(reDefaultKeywords);
    return m ? m[0].toUpperCase() : 'keyword match';
  }

  // Returns true if a URL's file type is enabled by the current options
  function isFileTypeEnabled(url) {
    var fname = url.split('/').pop();
    if (reIsJS.test(fname))   return parseJS;
    if (reIsCSS.test(fname))  return parseCSS;
    if (reIsHTML.test(fname)) return parseHTML;
    // No recognisable extension — treat as JS-like (e.g. Angular route chunks with no ext)
    return parseJS;
  }

  /* ─── CONSOLE WRAPPER ─────────────────────────────────────────────────── */

  var out = {
    log:            function() { console.log.apply(console, arguments); },
    group:          function() { console.group.apply(console, arguments); },
    groupCollapsed: function() { console.groupCollapsed.apply(console, arguments); },
    groupEnd:       function() { console.groupEnd(); },
    clear:          function() { console.clear(); }
  };

  /* ─── STORAGE ─────────────────────────────────────────────────────────── */

  var allKeywordHits  = [];
  var allSources      = [];

  /* ─── COUNTERS ────────────────────────────────────────────────────────── */

  var totalComments       = 0;
  var totalKeywordHits    = 0;
  var sourcesWithComments = 0;

  /* ─── PRINT FUNCTIONS ─────────────────────────────────────────────────── */

  function printKeywordHitsSection() {
    if (allKeywordHits.length === 0) return;

    out.group(
      '%c *** INTERESTING KEYWORD DETECTED — ' + allKeywordHits.length + ' hit(s) ***',
      'background:#8b0000; color:#ff9999; font-weight:bold; font-size:12px; padding:3px 8px; border-radius:2px;'
    );

    allKeywordHits.forEach(function(hit) {
      out.log('%c KEYWORD: ' + hit.matchedKw, 'color:#ff6666; font-weight:bold; font-size:11px;');
      if (hit.source) {
        out.log('%c Location: ' + hit.source, 'color:#aa4444; font-size:10px;');
      }
      out.log('%c' + hit.comment.trim(), 'color:#ff7070; font-family:monospace; font-size:11px;');
      out.log(' ');
    });

    out.groupEnd();
  }

  function printSourceSection(src) {
    var tagParts = [src.label];
    if (src.fromDOM)  tagParts.push('DOM');
    if (src.fromPerf) tagParts.push('PERF');
    if (src.cached)   tagParts.push('CACHED');

    var label = tagParts.join(' · ')
      + '  [' + src.comments.length + ' comment'
      + (src.comments.length !== 1 ? 's' : '') + ']';

    out.groupCollapsed('%c' + label, 'color:#7090c0; font-size:11px; font-family:monospace;');

    if (src.url) {
      out.log('%c' + src.url, 'color:#445; font-size:10px;');
    }

    src.comments.forEach(function(item) {
      if (item.isHit) {
        out.log('%c[keyword hit — see above]', 'color:#664444; font-size:10px; font-style:italic;');
      } else {
        out.log('%c' + item.comment.trim(), 'color:#8ea4a5; font-family:monospace; font-size:11px;');
      }
    });

    out.groupEnd();
  }

  function printAll() {
    printKeywordHitsSection();

    allSources.forEach(function(src) {
      if (src.comments.length > 0) {
        printSourceSection(src);
        sourcesWithComments++;
      }
    });

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

  function processComments(comments, sourceURL, sourceLabel, meta) {
    if (!comments || comments.length === 0) return;

    var srcEntry = {
      label:    sourceLabel,
      url:      sourceURL,
      comments: [],
      fromDOM:  (meta && meta.fromDOM)  || false,
      fromPerf: (meta && meta.fromPerf) || false,
      cached:   (meta && meta.cached)   || false
    };

    comments.forEach(function(c) {
      var isHit = reKeywords.test(c);
      totalComments++;
      srcEntry.comments.push({ comment: c, isHit: isHit });
      if (isHit) {
        totalKeywordHits++;
        allKeywordHits.push({ comment: c, source: sourceURL, matchedKw: findMatchedKeywords(c) });
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
  out.log(
    '%c Filters: JS=' + parseJS + '  CSS=' + parseCSS + '  HTML=' + parseHTML + '  same-origin=' + sameOriginOnly,
    'color:#666; font-size:10px; font-style:italic;'
  );

  /* ─── 1. INLINE PAGE SOURCE ───────────────────────────────────────────── */

  // The inline page source is always scanned when parseHTML is enabled
  if (parseHTML) {
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
      allSources.push({ label: 'Inline page source', url: null, comments: [], fromDOM: false, fromPerf: false, cached: false });
    }
  }

  /* ─── 2. COLLECT EXTERNAL RESOURCE URLS ──────────────────────────────── */

  var urlMeta = {};
  var pageOrigin = window.location.origin;

  // --- 2a. PerformanceResourceTiming entries ---

  var perfEntries = window.performance.getEntriesByType('resource');
  perfEntries.forEach(function(e) {
    if (!reValidURL.test(e.name)) return;
    if (reSkipFiles.test(e.name)) return;

    // Skip known library/framework files and minified bundles
    var fname = e.name.split('/').pop();
    if (reSkipLibraries.test(fname)) return;

    // Skip file types the user has disabled
    if (!isFileTypeEnabled(e.name)) return;

    // Same-origin filter
    if (sameOriginOnly && !e.name.startsWith(pageOrigin)) return;

    if (typeof e.responseStatus === 'number' && e.responseStatus !== 200) return;

    var isScript = (e.initiatorType === 'script' || reIsJS.test(fname));
    if (!isScript && e.decodedBodySize === 0 && e.transferSize === 0) return;

    if (!urlMeta[e.name]) urlMeta[e.name] = { fromDOM: false, fromPerf: false, cached: false };
    urlMeta[e.name].fromPerf = true;
    if (e.transferSize === 0 && e.decodedBodySize === 0) urlMeta[e.name].cached = true;
  });

  // --- 2b. DOM <script src> tags ---

  if (parseJS) {
    var domScriptEls = document.querySelectorAll('script[src]');
    domScriptEls.forEach(function(el) {
      var src = el.src;
      if (!src || !reValidURL.test(src)) return;
      if (reSkipFiles.test(src)) return;

      var fname = src.split('/').pop();
      if (reSkipLibraries.test(fname)) return;
      if (sameOriginOnly && !src.startsWith(pageOrigin)) return;

      if (!urlMeta[src]) urlMeta[src] = { fromDOM: false, fromPerf: false, cached: false };
      urlMeta[src].fromDOM = true;
    });
  }

  // --- 2c. DOM <link rel="stylesheet"> tags (for CSS) ---

  if (parseCSS) {
    var domLinkEls = document.querySelectorAll('link[rel="stylesheet"][href]');
    domLinkEls.forEach(function(el) {
      var href = el.href;
      if (!href || !reValidURL.test(href)) return;
      if (reSkipFiles.test(href)) return;

      var fname = href.split('/').pop();
      if (reSkipLibraries.test(fname)) return;
      if (sameOriginOnly && !href.startsWith(pageOrigin)) return;

      if (!urlMeta[href]) urlMeta[href] = { fromDOM: false, fromPerf: false, cached: false };
      urlMeta[href].fromDOM = true;
    });
  }

  var sources = Object.keys(urlMeta);

  if (sources.length === 0) {
    printAll();
    return;
  }

  out.log(
    '%c Scanning ' + sources.length + ' resource(s)\u2026',
    'color:#555e80; font-size:10px; font-style:italic;'
  );

  /* ─── 3. FETCH & PARSE RESOURCES (via background service worker) ──────── */

  var pending = sources.length;

  function onRequestDone() {
    pending--;
    if (pending <= 0) printAll();
  }

  sources.forEach(function(url) {
    var meta = urlMeta[url];

    chrome.runtime.sendMessage({ type: 'CD_FETCH', url: url }, function(response) {
      if (chrome.runtime.lastError) { onRequestDone(); return; }
      if (!response || !response.ok) { onRequestDone(); return; }
      try {
        if (reBinarySignature.test(response.text.substring(0, 20))) { onRequestDone(); return; }
        var comments = response.text.match(reComments);
        if (comments && comments.length > 0) {
          var finalURL = response.finalURL || url;
          var fname    = finalURL.split('/').pop().split('?')[0] || finalURL;
          processComments(comments, finalURL, fname, meta);
        }
      } catch (e) { /* binary/malformed — swallow silently */ }
      onRequestDone();
    });
  });

};
