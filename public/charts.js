import { createEmptyStateElement } from "./empty-state.js";

const SVG_NS = "http://www.w3.org/2000/svg";

let chartSequence = 0;

export function renderAreaChart(container, dataset, options = {}) {
  renderLineLikeChart(container, dataset, { ...options, area: true });
}

export function renderLineChart(container, dataset, options = {}) {
  renderLineLikeChart(container, dataset, { ...options, area: false });
}

export function renderBarChart(container, dataset, options = {}) {
  if (!dataset?.length) {
    renderEmptyState(container, options.emptyText || "还没有足够数据");
    return;
  }

  const width = options.width || 820;
  const height = options.height || 320;
  const padding = mergePadding({ top: 18, right: 16, bottom: 38, left: 42 }, options.padding);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...dataset.map((item) => item.value), 1);
  const gap = options.barGap || 12;
  const barWidth = Math.max(18, (chartWidth - gap * (dataset.length - 1)) / dataset.length);
  const svg = createSvg(width, height, options.ariaLabel || "柱状图");
  const defs = createNode("defs");
  const gradientColor = options.accentColor || options.barColor || "#0ea5e9";
  const barFill = options.barColor || withAlpha(gradientColor, 0.24);
  const gradientId = createLinearGradient(defs, [
    { offset: "0%", color: gradientColor, opacity: 0.94 },
    { offset: "100%", color: barFill, opacity: 1 },
  ]);
  const bars = [];

  clearContainer(container);
  svg.appendChild(defs);
  drawGrid(svg, width, height, padding, {
    max: maxValue,
    min: 0,
    yFormatter: options.yFormatter,
    lines: options.gridLines ?? 2,
    gridColor: options.gridColor,
    baselineColor: options.baselineColor,
    axisClassName: options.axisClassName,
  });

  dataset.forEach((item, index) => {
    const value = Number.isFinite(item.value) ? item.value : 0;
    const x = padding.left + index * (barWidth + gap);
    const barHeight = (value / maxValue) * chartHeight;
    const y = height - padding.bottom - barHeight;
    const group = createNode("g");
    const radius = String(Math.min(14, Math.max(8, barWidth / 2)));
    const rect = createNode("rect");
    const sheen = createNode("rect");

    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(barWidth));
    rect.setAttribute("height", String(barHeight));
    rect.setAttribute("rx", radius);
    rect.setAttribute("fill", `url(#${gradientId})`);
    rect.setAttribute("opacity", "0.92");
    rect.setAttribute("stroke", withAlpha(gradientColor, 0.14));
    rect.setAttribute("stroke-width", "1");
    group.appendChild(rect);

    sheen.setAttribute("x", String(x));
    sheen.setAttribute("y", String(y));
    sheen.setAttribute("width", String(barWidth));
    sheen.setAttribute("height", String(Math.min(barHeight, 36)));
    sheen.setAttribute("rx", radius);
    sheen.setAttribute("fill", "rgba(255,255,255,0.24)");
    sheen.setAttribute("opacity", "0.7");
    group.appendChild(sheen);

    if (options.showValues !== false) {
      appendText(
        svg,
        x + barWidth / 2,
        y - 10,
        formatValue(value, options.yFormatter),
        "middle",
        options.valueClassName || "chart-value-soft"
      );
    }

    appendText(
      svg,
      x + barWidth / 2,
      height - 14,
      item.label,
      "middle",
      options.labelClassName || "chart-label"
    );

    svg.appendChild(group);
    bars.push({ group, rect, sheen, label: item.label, value, x: x + barWidth / 2, y });
  });

  container.appendChild(svg);

  if (options.tooltip !== false) {
    attachBarInteraction(container, bars, {
      width,
      height,
      accentColor: gradientColor,
      tooltipLabel: options.tooltipLabel,
      tooltipFormatter: options.tooltipFormatter,
      yFormatter: options.yFormatter,
    });
  }
}

