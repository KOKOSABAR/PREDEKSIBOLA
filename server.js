const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = process.env.PORT || 5173;
const SOURCE_URL = 'https://shortq.xyz/prediksibola';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data, null, 2));
}

function cleanLeague(text) {
  return text.replace(/\s+/g, ' ').trim().replace(/^[-:|]+|[-:|]+$/g, '').trim();
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ \n/g, '\n')
    .trim();
}

function extractAccordionSection(html, title) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `${escapedTitle}\\s*</button>[\\s\\S]*?<div class="card-body"[^>]*>([\\s\\S]*?)</div>`,
    'i'
  );
  const match = html.match(regex);
  return match ? stripHtml(match[1]) : '';
}

function parseMatches(sectionText) {
  const matchRegex =
    /(\d{2}\/\d{2})\s+(\d{2}:\d{2})\s+WIB\s+(.+?)\s+vs\s+(.+?)\s+([0-9]+(?:\s+[0-9]\/[0-9])?\s*:\s*[0-9]+(?:\s+[0-9]\/[0-9])?)/g;

  const leagues = [];
  let currentLeague = 'LIGA LAINNYA';
  let cursor = 0;
  let match;

  while ((match = matchRegex.exec(sectionText)) !== null) {
    const [raw, date, time, homeTeam, awayTeam, score] = match;
    const leadSegment = cleanLeague(sectionText.slice(cursor, match.index));
    if (leadSegment) {
      currentLeague = leadSegment;
    }

    let leagueGroup = leagues.find((l) => l.name === currentLeague);
    if (!leagueGroup) {
      leagueGroup = { name: currentLeague, matches: [] };
      leagues.push(leagueGroup);
    }

    leagueGroup.matches.push({
      date,
      time,
      timezone: 'WIB',
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      score: score.replace(/\s+/g, ' ').trim(),
    });

    cursor = match.index + raw.length;
  }

  return leagues;
}

function parsePrediksiText(rawText) {
  const normalized = rawText.replace(/\r/g, '');
  const updateMatch =
    normalized.match(/<meta[^>]+description[^>]+content="([^"]+)"/i) ||
    normalized.match(/Update[^<\n]*/i);
  const jadwalTitleMatch = normalized.match(/JADWAL BOLA\s+\d{2}\s*-\s*\d{2}\s+\w+\s+\d{4}/i);
  const prediksiTitleMatch = normalized.match(/PREDIKSI BOLA\s+\d{2}\s*-\s*\d{2}\s+\w+\s+\d{4}/i);

  const jadwalRange = jadwalTitleMatch?.[0]?.replace(/JADWAL BOLA\s+/i, '').trim() ?? '';
  const prediksiRange = prediksiTitleMatch?.[0]?.replace(/PREDIKSI BOLA\s+/i, '').trim() ?? '';
  const jadwalBody = extractAccordionSection(normalized, jadwalTitleMatch?.[0] ?? 'JADWAL BOLA');
  const prediksiBody = extractAccordionSection(normalized, prediksiTitleMatch?.[0] ?? 'PREDIKSI BOLA');

  return {
    meta: {
      source: SOURCE_URL,
      updatedLabel:
        (updateMatch?.[1] || updateMatch?.[0] || 'Update tidak ditemukan').trim(),
      jadwalRange,
      prediksiRange,
    },
    jadwal: parseMatches(jadwalBody),
    prediksi: parseMatches(prediksiBody),
    raw: normalized,
  };
}

async function fetchPrediksiData() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Gagal mengambil data (${response.status})`);
  }

  const text = await response.text();
  return parsePrediksiText(text);
}

function serveStaticFile(req, res) {
  const relativePath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(__dirname, 'public', safePath);

  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File tidak ditemukan');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (req.url === '/api/prediksi') {
    try {
      const payload = await fetchPrediksiData();
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, {
        error: error.message || 'Terjadi kesalahan saat mengambil data',
      });
    }
    return;
  }

  serveStaticFile(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Dashboard aktif di http://${HOST}:${PORT}`);
});
