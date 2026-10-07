// Facebook Resolver Bypass
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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
      signal: AbortSignal.timeout(20000),
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });
    var html = await r.text();
    var images = [];
    function addUrl(u) {
      if (!u) return;
      u = u.replace(/\\\//g, "/").replace(/\\u00253A/g, ":").replace(/\\u00252F/g, "/");
      if (!/^https:\/\/scontent/i.test(u)) return;
      if (/rsrc\.php/i.test(u)) return;
      if (images.indexOf(u) < 0 && images.length < 20) images.push(u);
    }
    var m;
    // pola 1: "ID":"https:\/\/scontent..."
    var re1 = /"(\d{8,})"\s*:\s*"(https:[^"]*scontent[^"]*)"/g;
    while ((m = re1.exec(html))) addUrl(m[2]);
    // pola 2: URL scontent langsung (escape maupun tidak)
    var re2 = /https:(?:\\\/){2}scontent[^"\\\s]{10,200}/g;
    while ((m = re2.exec(html))) addUrl(m[0]);
    // pola 3: og:image bila scontent
    var re3 = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi;
    while ((m = re3.exec(html))) addUrl(m[1]);
    if (images.length) {
      res.json({ images: images });
    } else {
      res.status(422).json({ error: "Tidak ada foto ditemukan" });
    }
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
  }
}