function renderLineLikeChart(container, dataset, options = {}) {
  if (!dataset?.length) {
    renderEmptyState(container, options.emptyText || "还没有足够数据");
    return;
  }

  const width = options.width || 860;
  const height = options.height || 340;
  const padding = mergePadding({ top: 18, right: 16, bottom: 38, left: 46 }, options.padding);
  const values = dataset.map((item) => item.value).filter(Number.isFinite);
  const min = options.startAtZero ? 0 : Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const svg = createSvg(width, height, options.ariaLabel || "趋势图");
  const defs = createNode("defs");
  const lineColor = options.lineColor || "#0ea5e9";
  const lineWidth = String(options.lineWidth || 3);
  const smooth = options.smooth !== false;

  clearContainer(container);
  svg.appendChild(defs);
  drawGrid(svg, width, height, padding, {
    max,
    min,
    yFormatter: options.yFormatter,
    lines: options.gridLines ?? 3,
    gridColor: options.gridColor,
    baselineColor: options.baselineColor,
    axisClassName: options.axisClassName,
  });

  const points = dataset.map((item, index) => {
    const x = padding.left + (dataset.length === 1 ? chartWidth / 2 : (index / (dataset.length - 1)) * chartWidth);
    const y = padding.top + ((max - item.value) / range) * chartHeight;
    return { x, y, label: item.label, value: item.value };
  });

  const linePath = smooth ? toSmoothPath(points, options.tension) : toPath(points);

  if (options.area) {
    const area = createNode("path");
    const fillId = createLinearGradient(defs, [
      { offset: "0%", color: options.fillFrom || options.fillColor || withAlpha(lineColor, 0.26), opacity: 1 },
      { offset: "100%", color: options.fillTo || withAlpha(lineColor, 0.02), opacity: 1 },
    ]);
    const baselineY = height - padding.bottom;

    area.setAttribute("d", `${linePath} L ${points.at(-1).x} ${baselineY} L ${points[0].x} ${baselineY} Z`);
    area.setAttribute("fill", `url(#${fillId})`);
    svg.appendChild(area);
  }

  const glow = createNode("path");
  glow.setAttribute("d", linePath);
  glow.setAttribute("fill", "none");
  glow.setAttribute("stroke", withAlpha(lineColor, 0.14));
  glow.setAttribute("stroke-width", String((options.lineWidth || 3) + 5));
  glow.setAttribute("stroke-linecap", "round");
  glow.setAttribute("stroke-linejoin", "round");
  svg.appendChild(glow);

  const line = createNode("path");
  line.setAttribute("d", linePath);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", lineColor);
  line.setAttribute("stroke-width", lineWidth);
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  svg.appendChild(line);

  const interval = options.xLabelInterval || Math.max(1, Math.ceil(points.length / 5));

  points.forEach((point, index) => {
    const dot = createNode("circle");

    dot.setAttribute("cx", String(point.x));
    dot.setAttribute("cy", String(point.y));
    dot.setAttribute("r", index === points.length - 1 ? "4.8" : "3.6");
    dot.setAttribute("fill", "#ffffff");
    dot.setAttribute("stroke", options.dotColor || lineColor);
    dot.setAttribute("stroke-width", "2.4");
    svg.appendChild(dot);

    if (index % interval === 0 || index === points.length - 1) {
      appendText(svg, point.x, height - 14, point.label, "middle", options.labelClassName || "chart-label");
    }
  });

  if (options.showLastValue !== false) {
    const lastPoint = points.at(-1);
    appendText(
      svg,
      lastPoint.x,
      lastPoint.y - 12,
      formatValue(lastPoint.value, options.yFormatter),
      "middle",
      options.valueClassName || "chart-value"
    );
  }

  container.appendChild(svg);

  if (options.tooltip !== false) {
    attachLineInteraction(container, svg, points, {
      width,
      height,
      padding,
      lineColor,
      tooltipLabel: options.tooltipLabel,
      tooltipFormatter: options.tooltipFormatter,
      yFormatter: options.yFormatter,
    });
  }
}

