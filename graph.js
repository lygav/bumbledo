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
