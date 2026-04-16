const SVG_NS = "http://www.w3.org/2000/svg";

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

  const width = 820;
  const height = options.height || 320;
  const padding = { top: 18, right: 18, bottom: 48, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...dataset.map((item) => item.value), 1);
  const gap = 14;
  const barWidth = Math.max(18, (chartWidth - gap * (dataset.length - 1)) / dataset.length);
  const svg = createSvg(width, height);

  clearContainer(container);
  drawGrid(svg, width, height, padding, maxValue, options.yFormatter);
  drawBaseline(svg, width, height, padding);

  dataset.forEach((item, index) => {
    const x = padding.left + index * (barWidth + gap);
    const barHeight = (item.value / maxValue) * chartHeight;
    const y = height - padding.bottom - barHeight;

    const rect = createNode("rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(barWidth));
    rect.setAttribute("height", String(barHeight));
    rect.setAttribute("rx", "16");
    rect.setAttribute("fill", options.barColor || "#DDEFF3");
    svg.appendChild(rect);

    const top = createNode("rect");
    top.setAttribute("x", String(x));
    top.setAttribute("y", String(y));
    top.setAttribute("width", String(barWidth));
    top.setAttribute("height", String(Math.min(barHeight, 42)));
    top.setAttribute("rx", "16");
    top.setAttribute("fill", options.accentColor || "#F7D6E8");
    top.setAttribute("opacity", "0.95");
    svg.appendChild(top);

    appendText(
      svg,
      x + barWidth / 2,
      y - 10,
      formatValue(item.value, options.yFormatter),
      "middle",
      options.valueClassName || "chart-value"
    );
    appendText(
      svg,
      x + barWidth / 2,
      height - 16,
      item.label,
      "middle",
      options.labelClassName || "chart-label"
    );
  });

  container.appendChild(svg);
}

function renderLineLikeChart(container, dataset, options = {}) {
  if (!dataset?.length) {
    renderEmptyState(container, options.emptyText || "还没有足够数据");
    return;
  }

  const width = 860;
  const height = options.height || 340;
  const padding = { top: 20, right: 20, bottom: 48, left: 48 };
  const values = dataset.map((item) => item.value).filter(Number.isFinite);
  const min = options.startAtZero ? 0 : Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const svg = createSvg(width, height);

  clearContainer(container);
  drawGrid(svg, width, height, padding, max, options.yFormatter, min);
  drawBaseline(svg, width, height, padding);

  const points = dataset.map((item, index) => {
    const x = padding.left + (dataset.length === 1 ? chartWidth / 2 : (index / (dataset.length - 1)) * chartWidth);
    const y = padding.top + ((max - item.value) / range) * chartHeight;
    return { x, y, label: item.label, value: item.value };
  });

  if (options.area) {
    const areaPath = [
      `M ${points[0].x} ${height - padding.bottom}`,
      ...points.map((point) => `L ${point.x} ${point.y}`),
      `L ${points.at(-1).x} ${height - padding.bottom}`,
      "Z",
    ].join(" ");
    const area = createNode("path");
    area.setAttribute("d", areaPath);
    area.setAttribute("fill", options.fillColor || "rgba(221, 243, 245, 0.92)");
    svg.appendChild(area);
  }

  const line = createNode("path");
  line.setAttribute("d", toPath(points));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", options.lineColor || "#7EC7D0");
  line.setAttribute("stroke-width", "4");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  svg.appendChild(line);

  const interval = Math.max(1, Math.ceil(points.length / 6));
  points.forEach((point, index) => {
    const dot = createNode("circle");
    dot.setAttribute("cx", String(point.x));
    dot.setAttribute("cy", String(point.y));
    dot.setAttribute("r", index === points.length - 1 ? "5" : "4");
    dot.setAttribute("fill", "#ffffff");
    dot.setAttribute("stroke", options.dotColor || "#F2BFD6");
    dot.setAttribute("stroke-width", "3");
    svg.appendChild(dot);

    if (index % interval === 0 || index === points.length - 1) {
      appendText(svg, point.x, height - 16, point.label, "middle", "chart-label");
    }
  });

  const lastPoint = points.at(-1);
  appendText(
    svg,
    lastPoint.x,
    lastPoint.y - 12,
    formatValue(lastPoint.value, options.yFormatter),
    "middle",
    options.valueClassName || "chart-value"
  );

  container.appendChild(svg);
}

function drawGrid(svg, width, height, padding, max, yFormatter, min = 0) {
  const lines = 4;

  for (let index = 0; index <= lines; index += 1) {
    const y = padding.top + ((height - padding.top - padding.bottom) / lines) * index;
    const value = max - ((max - min) / lines) * index;

    const grid = createNode("line");
    grid.setAttribute("x1", String(padding.left));
    grid.setAttribute("x2", String(width - padding.right));
    grid.setAttribute("y1", String(y));
    grid.setAttribute("y2", String(y));
    grid.setAttribute("stroke", "#EAECEF");
    grid.setAttribute("stroke-width", "1");
    svg.appendChild(grid);

    appendText(svg, padding.left - 12, y + 4, formatValue(value, yFormatter), "end", "chart-axis");
  }
}

function drawBaseline(svg, width, height, padding) {
  const base = createNode("line");
  base.setAttribute("x1", String(padding.left));
  base.setAttribute("x2", String(width - padding.right));
  base.setAttribute("y1", String(height - padding.bottom));
  base.setAttribute("y2", String(height - padding.bottom));
  base.setAttribute("stroke", "#EAECEF");
  base.setAttribute("stroke-width", "1.5");
  svg.appendChild(base);
}

function createSvg(width, height) {
  const svg = createNode("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "趋势图");
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

function renderEmptyState(container, text) {
  clearContainer(container);
  const empty = document.createElement("div");
  empty.className = "chart-empty";
  empty.textContent = text;
  container.appendChild(empty);
}

function clearContainer(container) {
  container.innerHTML = "";
}
