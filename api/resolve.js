// Resolver Facebook Bypass
var CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function unwrapLoginWall(finalUrl) {
  var p;
  try { p = new URL(finalUrl); } catch (e) { return finalUrl; }
  if (!/^\/(?:accounts\/)?login\/?$/.test(p.pathname)) return finalUrl;
  var nx = p.searchParams.get("next");
  if (!nx) return finalUrl;
  if (nx.charAt(0) === "/") return p.origin + nx;
  try {
    var a = new URL(nx);
    return a.origin === p.origin ? a.toString() : finalUrl;
  } catch (e) { return finalUrl; }
}

function isPhotoUrl(u) {
  return /\/share\/p\//i.test(u) || /\/photo/i.test(u) || /photo\.php/i.test(u);
}
// Bukan video => kemungkinan foto (posts/, share tanpa tipe, dll)
function maybePhoto(u) {
  if (isPhotoUrl(u)) return true;
  if (/\/reel\//i.test(u) || /\/watch/i.test(u) || /\/videos?\//i.test(u) || /\/share\/[rv]\//i.test(u)) return false;
  return true;
}

function extractImages(html) {
  var images = [];
  function add(u) {
    if (!u) return;
    u = u.replace(/\\\//g, "/");
    if (!/^https:\/\/scontent/i.test(u)) return;
    if (/rsrc\.php/i.test(u)) return;
    if (images.indexOf(u) < 0 && images.length < 20) images.push(u);
  }
  var m;
  var re1 = /"(\d{8,})"\s*:\s*"(https:[^"]*scontent[^"]*)"/g;
  while ((m = re1.exec(html))) add(m[2]);
  if (!images.length) {
    var re2 = /https:(?:\\\/){2}scontent[^"\\\s]{10,200}/g;
    while ((m = re2.exec(html))) add(m[0]);
  }
  if (!images.length) {
    var re3 = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi;
    while ((m = re3.exec(html))) add(m[1]);
  }
  return images;
}

export default async function handler(req, res) {
  var target = "";
  try { target = (req.query.url || "").trim(); } catch (e) {}
  if (!target || !/(facebook\.com|fb\.watch)/i.test(target)) {
    res.status(400).json({ error: "URL tidak valid" });
    return;
  }
  var out = {};
  try {
    // 1. Resolve share URL via crawler UA
    var isShare = /\/share\//i.test(target) || /fb\.watch\//i.test(target);
    var canon = target;
    if (isShare) {
      var r = await fetch(target, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": CRAWLER_UA, "Accept": "text/html,application/xhtml+xml" }
      });
      try { await r.arrayBuffer(); } catch (e) {}
      var fin = "";
      try { fin = r.url || ""; } catch (e) {}
      fin = unwrapLoginWall(fin);
      if (fin && !/\/share\//i.test(fin) && !/fb\.watch\//i.test(fin) && /(facebook\.com|fb\.watch)/i.test(fin)) {
        canon = fin;
      }
    }
    out.url = canon;
    // 2. Bila kemungkinan foto: ambil images via browser UA
    if (maybePhoto(canon)) {
      try {
        var rp = await fetch(canon, {
          redirect: "follow",
          signal: AbortSignal.timeout(20000),
          headers: {
            "User-Agent": BROWSER_UA,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
          }
        });
        var html = await rp.text();
        var imgs = extractImages(html);
        if (imgs.length) out.images = imgs;
      } catch (e) {}
    }
    if (!out.url) {
      res.status(422).json({ error: "Tidak bisa resolve URL" });
      return;
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
  }
}
