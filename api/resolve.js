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
    // pola: "ID":"https:\/\/scontent..."
    var re = /"(\d+)":"(https:\\\/\\\/scontent[^"]+)"/g, m;
    while ((m = re.exec(html)) && images.length < 20) {
      var u = m[2].replace(/\\\//g, "/");
      // filter: hanya gambar konten, bukan ikon/statis
      if (/scontent/i.test(u) && !/rsrc\.php/i.test(u) && images.indexOf(u) < 0) {
        images.push(u);
      }
    }
    if (images.length) {
      res.json({ images: images });
    } else {
      res.status(422).json({ error: "Tidak ada foto ditemukan" });
    }
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
  }
}
