// Facebook Resolver Bypass
var CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
function unwrapLoginWall(u) {
  var p;
  try { p = new URL(u); } catch (e) { return u; }
  if (!/^\/(?:accounts\/)?login\/?$/.test(p.pathname)) return u;
  var nx = p.searchParams.get("next");
  if (!nx) return u;
  if (nx.charAt(0) === "/") return p.origin + nx;
  try { var a = new URL(nx); return a.origin === p.origin ? a.toString() : u; } catch (e) { return u; }
}
function isPhotoUrl(u) {
  return /\/share\/p\//i.test(u) || /\/photo/i.test(u) || /photo\.php/i.test(u);
}
function fbidFrom(u) {
  var m;
  try {
    var p = new URL(u);
    m = p.searchParams.get("story_fbid") || p.searchParams.get("fbid");
    if (m && /^\d+$/.test(m)) return m;
  } catch (e) {}
  return "";
}
function maybePhoto(u) {
  if (isPhotoUrl(u)) return true;
  if (/\/reel\//i.test(u) || /\/watch/i.test(u) || /\/videos?\//i.test(u) || /\/share\/[rv]\//i.test(u)) return false;
  return true;
}
function unesc(s) {
  try { return JSON.parse('"' + s + '"'); }
  catch (e) { return String(s).replace(/\\\//g, "/"); }
}
function grab(h, k) {
  var m = h.match(new RegExp('"' + k + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
  return m ? unesc(m[1]) : "";
}
function extractVideo(h) {
  var hd = grab(h, "hd_src") || grab(h, "playable_url_quality_hd");
  var sd = grab(h, "sd_src") || grab(h, "playable_url");
  return { hd: hd, sd: (sd && sd !== hd ? sd : "") };
}
function extractImages(h) {
  var o = [];
  function add(u) {
    if (!u) return;
    u = u.replace(/\\\//g, "/");
    if (!/^https:\/\/scontent/i.test(u)) return;
    if (/rsrc\.php/i.test(u)) return;
    if (o.indexOf(u) < 0 && o.length < 20) o.push(u);
  }
  var m;
  var r1 = /"(\d{8,})"\s*:\s*"(https:[^"]*scontent[^"]*)"/g;
  while ((m = r1.exec(h))) add(m[2]);
  if (!o.length) {
    var r2 = /https:(?:\\\/){2}scontent[^"\\\s]{10,200}/g;
    while ((m = r2.exec(h))) add(m[0]);
  }
  if (!o.length) {
    var r3 = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi;
    while ((m = r3.exec(h))) add(m[1]);
  }
  return o;
}
export default async function handler(req, res) {
  var t = "";
  try { t = (req.query.url || "").trim(); } catch (e) {}
  if (!t || !/(facebook\.com|fb\.watch)/i.test(t)) {
    res.status(400).json({ error: "URL tidak valid" });
    return;
  }
  var out = {};
  try {
    var isShare = /\/share\//i.test(t) || /fb\.watch\//i.test(t);
    var canon = t;
    if (isShare) {
      var r = await fetch(t, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": CRAWLER_UA, "Accept": "text/html,application/xhtml+xml" }
      });
      try { await r.arrayBuffer(); } catch (e) {}
      var fin = "";
      try { fin = r.url || ""; } catch (e) {}
      fin = unwrapLoginWall(fin);
      if (fin && !/\/share\//i.test(fin) && !/fb\.watch\//i.test(fin) && /(facebook\.com|fb\.watch)/i.test(fin)) canon = fin;
    }
    out.url = canon;
    var fetchUrl = canon;
    var fbid = fbidFrom(canon);
    if (fbid && /story\.php/i.test(canon)) fetchUrl = "https://www.facebook.com/photo.php?fbid=" + fbid;
    var dbg = null;
    try { dbg = req.query.debug === "1"; } catch (e) {}
    try {
      var rp = await fetch(fetchUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
        headers: { "User-Agent": CRAWLER_UA, "Accept": "text/html,application/xhtml+xml" }
      });
      if (dbg) out._debug = { fetchUrl: fetchUrl, status: rp.status };
      var html = await rp.text();
      if (dbg) {
        out._debug.htmlSize = html.length;
        out._debug.scontentCount = (html.match(/scontent/gi) || []).length;
        out._debug.lookasideCount = (html.match(/lookaside/gi) || []).length;
        var m0 = html.match(/"(\d{8,})"\s*:\s*"(https:[^"]*scontent[^"]*)"/);
        out._debug.sample = m0 ? m0[0].slice(0, 120) : html.slice(html.indexOf("scontent") - 40, html.indexOf("scontent") + 80);
      }
      var v = extractVideo(html);
      if (v.hd) out.hd = v.hd;
      if (v.sd) out.sd = v.sd;
      if (maybePhoto(canon)) {
        var imgs = extractImages(html);
        if (imgs.length) out.images = imgs;
      }
    } catch (e) {}
    if (!out.url) {
      res.status(422).json({ error: "Tidak bisa resolve URL" });
      return;
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
  }
}