function drawGrid(svg, width, height, padding, options = {}) {
  const lines = options.lines ?? 3;
  const min = options.min ?? 0;
  const max = options.max ?? 0;
  const baselineY = height - padding.bottom;

  for (let index = 0; index <= lines; index += 1) {
    const y = padding.top + ((height - padding.top - padding.bottom) / lines) * index;
    const value = max - ((max - min) / lines) * index;
    const isBaseline = index === lines;
    const grid = createNode("line");

    grid.setAttribute("x1", String(padding.left));
    grid.setAttribute("x2", String(width - padding.right));
    grid.setAttribute("y1", String(isBaseline ? baselineY : y));
    grid.setAttribute("y2", String(isBaseline ? baselineY : y));
    grid.setAttribute("stroke", isBaseline ? options.baselineColor || "rgba(148, 163, 184, 0.18)" : options.gridColor || "rgba(148, 163, 184, 0.1)");
    grid.setAttribute("stroke-width", isBaseline ? "1.3" : "1");

    if (!isBaseline) {
      grid.setAttribute("stroke-dasharray", "4 6");
    }

    svg.appendChild(grid);
    appendText(svg, padding.left - 10, y + 4, formatValue(value, options.yFormatter), "end", options.axisClassName || "chart-axis");
  }
}

function attachLineInteraction(container, svg, points, options) {
  const tooltip = createTooltip(container);
  const overlay = createNode("rect");
  const activeGroup = createNode("g");
  const crosshairX = createNode("line");
  const crosshairY = createNode("line");
  const halo = createNode("circle");
  const activeDot = createNode("circle");
  const strokeColor = withAlpha(options.lineColor, 0.22);

  overlay.setAttribute("x", String(options.padding.left));
  overlay.setAttribute("y", String(options.padding.top));
  overlay.setAttribute("width", String(options.width - options.padding.left - options.padding.right));
  overlay.setAttribute("height", String(options.height - options.padding.top - options.padding.bottom));
  overlay.setAttribute("fill", "transparent");
  overlay.style.pointerEvents = "all";

  [crosshairX, crosshairY].forEach((line) => {
    line.setAttribute("stroke", strokeColor);
    line.setAttribute("stroke-width", "1.25");
    line.setAttribute("stroke-dasharray", "4 6");
    line.setAttribute("opacity", "0");
    activeGroup.appendChild(line);
  });

  halo.setAttribute("r", "10");
  halo.setAttribute("fill", withAlpha(options.lineColor, 0.16));
  halo.setAttribute("opacity", "0");
  activeGroup.appendChild(halo);

  activeDot.setAttribute("r", "5.5");
  activeDot.setAttribute("fill", "#ffffff");
  activeDot.setAttribute("stroke", options.lineColor);
  activeDot.setAttribute("stroke-width", "3");
  activeDot.setAttribute("opacity", "0");
  activeGroup.appendChild(activeDot);

  svg.appendChild(activeGroup);
  svg.appendChild(overlay);

  const hide = () => {
    crosshairX.setAttribute("opacity", "0");
    crosshairY.setAttribute("opacity", "0");
    halo.setAttribute("opacity", "0");
    activeDot.setAttribute("opacity", "0");
    tooltip.hide();
  };

  const show = (point) => {
    crosshairX.setAttribute("x1", String(options.padding.left));
    crosshairX.setAttribute("x2", String(options.width - options.padding.right));
    crosshairX.setAttribute("y1", String(point.y));
    crosshairX.setAttribute("y2", String(point.y));
    crosshairX.setAttribute("opacity", "1");

    crosshairY.setAttribute("x1", String(point.x));
    crosshairY.setAttribute("x2", String(point.x));
    crosshairY.setAttribute("y1", String(options.padding.top));
    crosshairY.setAttribute("y2", String(options.height - options.padding.bottom));
    crosshairY.setAttribute("opacity", "1");

    halo.setAttribute("cx", String(point.x));
    halo.setAttribute("cy", String(point.y));
    halo.setAttribute("opacity", "1");

    activeDot.setAttribute("cx", String(point.x));
    activeDot.setAttribute("cy", String(point.y));
    activeDot.setAttribute("opacity", "1");

    tooltip.show({
      label: point.label,
      value: formatTooltipValue(point, options.tooltipFormatter, options.yFormatter),
      meta: options.tooltipLabel,
      accentColor: options.lineColor,
      x: point.x,
      y: point.y,
      chartWidth: options.width,
      chartHeight: options.height,
    });
  };

  const handlePointerMove = (event) => {
    const position = toViewBoxPoint(event, svg, options.width, options.height);
    const nearest = getNearestPoint(points, position.x);
    show(nearest);
  };

  overlay.addEventListener("pointerenter", handlePointerMove);
  overlay.addEventListener("pointermove", handlePointerMove);
  overlay.addEventListener("pointerleave", hide);
}

