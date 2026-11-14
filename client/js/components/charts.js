// ==========================================================
// NATIVE SVG CHARTS (Zero External Dependencies)
// ==========================================================

export function renderBarChart(container, items = [], options = {}) {
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No chart data available</div>';
    return;
  }

  const width = options.width || container.clientWidth || 500;
  const height = options.height || 260;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(...items.map((i) => Math.max(i.issues || 0, i.returns || 0, i.value || 0, 5)));
  const barGroupWidth = chartWidth / items.length;
  const barWidth = Math.max(8, barGroupWidth * 0.35);

  let barsHTML = '';
  items.forEach((item, idx) => {
    const x = padding.left + idx * barGroupWidth;
    const issues = item.issues || item.value || 0;
    const returns = item.returns || 0;

    const issuesHeight = (issues / maxVal) * chartHeight;
    const issuesY = padding.top + chartHeight - issuesHeight;

    barsHTML += `
      <!-- Issues bar -->
      <rect x="${x + barGroupWidth * 0.1}" y="${issuesY}" width="${barWidth}" height="${issuesHeight}" fill="var(--primary-500)" rx="4">
        <title>${item.date || item.label}: ${issues} Issues</title>
      </rect>
    `;

    if (item.returns !== undefined) {
      const returnsHeight = (returns / maxVal) * chartHeight;
      const returnsY = padding.top + chartHeight - returnsHeight;
      barsHTML += `
        <!-- Returns bar -->
        <rect x="${x + barGroupWidth * 0.1 + barWidth + 4}" y="${returnsY}" width="${barWidth}" height="${returnsHeight}" fill="var(--accent-500)" rx="4">
          <title>${item.date || item.label}: ${returns} Returns</title>
        </rect>
      `;
    }

    // Label
    barsHTML += `
      <text x="${x + barGroupWidth / 2}" y="${height - 15}" font-size="11" fill="var(--text-muted)" text-anchor="middle">
        ${item.date || item.label || ''}
      </text>
    `;
  });

  // Grid lines
  let gridHTML = '';
  for (let step = 0; step <= 4; step++) {
    const yVal = Math.round((maxVal / 4) * step);
    const yPos = padding.top + chartHeight - (step / 4) * chartHeight;
    gridHTML += `
      <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="var(--border-color)" stroke-dasharray="3" />
      <text x="${padding.left - 8}" y="${yPos + 4}" font-size="10" fill="var(--text-subtle)" text-anchor="end">${yVal}</text>
    `;
  }

  container.innerHTML = `
    <div style="display: flex; gap: 1rem; margin-bottom: 0.5rem; font-size: 0.75rem; justify-content: flex-end;">
      <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: var(--primary-500); border-radius: 2px;"></span> Issues</span>
      <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: var(--accent-500); border-radius: 2px;"></span> Returns</span>
    </div>
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
      ${gridHTML}
      ${barsHTML}
    </svg>
  `;
}

export function renderDonutChart(container, slices = []) {
  if (!container) return;
  if (!slices || slices.length === 0) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No category data available</div>';
    return;
  }

  const size = 200;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = slices.reduce((s, item) => s + (item.count || 0), 0) || 1;
  const colors = ['#6366f1', '#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#8b5cf6'];

  let accumulatedPercent = 0;
  let pathsHTML = '';
  let legendHTML = '';

  slices.forEach((slice, i) => {
    const count = slice.count || 0;
    const percent = count / total;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -(accumulatedPercent * circumference);
    const color = colors[i % colors.length];

    pathsHTML += `
      <circle
        cx="${size / 2}" cy="${size / 2}" r="${radius}"
        fill="transparent"
        stroke="${color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${strokeDasharray}"
        stroke-dashoffset="${strokeDashoffset}"
        transform="rotate(-90 ${size / 2} ${size / 2})"
      >
        <title>${slice.name || 'Category'}: ${count} books (${Math.round(percent * 100)}%)</title>
      </circle>
    `;

    legendHTML += `
      <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; margin-bottom: 0.35rem;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></span>
        <span style="flex-grow: 1; color: var(--text-main);">${slice.name}</span>
        <strong style="color: var(--text-muted);">${count}</strong>
      </div>
    `;

    accumulatedPercent += percent;
  });

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 2rem; flex-wrap: wrap;">
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          ${pathsHTML}
        </svg>
        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
          <span style="font-size: 1.4rem; font-weight: 700; color: var(--text-main);">${total}</span>
          <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Titles</span>
        </div>
      </div>
      <div style="min-width: 160px; max-width: 240px;">
        ${legendHTML}
      </div>
    </div>
  `;
}
