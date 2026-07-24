export function renderResults(results) {
  const { totalEstimate, bandStats, totalCorrect, totalAnswered, overallAccuracy, elapsedTime, benchmarks } = results;

  document.getElementById('total-estimate').textContent = totalEstimate.toLocaleString();
  document.getElementById('estimate-range').textContent = `Confidence range: ${Math.max(0, totalEstimate - 2000).toLocaleString()} - ${(totalEstimate + 2000).toLocaleString()}`;

  renderBandBreakdown(bandStats, document.getElementById('band-breakdown'));
  renderBenchmarks(benchmarks, totalEstimate, document.getElementById('benchmark-chart'));

  document.getElementById('stat-total').textContent = totalAnswered;
  document.getElementById('stat-correct').textContent = totalCorrect;
  document.getElementById('stat-accuracy').textContent = Math.round(overallAccuracy * 100) + '%';
  document.getElementById('stat-time').textContent = formatTime(elapsedTime);
}

function renderBandBreakdown(bandStats, container) {
  container.textContent = '';

  for (const stat of bandStats) {
    const row = document.createElement('div');
    row.className = 'band-row';

    const pct = stat.total > 0 ? stat.accuracy * 100 : 0;
    const colorClass = pct >= 70 ? 'high' : pct >= 40 ? 'medium' : 'low';

    const label = document.createElement('span');
    label.className = 'band-row-label';
    label.textContent = stat.label;

    const barContainer = document.createElement('div');
    barContainer.className = 'band-row-bar';
    const fill = document.createElement('div');
    fill.className = `band-row-fill ${colorClass}`;
    fill.style.width = `${pct}%`;
    barContainer.appendChild(fill);

    const score = document.createElement('span');
    score.className = 'band-row-score';
    score.textContent = `${stat.correct}/${stat.total} (~${stat.estimatedKnown.toLocaleString()})`;

    row.append(label, barContainer, score);
    container.appendChild(row);
  }
}

function renderBenchmarks(benchmarks, estimate, container) {
  container.textContent = '';

  const maxVal = Math.max(estimate, ...Object.values(benchmarks), 20000);

  for (const [name, value] of Object.entries(benchmarks)) {
    const row = document.createElement('div');
    row.className = 'benchmark-row';

    const barPct = (value / maxVal) * 100;
    const markerPct = Math.min((estimate / maxVal) * 100, 100);

    const label = document.createElement('span');
    label.className = 'benchmark-label';
    label.textContent = name;

    const barContainer = document.createElement('div');
    barContainer.className = 'benchmark-bar-container';
    const barFill = document.createElement('div');
    barFill.className = 'benchmark-bar-fill';
    barFill.style.width = `${barPct}%`;
    const marker = document.createElement('div');
    marker.className = 'benchmark-marker';
    marker.style.left = `calc(${markerPct}% - 1.5px)`;
    marker.title = `Your estimate: ${estimate.toLocaleString()}`;
    barContainer.append(barFill, marker);

    const val = document.createElement('span');
    val.className = 'benchmark-value';
    val.textContent = value.toLocaleString();

    row.append(label, barContainer, val);
    container.appendChild(row);
  }
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