function attachBarInteraction(container, bars, options) {
  const tooltip = createTooltip(container);
  let activeBar = null;

  const resetBar = (bar) => {
    if (!bar) return;
    bar.group.removeAttribute("transform");
    bar.rect.setAttribute("opacity", "0.92");
    bar.rect.setAttribute("stroke", withAlpha(options.accentColor, 0.14));
    bar.rect.setAttribute("stroke-width", "1");
    bar.sheen.setAttribute("opacity", "0.7");
  };

  const activateBar = (bar) => {
    if (activeBar && activeBar !== bar) {
      resetBar(activeBar);
    }

    activeBar = bar;
    bar.group.setAttribute("transform", "translate(0 -2)");
    bar.rect.setAttribute("opacity", "1");
    bar.rect.setAttribute("stroke", withAlpha(options.accentColor, 0.32));
    bar.rect.setAttribute("stroke-width", "2");
    bar.sheen.setAttribute("opacity", "1");

    tooltip.show({
      label: bar.label,
      value: formatTooltipValue(bar, options.tooltipFormatter, options.yFormatter),
      meta: options.tooltipLabel,
      accentColor: options.accentColor,
      x: bar.x,
      y: bar.y,
      chartWidth: options.width,
      chartHeight: options.height,
    });
  };

  const hide = () => {
    resetBar(activeBar);
    activeBar = null;
    tooltip.hide();
  };

  bars.forEach((bar) => {
    bar.group.style.pointerEvents = "bounding-box";
    bar.group.addEventListener("pointerenter", () => activateBar(bar));
    bar.group.addEventListener("pointermove", () => activateBar(bar));
    bar.group.addEventListener("pointerleave", hide);
  });
}

function createTooltip(container) {
  const tooltip = document.createElement("div");
  const label = document.createElement("span");
  const value = document.createElement("strong");
  const meta = document.createElement("span");

  tooltip.className = "chart-tooltip";
  label.className = "chart-tooltip-label";
  value.className = "chart-tooltip-value";
  meta.className = "chart-tooltip-meta";

  tooltip.append(label, value, meta);
  container.appendChild(tooltip);

  return {
    show({ label: title, value: valueText, meta: metaText, accentColor, x, y, chartWidth, chartHeight }) {
      label.textContent = title;
      value.textContent = valueText;
      meta.textContent = metaText || "";
      meta.hidden = !metaText;
      tooltip.style.setProperty("--chart-tooltip-accent", accentColor || "#0ea5e9");
      tooltip.classList.add("show");
      positionTooltip(container, tooltip, x, y, chartWidth, chartHeight);
    },
    hide() {
      tooltip.classList.remove("show");
    },
  };
}

