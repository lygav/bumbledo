import dagre from 'dagre';

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_WIDTH = 168;
const NODE_HEIGHT = 44;
const LABEL_LIMIT = 24;
const MAX_FIT_SCALE = 1.25;
const MIN_FIT_SCALE = 0.75;

function truncateLabel(text, limit = LABEL_LIMIT) {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function titleCaseStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
  return element;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function detectCycleEdgeIds(nodes, edges) {
  const nodeOrder = new Map(nodes.map((node) => [node.id, node.orderIndex]));
  const adjacency = new Map(nodes.map((node) => [node.id, []]));

  edges.forEach((edge) => {
    if (adjacency.has(edge.from)) {
      adjacency.get(edge.from).push(edge);
    }
  });

  adjacency.forEach((list) => {
    list.sort((a, b) => (nodeOrder.get(a.to) ?? 0) - (nodeOrder.get(b.to) ?? 0));
  });

  const visitState = new Map();
  const parentNode = new Map();
  const parentEdge = new Map();
  const cycleIds = new Set();

  function markCycle(startId, targetId, edgeId) {
    cycleIds.add(edgeId);

    let cursor = startId;
    while (cursor !== targetId && parentNode.has(cursor)) {
      const parentEdgeId = parentEdge.get(cursor);
      if (parentEdgeId) {
        cycleIds.add(parentEdgeId);
      }
      cursor = parentNode.get(cursor);
    }
  }

  function dfs(nodeId) {
    visitState.set(nodeId, 1);

    (adjacency.get(nodeId) ?? []).forEach((edge) => {
      const nextState = visitState.get(edge.to) ?? 0;

      if (nextState === 0) {
        parentNode.set(edge.to, nodeId);
        parentEdge.set(edge.to, edge.id);
        dfs(edge.to);
        return;
      }

      if (nextState === 1) {
        markCycle(nodeId, edge.to, edge.id);
      }
    });

    visitState.set(nodeId, 2);
  }

  [...adjacency.keys()]
    .sort((a, b) => (nodeOrder.get(a) ?? 0) - (nodeOrder.get(b) ?? 0))
    .forEach((nodeId) => {
      if ((visitState.get(nodeId) ?? 0) === 0) {
        dfs(nodeId);
      }
    });

  return cycleIds;
}

function layoutGraph(graphModel) {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: 'LR',
    ranksep: 92,
    nodesep: 28,
    marginx: 36,
    marginy: 28
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const sortedNodes = [...graphModel.nodes].sort((a, b) => a.orderIndex - b.orderIndex);
  sortedNodes.forEach((node) => {
    graph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT
    });
  });

  const cycleIds = new Set(graphModel.cycleEdges.map((edge) => edge.id));
  graphModel.edges
    .filter((edge) => !cycleIds.has(edge.id))
    .forEach((edge) => {
      graph.setEdge(edge.from, edge.to);
    });

  dagre.layout(graph);

  return sortedNodes.map((node, index) => {
    const laidOutNode = graph.node(node.id);
    return {
      ...node,
      x: laidOutNode?.x ?? 72 + index * (NODE_WIDTH + 24),
      y: laidOutNode?.y ?? 72,
      width: NODE_WIDTH,
      height: NODE_HEIGHT
    };
  });
}

function getStatusPalette(status) {
  if (status === 'blocked') {
    return {
      fill: '#fffbf0',
      border: '#e6d5b8',
      accent: '#e67e22',
      text: '#1a1a1a',
      opacity: '1',
      strike: null
    };
  }

  if (status === 'done') {
    return {
      fill: '#ffffff',
      border: '#c8c8c8',
      accent: null,
      text: '#1a1a1a',
      opacity: '0.6',
      strike: '#999999'
    };
  }

  if (status === 'cancelled') {
    return {
      fill: '#ffffff',
      border: '#d7a8a3',
      accent: null,
      text: '#c0392b',
      opacity: '0.5',
      strike: '#c0392b'
    };
  }

  return {
    fill: '#ffffff',
    border: '#e0e0e0',
    accent: null,
    text: '#1a1a1a',
    opacity: '1',
    strike: null
  };
}

