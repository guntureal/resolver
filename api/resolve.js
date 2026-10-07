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
export default async function handler(req, res) {
  var t = "";
  try { t = (req.query.url || "").trim(); } catch (e) {}
  if (!t || !/(facebook\.com|fb\.watch)/i.test(t)) {
    res.status(400).json({ error: "URL tidak valid" });
    return;
  }
  function fh(ua) {
    var h = { "User-Agent": ua, "Accept": "text/html,application/xhtml+xml" };
    if (ua === CRAWLER_UA) h["Accept-Language"] = "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7";
    return h;
  }
  var out = {};
  try {
    var isShare = /\/share\//i.test(t) || /fb\.watch\//i.test(t);
    var canon = t;
    if (isShare) {
      var r = await fetch(t, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: fh(CRAWLER_UA)
      });
      try { await r.arrayBuffer(); } catch (e) {}
      var fin = "";
      try { fin = r.url || ""; } catch (e) {}
      fin = unwrapLoginWall(fin);
      if (fin && !/\/share\//i.test(fin) && !/fb\.watch\//i.test(fin) && /(facebook\.com|fb\.watch)/i.test(fin)) canon = fin;
    }
    out.url = canon;

    try {
      var rp = await fetch(canon, {
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
        headers: fh(CRAWLER_UA)
      });
      var html = await rp.text();
      var v = extractVideo(html);
      if (v.hd) out.hd = v.hd;
      if (v.sd) out.sd = v.sd;

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
