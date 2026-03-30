import { APP_PALETTE } from '../app/constants.js';
import {
  buildStatusMetricItems,
  renderStatusMetricLine
} from '../ui/status-metrics.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function parseBurndownDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatBurndownDate(dateKey, options) {
  return new Intl.DateTimeFormat(undefined, options).format(parseBurndownDate(dateKey));
}

function buildBurndownSeries(samples) {
  let completedMax = 0;
  let totalMax = 0;

  return samples.map((sample) => {
    const completed = sample.done + sample.cancelled;
    completedMax = Math.max(completedMax, completed);
    totalMax = Math.max(totalMax, sample.total, completedMax);

    return {
      ...sample,
      completed: completedMax,
      total: totalMax
    };
  });
}

function getBurndownTrend(samples, currentDone) {
  const previousSample = samples.length >= 2 ? samples[samples.length - 2] : null;
  if (!previousSample) {
    return { symbol: '→', tone: 'trend' };
  }

  const previousDone = previousSample.done + previousSample.cancelled;
  if (currentDone > previousDone) {
    return { symbol: '↑', tone: 'trend-up' };
  }

  if (currentDone < previousDone) {
    return { symbol: '↓', tone: 'trend-down' };
  }

  return { symbol: '→', tone: 'trend' };
}

function buildBurndownPath(points) {
  if (points.length === 0) {
    return '';
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    return `${path} H ${point.x} V ${point.y}`;
  }, '');
}