function buildEdgePath(source, target, isCycle) {
  const startX = source.x + source.width / 2;
  const startY = source.y;
  const endX = target.x - target.width / 2;
  const endY = target.y;
  const deltaX = endX - startX;

  if (!isCycle && deltaX >= 0) {
    const controlOffset = Math.max(36, deltaX * 0.45);
    return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
  }

  const arcHeight = Math.max(56, Math.abs(endY - startY) + 48);
  const controlOffset = Math.max(64, Math.abs(deltaX) * 0.55 + 28);
  const direction = startY <= endY ? -1 : 1;
  return `M ${startX} ${startY} C ${startX + controlOffset} ${startY + direction * arcHeight}, ${endX - controlOffset} ${endY + direction * arcHeight}, ${endX} ${endY}`;
}

export function buildDependencyGraph(todos) {
  const nodes = todos.map((todo, orderIndex) => ({
    id: todo.id,
    label: todo.text,
    status: todo.status,
    orderIndex
  }));

  const knownIds = new Set(nodes.map((node) => node.id));
  const edges = [];

  todos.forEach((todo) => {
    if (!Array.isArray(todo.blockedBy)) {
      return;
    }

    todo.blockedBy.forEach((blockerId, blockerIndex) => {
      if (!knownIds.has(blockerId)) {
        return;
      }

      edges.push({
        id: `${blockerId}->${todo.id}:${blockerIndex}`,
        from: blockerId,
        to: todo.id
      });
    });
  });

  const cycleIds = detectCycleEdgeIds(nodes, edges);
  const cycleEdges = edges.filter((edge) => cycleIds.has(edge.id));

  return {
    nodes,
    edges,
    hasDependencies: edges.length > 0,
    cycleEdges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      cycleCount: cycleEdges.length
    }
  };
}

