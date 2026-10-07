// Resolver Facebook
var CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

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

export default async function handler(req, res) {
  var target = "";
  try { target = (req.query.url || "").trim(); } catch (e) {}
  if (!target || !/(facebook\.com|fb\.watch)/i.test(target)) {
    res.status(400).json({ error: "URL tidak valid" });
    return;
  }
  try {
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
      res.json({ url: fin });
    } else {
      res.status(422).json({ error: "Tidak bisa resolve", finalUrl: fin });
    }
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
  }
}
