const elements = {
  currentDateHeader: document.getElementById('currentDateHeader'),
  lastUpdatedBadge: document.getElementById('lastUpdatedBadge'),
  displayDateText: document.getElementById('displayDateText'),
  marqueeContainer: document.getElementById('marqueeContainer'),
  dataContent: document.getElementById('dataContent'),
  refreshBtnMain: document.getElementById('refreshBtnMain'),
  refreshIcon: document.getElementById('refreshIcon'),
  copyBtn: document.getElementById('copyBtn'),
};

const state = {
  payload: null,
  lastSignature: '',
  autoRefreshIntervalMs: 30000,
  autoRefreshHandle: null,
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getInitials(name) {
  return name
    .replace(/\[.*?\]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getTeamLogo(teamName) {
  const normalizedMap = {
    'Man City': 'Manchester City',
    'Man Utd': 'Manchester United',
    MU: 'Manchester United',
    Spurs: 'Tottenham',
    Inter: 'Inter Milan',
    Milan: 'AC Milan',
    Juve: 'Juventus',
    Barca: 'Barcelona',
    Madrid: 'Real Madrid',
    Atleti: 'Atletico Madrid',
  };

  const cleaned = normalizedMap[teamName] || teamName;
  return `https://www.thesportsdb.com/images/media/team/badge/small/${cleaned
    .trim()
    .replace(/\s+/g, '%20')}.png`;
}

function formatMatchCell(homeTeam, awayTeam, options = {}) {
  const home = escapeHtml(homeTeam);
  const away = escapeHtml(awayTeam);
  const homeInitial = escapeHtml(getInitials(homeTeam));
  const awayInitial = escapeHtml(getInitials(awayTeam));
  const withImages = Boolean(options.withImages);
  const homeLogo = escapeHtml(getTeamLogo(homeTeam));
  const awayLogo = escapeHtml(getTeamLogo(awayTeam));

  const homeIcon = withImages
    ? `
        <span style="display: flex;">${homeInitial}</span>
        <img src="${homeLogo}" alt="${home}" referrerpolicy="no-referrer" onload="this.style.display='block'; this.previousElementSibling.style.display='none';" onerror="this.style.display='none'; this.previousElementSibling.style.display='flex';" style="display: none;">
      `
    : `<span>${homeInitial}</span>`;

  const awayIcon = withImages
    ? `
        <span style="display: flex;">${awayInitial}</span>
        <img src="${awayLogo}" alt="${away}" referrerpolicy="no-referrer" onload="this.style.display='block'; this.previousElementSibling.style.display='none';" onerror="this.style.display='none'; this.previousElementSibling.style.display='flex';" style="display: none;">
      `
    : `<span>${awayInitial}</span>`;

  return `
    <div class="match-cell-content">
      <div class="team-wrapper home">
        <div class="team-icon">
          ${homeIcon}
        </div>
        <span class="team-name">${home}</span>
      </div>
      <span class="vs-badge">VS</span>
      <div class="team-wrapper away">
        <div class="team-icon">
          ${awayIcon}
        </div>
        <span class="team-name">${away}</span>
      </div>
    </div>
  `;
}

function formatScore(score) {
  const match = String(score).match(/(\d+)\s*:\s*(\d+)/);
  if (!match) {
    return `<span class="score-box">${escapeHtml(score)}</span>`;
  }

  return `
    <div class="score-container">
      <span class="score-box">${match[1]}</span>
      <span class="score-sep">:</span>
      <span class="score-box">${match[2]}</span>
    </div>
  `;
}

function buildTablesHtml(groups, options = {}) {
  if (!Array.isArray(groups) || !groups.length) return '';
  const withImages = Boolean(options.withImages);
  const leagueBreak = Boolean(options.leagueBreak);

  return groups
    .map(
      (league) => `
      <table class="league-table">
        <thead>
          <tr>
            <th colspan="3" class="league-name-header">
              <div class="league-header-container">
                <span class="league-title-text"><i class="ph-fill ph-trophy"></i> ${escapeHtml(league.name)}${leagueBreak ? '<br>' : ''}</span>
                <span class="league-badge">${league.matches.length} MATCHES</span>
              </div>
            </th>
          </tr>
          <tr>
            <th class="col-header date-col">Tanggal & Waktu</th>
            <th class="col-header match-col">Pertandingan</th>
            <th class="col-header score-col">Prediksi Skor</th>
          </tr>
        </thead>
        <tbody>
          ${league.matches
            .map(
              (match) => `
                <tr>
                  <td>${escapeHtml(match.date)} ${escapeHtml(match.time)}</td>
                  <td>${formatMatchCell(match.homeTeam, match.awayTeam, { withImages })}</td>
                  <td>${formatScore(match.score)}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `
    )
    .join('');
}

function renderLeagues(groups) {
  if (!Array.isArray(groups) || !groups.length) {
    elements.dataContent.innerHTML = `
      <div class="error-state">
        <i class="ph ph-warning-circle"></i>
        Data prediksi tidak ditemukan.
      </div>
    `;
    return;
  }

  elements.dataContent.innerHTML = buildTablesHtml(groups);
}

function getNowLabel() {
  const now = new Date();
  const time = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `Update: ${time.replace(':', '.')} WIB`;
}

function createPrediksiSignature(data) {
  const prediksi = data?.prediksi || [];
  const range = data?.meta?.prediksiRange || '';
  return JSON.stringify({ range, prediksi });
}

async function loadPrediksi(options = {}) {
  const silent = Boolean(options.silent);
  if (!silent) {
    elements.refreshIcon.classList.add('ph-spin');
    elements.lastUpdatedBadge.textContent = 'Menyingkronkan...';
  }

  try {
    const response = await fetch('/api/prediksi');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Gagal memuat data');
    }

    const nextSignature = createPrediksiSignature(data);
    const hasChanged = nextSignature !== state.lastSignature;

    state.payload = data;
    if (hasChanged || !state.lastSignature) {
      state.lastSignature = nextSignature;
      const displayRange = data.meta?.prediksiRange || '-';
      elements.currentDateHeader.textContent = displayRange;
      elements.displayDateText.textContent = `PREDIKSI BOLA ${displayRange}`;
      elements.marqueeContainer.innerHTML =
        '<p>SELAMAT DATANG DI PREDIKSI BOLA WDBOS! | SELALU UTAMAKAN PREDIKSI SENDIRI!</p>';
      renderLeagues(data.prediksi || []);
    }

    elements.lastUpdatedBadge.textContent = silent
      ? `${getNowLabel()} • Auto refresh aktif`
      : getNowLabel();
  } catch (error) {
    elements.dataContent.innerHTML = `
      <div class="error-state">
        <i class="ph ph-warning-circle"></i>
        ${escapeHtml(error.message)}
      </div>
    `;
    elements.lastUpdatedBadge.textContent = 'Gagal sinkronisasi';
  } finally {
    if (!silent) {
      elements.refreshIcon.classList.remove('ph-spin');
    }
  }
}

function getEmbedStyles() {
  return `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
@import url('https://unpkg.com/@phosphor-icons/web@2.0.3/src/fill/index.css');

.wdbos-wrapper * { box-sizing: border-box !important; -webkit-font-smoothing: antialiased; }
.wdbos-wrapper { background-color: #060b18 !important; padding: 30px 10px !important; font-family: 'Outfit', sans-serif !important; color: #ffffff !important; }
.wdbos-container { max-width: 1000px !important; margin: 0 auto !important; background: rgba(15, 23, 42, 0.95) !important; padding: 25px !important; border-radius: 24px !important; border: 1px solid rgba(255,255,255,0.1) !important; box-shadow: 0 40px 80px rgba(0,0,0,0.5) !important; position: relative; }
.wdbos-date { margin-bottom: 20px !important; font-size: 1.4rem !important; font-weight: 900 !important; color: #fff !important; text-align: center !important; text-transform: uppercase; letter-spacing: 1px; }
.wdbos-marquee { background: rgba(0, 0, 0, 0.2) !important; border: 1px solid rgba(255,255,255,0.05) !important; padding: 12px 0 !important; margin-bottom: 25px !important; overflow: hidden !important; white-space: nowrap !important; border-radius: 12px !important; }
.wdbos-marquee span { color: #c3ed07 !important; font-weight: 800 !important; font-size: 0.95rem !important; display: inline-block !important; padding-left: 100% !important; animation: wdbos-anim 20s linear infinite !important; text-transform: uppercase !important; }
@keyframes wdbos-anim { 0% { transform: translateX(0); } 100% { transform: translateX(-200%); } }
.league-table { width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; margin-bottom: 30px !important; background: #ffffff !important; border-radius: 20px !important; overflow: hidden !important; table-layout: fixed !important; border: 1px solid rgba(255,255,255,0.1) !important; box-shadow: 0 15px 35px rgba(0,0,0,0.3) !important; }
.league-name-header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%) !important; color: #fff !important; padding: 18px !important; text-align: center !important; border: none !important; }
.league-header-container { display: flex; align-items: center; justify-content: center; gap: 12px; }
.league-title-text { font-size: 1.1rem; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; display: flex; align-items: center; gap: 8px; }
.league-badge { background: rgba(255, 255, 255, 0.1); padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; color: #c3ed07; }
.col-header { background: #f8fafc !important; color: #2563eb !important; font-weight: 900 !important; font-size: 0.75rem !important; text-transform: uppercase !important; padding: 14px 10px !important; border-bottom: 1px solid rgba(0,0,0,0.1) !important; border-right: 1px solid rgba(0,0,0,0.05) !important; }
.col-header:last-child { border-right: none !important; }
.league-table td { background: #fff !important; color: #334155 !important; padding: 15px 8px !important; font-size: 0.9rem !important; font-weight: 600 !important; text-align: center !important; vertical-align: middle !important; border-bottom: 1px solid rgba(0,0,0,0.08) !important; border-right: 1px solid rgba(0,0,0,0.04) !important; }
.league-table td:last-child { border-right: none !important; }
.match-cell-content { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; }
.team-wrapper { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.team-wrapper.home { flex-direction: row-reverse; text-align: right; }
.team-icon { width: 32px; height: 32px; background: transparent; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; flex-shrink: 0; overflow: visible; position: relative; }
.team-icon span { width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.team-icon img { width: 100%; height: 100%; object-fit: contain; display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
.team-name { flex: 1; overflow-wrap: break-word; line-height: 1.2; font-weight: 700; }
.vs-badge { background: #f1f5f9; color: #64748b; padding: 4px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 900; min-width: 40px; border: 1px solid #e2e8f0; }
.score-container { display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; }
.score-box { background: #f0f7ff !important; color: #2563eb !important; padding: 6px 10px !important; border-radius: 8px !important; font-weight: 900 !important; font-size: 1.1rem !important; border: 1px solid #dbeafe !important; min-width: 40px !important; text-align: center !important; }
.score-sep { color: #2563eb !important; font-weight: 900 !important; opacity: 0.5 !important; }
@media (max-width: 768px) {
  .wdbos-wrapper { padding: 15px 5px !important; }
  .wdbos-container { padding: 8px !important; border-radius: 12px !important; width: 100% !important; }
  .league-table { table-layout: fixed !important; width: 100% !important; }
  .date-col { width: 15% !important; }
  .match-col { width: 70% !important; }
  .score-col { width: 15% !important; }
  .league-table td { padding: 10px 1px !important; font-size: 0.65rem !important; letter-spacing: -0.2px !important; }
  .score-container { gap: 3px !important; flex-direction: column !important; }
  .score-box { padding: 3px 5px !important; font-size: 0.8rem !important; min-width: 25px !important; }
  .score-sep { font-size: 0.7rem !important; }
  .league-table td:first-child { font-size: 0.58rem !important; line-height: 1 !important; word-break: break-all !important; padding-left: 2px !important; }
  .team-name { font-size: 0.68rem !important; font-weight: 800 !important; line-height: 1.1 !important; word-break: normal !important; overflow-wrap: break-word !important; }
  .vs-badge { min-width: 25px !important; padding: 2px 2px !important; font-size: 0.5rem !important; margin: 0 !important; transform: scale(0.9); }
  .match-cell-content { gap: 1px !important; }
  .team-wrapper { gap: 2px !important; }
  .team-icon { display: flex !important; width: 22px; height: 22px; font-size: 0.55rem; }
  .league-badge { display: none !important; }
  .league-title-text { font-size: 0.75rem !important; letter-spacing: 0.5px !important; }
  .league-name-header { padding: 10px 5px !important; }
}`;
}

function buildEmbedScript(title, marqueeText, groups) {
  const initialContent = buildTablesHtml(groups, { withImages: true, leagueBreak: true });
  const safeTitle = JSON.stringify(title);
  const safeMarquee = JSON.stringify(marqueeText);
  const safeContent = JSON.stringify(initialContent);

  return `<!-- START WDBOS PREMIUM JADWAL AUTO-REFRESH -->
<div id="wdbos-root" class="wdbos-wrapper">
    <div class="wdbos-container">
        <div id="wdbos-date" class="wdbos-date">${escapeHtml(title)}</div>
        <div class="wdbos-marquee">
            <span>${escapeHtml(marqueeText)}</span>
        </div>
        <div id="wdbos-content" class="wdbos-tables">
            ${initialContent}
        </div>
    </div>
</div>

<style>
${getEmbedStyles()}
</style>

<script>
(function () {
    var DATA_URL = 'https://shortq.xyz/prediksibola';
    var PROXIES = [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?url='
    ];
    var INITIAL_TITLE = ${safeTitle};
    var MARQUEE_TEXT = ${safeMarquee};
    var INITIAL_CONTENT = ${safeContent};

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getInitials(name) {
        return name
            .replace(/\\[.*?\\]/g, '')
            .trim()
            .split(/\\s+/)
            .slice(0, 2)
            .map(function (part) { return (part[0] || '').toUpperCase(); })
            .join('');
    }

    function getTeamLogo(teamName) {
        return 'https://www.thesportsdb.com/images/media/team/badge/small/' + teamName.trim().replace(/\\s+/g, '%20') + '.png';
    }

    function buildMatchCell(homeTeam, awayTeam) {
        var home = escapeHtml(homeTeam);
        var away = escapeHtml(awayTeam);
        var homeInitial = escapeHtml(getInitials(homeTeam));
        var awayInitial = escapeHtml(getInitials(awayTeam));
        var homeLogo = escapeHtml(getTeamLogo(homeTeam));
        var awayLogo = escapeHtml(getTeamLogo(awayTeam));

        return ''
            + '<div class="match-cell-content">'
            + '  <div class="team-wrapper home">'
            + '    <div class="team-icon">'
            + '      <span style="display: flex;">' + homeInitial + '</span>'
            + '      <img src="' + homeLogo + '" alt="' + home + '" referrerpolicy="no-referrer" onload="this.style.display=\\'block\\'; this.previousElementSibling.style.display=\\'none\\';" onerror="this.style.display=\\'none\\'; this.previousElementSibling.style.display=\\'flex\\';" style="display: none;">'
            + '    </div>'
            + '    <span class="team-name">' + home + '</span>'
            + '  </div>'
            + '  <span class="vs-badge">VS</span>'
            + '  <div class="team-wrapper away">'
            + '    <div class="team-icon">'
            + '      <span style="display: flex;">' + awayInitial + '</span>'
            + '      <img src="' + awayLogo + '" alt="' + away + '" referrerpolicy="no-referrer" onload="this.style.display=\\'block\\'; this.previousElementSibling.style.display=\\'none\\';" onerror="this.style.display=\\'none\\'; this.previousElementSibling.style.display=\\'flex\\';" style="display: none;">'
            + '    </div>'
            + '    <span class="team-name">' + away + '</span>'
            + '  </div>'
            + '</div>';
    }

    function buildScore(score) {
        var match = String(score).match(/(\\d+)\\s*:\\s*(\\d+)/);
        if (!match) {
            return '<span class="score-box">' + escapeHtml(score) + '</span>';
        }

        return ''
            + '<div class="score-container">'
            + '  <span class="score-box">' + match[1] + '</span>'
            + '  <span class="score-sep">:</span>'
            + '  <span class="score-box">' + match[2] + '</span>'
            + '</div>';
    }

    function buildTables(groups) {
        return groups.map(function (league) {
            var rows = league.matches.map(function (item) {
                return ''
                    + '<tr>'
                    + '  <td>' + escapeHtml(item.date) + ' ' + escapeHtml(item.time) + '</td>'
                    + '  <td>' + buildMatchCell(item.homeTeam, item.awayTeam) + '</td>'
                    + '  <td>' + buildScore(item.score) + '</td>'
                    + '</tr>';
            }).join('');

            return ''
                + '<table class="league-table">'
                + '  <thead>'
                + '    <tr>'
                + '      <th colspan="3" class="league-name-header">'
                + '        <div class="league-header-container">'
                + '          <span class="league-title-text"><i class="ph-fill ph-trophy"></i> ' + escapeHtml(league.name) + '<br></span>'
                + '          <span class="league-badge">' + league.matches.length + ' MATCHES</span>'
                + '        </div>'
                + '      </th>'
                + '    </tr>'
                + '    <tr>'
                + '      <th class="col-header date-col">Tanggal &amp; Waktu</th>'
                + '      <th class="col-header match-col">Pertandingan</th>'
                + '      <th class="col-header score-col">Prediksi Skor</th>'
                + '    </tr>'
                + '  </thead>'
                + '  <tbody>' + rows + '</tbody>'
                + '</table>';
        }).join('');
    }

    function parsePrediksi(rawHtml) {
        var doc = new DOMParser().parseFromString(rawHtml, 'text/html');
        var buttons = Array.prototype.slice.call(doc.querySelectorAll('button'));
        var prediksiButton = buttons.find(function (button) {
            return /PREDIKSI BOLA/i.test((button.textContent || '').trim());
        });
        var title = prediksiButton ? prediksiButton.textContent.replace(/\\s+/g, ' ').trim() : INITIAL_TITLE;
        var sectionHtml = '';

        if (prediksiButton) {
            var target = prediksiButton.getAttribute('data-target');
            if (target) {
                var section = doc.querySelector(target + ' .card-body');
                sectionHtml = section ? section.innerHTML : '';
            }
        }

        if (!sectionHtml) {
            var matchSection = rawHtml.match(/PREDIKSI BOLA[\\s\\S]*?<div class="card-body"[^>]*>([\\s\\S]*?)<\\/div>/i);
            sectionHtml = matchSection ? matchSection[1] : '';
        }

        var lines = sectionHtml
            .replace(/<br\\s*\\/?>/gi, '\\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .split('\\n')
            .map(function (line) { return line.replace(/\\s+/g, ' ').trim(); })
            .filter(Boolean);

        var groups = [];
        var currentLeague = null;
        var regex = /(\\d{2}\\/\\d{2})\\s+(\\d{2}:\\d{2})\\s+WIB\\s+(.+?)\\s+vs\\s+(.+?)\\s+(\\d+\\s*:\\s*\\d+)/i;

        lines.forEach(function (line) {
            var match = line.match(regex);
            if (match) {
                if (!currentLeague) {
                    currentLeague = { name: 'PREDIKSI BOLA', matches: [] };
                    groups.push(currentLeague);
                }

                currentLeague.matches.push({
                    date: match[1].trim(),
                    time: match[2].trim(),
                    homeTeam: match[3].trim(),
                    awayTeam: match[4].trim(),
                    score: match[5].replace(/\\s+/g, ' ').trim()
                });
            } else if (
                line.length > 3 &&
                line.length < 120 &&
                !/vs/i.test(line) &&
                !/PREDIKSI BOLA/i.test(line) &&
                !/\\d{2}\\/\\d{2}/.test(line)
            ) {
                currentLeague = { name: line.toUpperCase(), matches: [] };
                groups.push(currentLeague);
            }
        });

        groups = groups.filter(function (group) { return group.matches.length > 0; });
        return { title: title, groups: groups };
    }

    async function requestText(url) {
        var controller = new AbortController();
        var timeout = setTimeout(function () { controller.abort(); }, 12000);
        try {
            var response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!response.ok) throw new Error('Fetch gagal');
            return await response.text();
        } finally {
            clearTimeout(timeout);
        }
    }

    async function updatePrediksi() {
        for (var i = 0; i < PROXIES.length; i += 1) {
            try {
                var requestUrl = PROXIES[i] + encodeURIComponent(DATA_URL + '?t=' + Date.now());
                var rawText = await requestText(requestUrl);
                if (!rawText || rawText.length < 100) continue;

                var parsed = parsePrediksi(rawText);
                if (!parsed.groups.length) continue;

                var dateEl = document.getElementById('wdbos-date');
                var marqueeEl = document.querySelector('#wdbos-root .wdbos-marquee span');
                var contentEl = document.getElementById('wdbos-content');

                if (dateEl) dateEl.textContent = parsed.title || INITIAL_TITLE;
                if (marqueeEl) marqueeEl.textContent = MARQUEE_TEXT;
                if (contentEl) contentEl.innerHTML = buildTables(parsed.groups);
                return;
            } catch (error) {}
        }
    }

    var dateEl = document.getElementById('wdbos-date');
    var marqueeEl = document.querySelector('#wdbos-root .wdbos-marquee span');
    var contentEl = document.getElementById('wdbos-content');
    if (dateEl && !dateEl.textContent.trim()) dateEl.textContent = INITIAL_TITLE;
    if (marqueeEl && !marqueeEl.textContent.trim()) marqueeEl.textContent = MARQUEE_TEXT;
    if (contentEl && !contentEl.innerHTML.trim()) contentEl.innerHTML = INITIAL_CONTENT;

    updatePrediksi();
    setInterval(updatePrediksi, 30000);
})();
</script>
<!-- END WDBOS PREMIUM JADWAL -->`;
}

function copyGeneratedScript() {
  const title = elements.displayDateText.textContent.trim() || 'PREDIKSI BOLA';
  const marqueeText = elements.marqueeContainer.textContent.trim();
  const groups = state.payload?.prediksi || [];
  const finalScript = buildEmbedScript(title, marqueeText, groups);

  window.__lastCopiedScript = finalScript;

  navigator.clipboard.writeText(finalScript).then(() => {
    const original = elements.copyBtn.innerHTML;
    elements.copyBtn.innerHTML = '<i class="ph-bold ph-check"></i> BERHASIL DISALIN!';
    elements.copyBtn.style.background = '#10b981';
    setTimeout(() => {
      elements.copyBtn.innerHTML = original;
      elements.copyBtn.style.background = '#c3ed07';
    }, 1800);
  });
}

elements.refreshBtnMain.addEventListener('click', loadPrediksi);
elements.copyBtn.addEventListener('click', copyGeneratedScript);

loadPrediksi();
state.autoRefreshHandle = setInterval(() => {
  loadPrediksi({ silent: true });
}, state.autoRefreshIntervalMs);