function positionTooltip(container, tooltip, x, y, chartWidth, chartHeight) {
  const width = container.clientWidth || chartWidth;
  const height = container.clientHeight || chartHeight;
  const pixelX = (x / chartWidth) * width;
  const pixelY = (y / chartHeight) * height;
  const margin = 8;
  const tooltipWidth = tooltip.offsetWidth || 120;
  const tooltipHeight = tooltip.offsetHeight || 56;
  let left = pixelX + 14;
  let top = pixelY - tooltipHeight - 12;

  if (left + tooltipWidth > width - margin) {
    left = pixelX - tooltipWidth - 14;
  }

  if (left < margin) {
    left = margin;
  }

  if (top < margin) {
    top = pixelY + 12;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function createSvg(width, height, ariaLabel) {
  const svg = createNode("svg");

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ariaLabel);
  return svg;
}

function createNode(tag) {
  return document.createElementNS(SVG_NS, tag);
}

function appendText(svg, x, y, text, anchor, className) {
  const node = createNode("text");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("text-anchor", anchor);
  node.setAttribute("class", className);
  node.textContent = text;
  svg.appendChild(node);
}

function createLinearGradient(defs, stops) {
  const gradient = createNode("linearGradient");
  const id = `chart-gradient-${chartSequence += 1}`;

  gradient.setAttribute("id", id);
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("x2", "0");
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("y2", "1");

  stops.forEach((stopConfig) => {
    const stop = createNode("stop");
    stop.setAttribute("offset", stopConfig.offset);
    stop.setAttribute("stop-color", stopConfig.color);

    if (typeof stopConfig.opacity === "number") {
      stop.setAttribute("stop-opacity", String(stopConfig.opacity));
    }

    gradient.appendChild(stop);
  });

  defs.appendChild(gradient);
  return id;
}

function formatTooltipValue(point, formatter, yFormatter) {
  if (typeof formatter === "function") {
    return formatter(point.value, point);
  }

  return formatValue(point.value, yFormatter);
}

function formatValue(value, formatter) {
  if (typeof formatter === "function") {
    return formatter(value);
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
}

function toPath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function toSmoothPath(points, tension = 0.18) {
  if (points.length < 3) {
    return toPath(points);
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] || current;
    const afterNext = points[index + 2] || next;
    const cp1x = current.x + (next.x - previous.x) * tension;
    const cp1y = current.y + (next.y - previous.y) * tension;
    const cp2x = next.x - (afterNext.x - current.x) * tension;
    const cp2y = next.y - (afterNext.y - current.y) * tension;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }

  return path;
}

function getNearestPoint(points, x) {
  return points.reduce((closest, point) => {
    if (!closest) return point;
    return Math.abs(point.x - x) < Math.abs(closest.x - x) ? point : closest;
  }, null);
}

function toViewBoxPoint(event, svg, width, height) {
  const bounds = svg.getBoundingClientRect();

  return {
    x: ((event.clientX - bounds.left) / bounds.width) * width,
    y: ((event.clientY - bounds.top) / bounds.height) * height,
  };
}

function withAlpha(color, alpha) {
  if (!color) {
    return `rgba(14, 165, 233, ${alpha})`;
  }

  if (color.startsWith("#")) {
    const normalized = color.length === 4
      ? color
          .slice(1)
          .split("")
          .map((char) => char + char)
          .join("")
      : color.slice(1, 7);
    const int = Number.parseInt(normalized, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const rgb = color.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const [r, g, b] = rgb[1].split(",").map((segment) => segment.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}

function mergePadding(base, override = {}) {
  return {
    top: override.top ?? base.top,
    right: override.right ?? base.right,
    bottom: override.bottom ?? base.bottom,
    left: override.left ?? base.left,
  };
}

function renderEmptyState(container, text) {
  clearContainer(container);
  const empty = document.createElement("div");
  empty.className = "chart-empty";
  empty.appendChild(
    createEmptyStateElement({
      title: "图表还没亮起来",
      copy: text,
      compact: true,
      branded: true,
    })
  );
  container.appendChild(empty);
}

function clearContainer(container) {
  container.innerHTML = "";
}