export function createDagView({ container, onSelectTask, emptyStateElement }) {
  const warning = document.createElement('div');
  warning.className = 'dag-warning';
  warning.hidden = true;

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'dag-reset-button';
  resetButton.textContent = 'Reset view';

  const tooltip = document.createElement('div');
  tooltip.className = 'dag-tooltip';
  tooltip.hidden = true;

  const svg = createSvgElement('svg', {
    class: 'dag-svg',
    viewBox: '0 0 800 280',
    'aria-hidden': 'true'
  });

  const defs = createSvgElement('defs');
  defs.innerHTML = `
    <marker id="dag-arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#9aa1aa"></path>
    </marker>
    <marker id="dag-arrow-highlight" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#4a90d9"></path>
    </marker>
    <marker id="dag-arrow-cycle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#d64541"></path>
    </marker>
  `;

  const surface = createSvgElement('g', { class: 'dag-surface' });
  const edgeLayer = createSvgElement('g', { class: 'dag-edges' });
  const nodeLayer = createSvgElement('g', { class: 'dag-nodes' });
  surface.append(edgeLayer, nodeLayer);
  svg.append(defs, surface);

  container.innerHTML = '';
  container.append(warning, resetButton, svg, tooltip);

  const transform = { scale: 1, x: 0, y: 0 };
  const dragState = { active: false, pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0 };

  let currentGraph = buildDependencyGraph([]);
  let currentLayout = [];
  let hoveredTaskId = null;
  let selectedTaskId = null;
  let focusedTaskId = null;
  let nodeElements = new Map();
  let edgeElements = new Map();
  let edgeLookup = new Map();

  function getViewportSize() {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 280;
    return { width, height };
  }

  function applyTransform() {
    surface.setAttribute('transform', `matrix(${transform.scale} 0 0 ${transform.scale} ${transform.x} ${transform.y})`);
  }

  function positionTooltip(nodeId, nodeElement) {
    const node = currentLayout.find((entry) => entry.id === nodeId);
    if (!node || !nodeElement) {
      tooltip.hidden = true;
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const nodeRect = nodeElement.getBoundingClientRect();
    const top = nodeRect.top - containerRect.top - tooltip.offsetHeight - 10;
    const left = nodeRect.left - containerRect.left + nodeRect.width / 2 - tooltip.offsetWidth / 2;
    const maxLeft = Math.max(8, container.clientWidth - tooltip.offsetWidth - 8);

    tooltip.style.left = `${clamp(left, 8, maxLeft)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function showTooltip(nodeId, nodeElement) {
    const node = currentGraph.nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      hideTooltip();
      return;
    }

    tooltip.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = node.label;
    const status = document.createElement('span');
    status.textContent = `Status: ${titleCaseStatus(node.status)}`;
    tooltip.append(title, status);
    tooltip.hidden = false;
    positionTooltip(nodeId, nodeElement);
  }

  function applyHighlightState() {
    const activeId = hoveredTaskId || focusedTaskId || selectedTaskId;
    const connectedNodeIds = new Set();
    const shouldDim = Boolean(activeId) && currentGraph.stats.edgeCount > 4;

    edgeElements.forEach((path, edgeId) => {
      const edge = edgeLookup.get(edgeId);
      const isConnected = Boolean(activeId) && (edge.from === activeId || edge.to === activeId);
      const isCycle = currentGraph.cycleEdges.some((cycleEdge) => cycleEdge.id === edgeId);

      if (isConnected) {
        connectedNodeIds.add(edge.from);
        connectedNodeIds.add(edge.to);
      }

      path.classList.toggle('is-highlighted', isConnected);
      path.classList.toggle('is-cycle', isCycle);
      path.classList.toggle('is-dimmed', shouldDim && !isConnected);
      path.setAttribute('marker-end', isCycle ? 'url(#dag-arrow-cycle)' : isConnected ? 'url(#dag-arrow-highlight)' : 'url(#dag-arrow-default)');
    });

    nodeElements.forEach((group, nodeId) => {
      const isSelected = nodeId === selectedTaskId;
      const isConnected = connectedNodeIds.has(nodeId) || nodeId === activeId;
      const isFocused = nodeId === focusedTaskId;

      group.classList.toggle('is-selected', isSelected);
      group.classList.toggle('is-connected', Boolean(activeId) && isConnected);
      group.classList.toggle('is-dimmed', shouldDim && !isConnected);
      group.classList.toggle('is-focused', isFocused);
    });
  }

  function resetView() {
    const { width, height } = getViewportSize();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    if (currentLayout.length === 0) {
      transform.scale = 1;
      transform.x = 0;
      transform.y = 0;
      applyTransform();
      return;
    }

    const bounds = currentLayout.reduce((acc, node) => {
      acc.minX = Math.min(acc.minX, node.x - node.width / 2);
      acc.maxX = Math.max(acc.maxX, node.x + node.width / 2);
      acc.minY = Math.min(acc.minY, node.y - node.height / 2);
      acc.maxY = Math.max(acc.maxY, node.y + node.height / 2);
      return acc;
    }, {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    });

    const paddedWidth = bounds.maxX - bounds.minX + 72;
    const paddedHeight = bounds.maxY - bounds.minY + 64;
    const scale = clamp(Math.min(width / paddedWidth, height / paddedHeight), MIN_FIT_SCALE, MAX_FIT_SCALE);

    transform.scale = scale;
    transform.x = (width - paddedWidth * scale) / 2 - (bounds.minX - 36) * scale;
    transform.y = (height - paddedHeight * scale) / 2 - (bounds.minY - 32) * scale;
    applyTransform();
  }

  function renderGraph() {
    nodeLayer.replaceChildren();
    edgeLayer.replaceChildren();
    nodeElements = new Map();
    edgeElements = new Map();
    edgeLookup = new Map(currentGraph.edges.map((edge) => [edge.id, edge]));

    currentLayout = layoutGraph(currentGraph);
    const layoutMap = new Map(currentLayout.map((node) => [node.id, node]));
    const cycleIds = new Set(currentGraph.cycleEdges.map((edge) => edge.id));

    currentGraph.edges.forEach((edge) => {
      const source = layoutMap.get(edge.from);
      const target = layoutMap.get(edge.to);
      if (!source || !target) {
        return;
      }

      const path = createSvgElement('path', {
        class: 'dag-edge-path',
        d: buildEdgePath(source, target, cycleIds.has(edge.id)),
        'data-edge-id': edge.id,
        fill: 'none'
      });
      edgeElements.set(edge.id, path);
      edgeLayer.appendChild(path);
    });

    currentLayout.forEach((node) => {
      const group = createSvgElement('g', {
        class: 'dag-node',
        transform: `translate(${node.x - node.width / 2} ${node.y - node.height / 2})`,
        tabindex: '0',
        role: 'button',
        'aria-label': `${node.label}. ${titleCaseStatus(node.status)} task.`
      });

      const palette = getStatusPalette(node.status);
      const outline = createSvgElement('rect', {
        class: 'dag-node-outline',
        x: -2,
        y: -2,
        width: node.width + 4,
        height: node.height + 4,
        rx: 10,
        ry: 10
      });
      const body = createSvgElement('rect', {
        class: 'dag-node-body',
        x: 0,
        y: 0,
        width: node.width,
        height: node.height,
        rx: 8,
        ry: 8,
        fill: palette.fill,
        stroke: palette.border
      });

      group.append(outline, body);

      if (palette.accent) {
        const accent = createSvgElement('rect', {
          class: 'dag-node-accent',
          x: 0,
          y: 0,
          width: 6,
          height: node.height,
          rx: 8,
          ry: 8,
          fill: palette.accent
        });
        group.appendChild(accent);
      }

      const text = createSvgElement('text', {
        class: 'dag-node-label',
        x: palette.accent ? 18 : 14,
        y: 26,
        fill: palette.text,
        'fill-opacity': palette.opacity
      });
      text.textContent = truncateLabel(node.label);
      group.appendChild(text);

      if (palette.strike) {
        const strike = createSvgElement('line', {
          class: 'dag-node-strike',
          x1: palette.accent ? 18 : 14,
          x2: node.width - 14,
          y1: 22,
          y2: 22,
          stroke: palette.strike,
          'stroke-opacity': palette.opacity
        });
        group.appendChild(strike);
      }

      group.addEventListener('click', () => {
        onSelectTask(node.id);
      });

      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectTask(node.id);
        }
      });

      group.addEventListener('pointerenter', () => {
        hoveredTaskId = node.id;
        showTooltip(node.id, group);
        applyHighlightState();
      });

      group.addEventListener('pointerleave', () => {
        if (hoveredTaskId === node.id) {
          hoveredTaskId = null;
        }
        hideTooltip();
        applyHighlightState();
      });

      group.addEventListener('focus', () => {
        focusedTaskId = node.id;
        showTooltip(node.id, group);
        applyHighlightState();
      });

      group.addEventListener('blur', () => {
        if (focusedTaskId === node.id) {
          focusedTaskId = null;
        }
        hideTooltip();
        applyHighlightState();
      });

      nodeElements.set(node.id, group);
      nodeLayer.appendChild(group);
    });

    warning.hidden = currentGraph.cycleEdges.length === 0;
    warning.textContent = currentGraph.cycleEdges.length === 0
      ? ''
      : 'Dependency cycle detected. Layout is approximate until the cycle is removed.';
    resetButton.hidden = currentGraph.nodes.length === 0;

    if (emptyStateElement) {
      emptyStateElement.hidden = currentGraph.hasDependencies;
    }

    resetView();
    applyHighlightState();
  }

  function onPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;
    if (target?.closest?.('.dag-node')) {
      return;
    }

    dragState.active = true;
    dragState.pointerId = event.pointerId;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;
    dragState.originX = transform.x;
    dragState.originY = transform.y;
    svg.classList.add('is-panning');
    hideTooltip();
    svg.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragState.active || event.pointerId !== dragState.pointerId) {
      return;
    }

    transform.x = dragState.originX + (event.clientX - dragState.startX);
    transform.y = dragState.originY + (event.clientY - dragState.startY);
    applyTransform();
  }

  function endPointerDrag(event) {
    if (!dragState.active || event.pointerId !== dragState.pointerId) {
      return;
    }

    dragState.active = false;
    dragState.pointerId = null;
    svg.classList.remove('is-panning');
    svg.releasePointerCapture?.(event.pointerId);
  }

  resetButton.addEventListener('click', resetView);
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', endPointerDrag);
  svg.addEventListener('pointercancel', endPointerDrag);
  svg.addEventListener('pointerleave', (event) => {
    if (dragState.active) {
      endPointerDrag(event);
    }
  });

  return {
    update({ todos, selectedTaskId: nextSelectedTaskId }) {
      currentGraph = buildDependencyGraph(todos);
      selectedTaskId = currentGraph.nodes.some((node) => node.id === nextSelectedTaskId) ? nextSelectedTaskId : null;
      hoveredTaskId = currentGraph.nodes.some((node) => node.id === hoveredTaskId) ? hoveredTaskId : null;
      focusedTaskId = currentGraph.nodes.some((node) => node.id === focusedTaskId) ? focusedTaskId : null;
      renderGraph();
    },
    destroy() {
      resetButton.removeEventListener('click', resetView);
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', endPointerDrag);
      svg.removeEventListener('pointercancel', endPointerDrag);
      container.innerHTML = '';
    }
  };
}