function buildBurndownAreaPath(upperPoints, lowerPoints) {
  if (upperPoints.length === 0 || lowerPoints.length === 0) {
    return '';
  }

  const upperPath = buildBurndownPath(upperPoints);
  const reversedLower = [...lowerPoints].reverse();
  const lowerPath = reversedLower.reduce((path, point, index) => {
    if (index === 0) {
      return `${path} L ${point.x} ${point.y}`;
    }

    return `${path} H ${point.x} V ${point.y}`;
  }, upperPath);
  return `${lowerPath} Z`;
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

export function createBurndownView({
  toggleEl,
  collapsedSummaryEl,
  panelEl,
  summaryHeadlineEl,
  emptyStateEl,
  chartEl,
  svgEl,
  tooltipEl,
  isMobileViewport,
  onToggle = () => {}
}) {
  function hideTooltip() {
    tooltipEl.hidden = true;
    tooltipEl.textContent = '';
    tooltipEl.style.left = '';
    tooltipEl.style.top = '';
  }

  function showTooltip(point, viewBoxWidth, viewBoxHeight) {
    tooltipEl.innerHTML = `
      <strong>${formatBurndownDate(point.date, { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
      <div>Done: ${point.completed}</div>
      <div>Total: ${point.total}</div>
    `;
    tooltipEl.hidden = false;

    const chartRect = chartEl.getBoundingClientRect();
    const x = (point.x / viewBoxWidth) * chartRect.width;
    const y = (Math.min(point.completedY, point.totalY) / viewBoxHeight) * chartRect.height;

    const tooltipWidth = tooltipEl.offsetWidth;
    const tooltipHeight = tooltipEl.offsetHeight;
    const left = Math.max(8, Math.min(chartRect.width - tooltipWidth - 8, x - (tooltipWidth / 2)));
    const top = Math.max(8, y - tooltipHeight - 12);

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function renderChart(series) {
    const mobile = isMobileViewport();
    const width = 640;
    const height = mobile ? 220 : 280;
    const margin = mobile
      ? { top: 20, right: 12, bottom: 34, left: 34 }
      : { top: 24, right: 20, bottom: 40, left: 42 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const maxY = Math.max(1, ...series.map(point => point.total));
    const tickCount = maxY >= 6 ? 4 : 3;
    const yTicks = [...new Set(
      Array.from({ length: tickCount }, (_, index) => Math.round((maxY / (tickCount - 1)) * index))
    )];
    const xLabelEvery = Math.max(1, Math.ceil(series.length / (mobile ? 3 : 6)));
    const shouldShowXAxisLabel = (index) => (
      index === 0
      || index === series.length - 1
      || index % xLabelEvery === 0
    );
    const getX = (index) => (
      series.length === 1
        ? margin.left + (chartWidth / 2)
        : margin.left + ((chartWidth * index) / (series.length - 1))
    );
    const getY = (value) => margin.top + chartHeight - ((value / maxY) * chartHeight);

    const totalPoints = series.map((point, index) => ({
      ...point,
      x: getX(index),
      y: getY(point.total)
    }));
    const completedPoints = series.map((point, index) => ({
      ...point,
      x: getX(index),
      y: getY(point.completed)
    }));

    svgEl.innerHTML = '';
    svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svgEl.setAttribute('role', 'img');
    svgEl.setAttribute('aria-label', 'Burndown chart showing done work versus total work over time');

    yTicks.forEach((tick) => {
      const y = getY(tick);
      svgEl.appendChild(createSvgElement('line', {
        x1: margin.left,
        y1: y,
        x2: width - margin.right,
        y2: y,
        stroke: '#e3e8ef',
        'stroke-width': 1
      }));

      const tickLabel = createSvgElement('text', {
        x: margin.left - 8,
        y: y + 4,
        'text-anchor': 'end',
        fill: '#7c8798',
        'font-size': mobile ? 10 : 11
      });
      tickLabel.textContent = String(tick);
      svgEl.appendChild(tickLabel);
    });

    svgEl.appendChild(createSvgElement('path', {
      d: buildBurndownAreaPath(totalPoints, completedPoints),
      fill: APP_PALETTE.BURNDOWN_GAP,
      stroke: 'none'
    }));

    svgEl.appendChild(createSvgElement('path', {
      d: buildBurndownPath(totalPoints),
      fill: 'none',
      stroke: APP_PALETTE.BURNDOWN_TOTAL,
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }));

    svgEl.appendChild(createSvgElement('path', {
      d: buildBurndownPath(completedPoints),
      fill: 'none',
      stroke: APP_PALETTE.BURNDOWN_COMPLETED,
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }));

    totalPoints.forEach((point, index) => {
      const completedPoint = completedPoints[index];

      svgEl.appendChild(createSvgElement('circle', {
        cx: point.x,
        cy: point.y,
        r: 3.5,
        fill: '#fff',
        stroke: APP_PALETTE.BURNDOWN_TOTAL,
        'stroke-width': 2
      }));

      svgEl.appendChild(createSvgElement('circle', {
        cx: completedPoint.x,
        cy: completedPoint.y,
        r: 3.5,
        fill: '#fff',
        stroke: APP_PALETTE.BURNDOWN_COMPLETED,
        'stroke-width': 2
      }));

      if (shouldShowXAxisLabel(index)) {
        const xAxisLabel = createSvgElement('text', {
          x: point.x,
          y: height - 10,
          'text-anchor': 'middle',
          fill: '#7c8798',
          'font-size': mobile ? 10 : 11
        });
        xAxisLabel.textContent = formatBurndownDate(point.date, mobile
          ? { month: 'numeric', day: 'numeric' }
          : { month: 'short', day: 'numeric' });
        svgEl.appendChild(xAxisLabel);
      }

      const hitTarget = createSvgElement('rect', {
        x: point.x - Math.max(18, chartWidth / Math.max(8, series.length * 2)),
        y: margin.top,
        width: Math.max(36, chartWidth / Math.max(4, series.length)),
        height: chartHeight,
        fill: 'transparent',
        tabindex: 0,
        'aria-label': `${formatBurndownDate(point.date, { month: 'short', day: 'numeric', year: 'numeric' })}: ${completedPoint.completed} done, ${point.total} total`
      });

      const tooltipPoint = {
        ...point,
        completed: completedPoint.completed,
        completedY: completedPoint.y,
        totalY: point.y
      };

      hitTarget.addEventListener('mouseenter', () => showTooltip(tooltipPoint, width, height));
      hitTarget.addEventListener('focus', () => showTooltip(tooltipPoint, width, height));
      hitTarget.addEventListener('mouseleave', hideTooltip);
      hitTarget.addEventListener('blur', hideTooltip);
      svgEl.appendChild(hitTarget);
    });
  }

  function update({ burndownData, progress, expanded }) {
    const series = buildBurndownSeries(burndownData);
    const trend = getBurndownTrend(burndownData, progress.done);
    const hasEnoughData = series.length >= 3;

    toggleEl.setAttribute('aria-expanded', String(expanded));
    renderStatusMetricLine(
      collapsedSummaryEl,
      buildStatusMetricItems(progress, { trend })
    );
    collapsedSummaryEl.hidden = expanded;
    panelEl.hidden = !expanded;
    renderStatusMetricLine(
      summaryHeadlineEl,
      buildStatusMetricItems(progress, { includeTotal: true })
    );

    emptyStateEl.hidden = hasEnoughData;
    chartEl.hidden = !hasEnoughData;

    if (expanded && hasEnoughData) {
      renderChart(series);
      return;
    }

    svgEl.innerHTML = '';
    hideTooltip();
  }

  function handleToggleClick() {
    onToggle();
  }

  toggleEl.addEventListener('click', handleToggleClick);
  svgEl.addEventListener('mouseleave', hideTooltip);

  return {
    hideTooltip,
    update,
    destroy() {
      toggleEl.removeEventListener('click', handleToggleClick);
      svgEl.removeEventListener('mouseleave', hideTooltip);
      svgEl.innerHTML = '';
      hideTooltip();
    }
  };
}
