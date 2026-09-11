// --- 1. Dados Iniciais ---
const nodes = new vis.DataSet([
  { id: 1, label: 'Modelo Ambiental', level: 0, color: { background: '#8de8c7', border: '#7ee787' }, font: { color: '#000000' } },
  { id: 2, label: 'Relacionamentos', level: 1, color: { background: '#8de8c7', border: '#7ee787' }, font: { color: '#000000' } },
  { id: 3, label: '<<include>>', level: 2, color: { background: '#9bf2b5', border: '#7ee787' }, font: { color: '#000000' } },
  { id: 4, label: '<<extend>>', level: 2, color: { background: '#9bf2b5', border: '#7ee787' }, font: { color: '#000000' } }
]);

const edges = new vis.DataSet([
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 2, to: 4 }
]);

const collapsedNodes = new Set();
let currentSelectedNodeId = null;
const undoStack = [];

function saveState() {
  undoStack.push({ nodes: nodes.get(), edges: edges.get() });
  if (undoStack.length > 30) undoStack.shift();
}

function undo() {
  if (undoStack.length === 0) return;
  const state = undoStack.pop();
  nodes.clear(); edges.clear();
  nodes.add(state.nodes); edges.add(state.edges);
  hideFloatingElements();
}

// --- 2. Instância vis-network ---
const container = document.getElementById('mynetwork');
const options = {
  nodes: {
    shape: 'box',
    margin: 10,
    borderWidth: 0,
    borderRadius: 8,
    shadow: { enabled: true, color: 'rgba(0,0,0,0.12)', size: 4, x: 1, y: 1 }
  },
  edges: {
    smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.7 },
    color: { color: '#68ad7c', highlight: '#3a7d4e' },
    width: 2
  },
  layout: {
    hierarchical: {
      enabled: true,
      direction: 'LR',
      sortMethod: 'directed',
      nodeSpacing: 100,
      levelSeparation: 200,
      parentCentralization: true
    }
  },
  interaction: { dragNodes: true, dragView: true, zoomView: true, selectConnectedEdges: false },
  physics: {
    enabled: true,
    solver: 'hierarchicalRepulsion',
    hierarchicalRepulsion: {
      centralGravity: 0.0,
      springLength: 100,
      springConstant: 0.01,
      nodeDistance: 120,
      damping: 0.3
    }
  }
};

const network = new vis.Network(container, { nodes, edges }, options);

// --- 3. Referências DOM ---
const floatingToolbar = document.getElementById('floating-toolbar');
const collapseBtn = document.getElementById('btn-collapse-toggle');
const quickAddChildBtn = document.getElementById('btn-quick-add-child');
const quickAddSiblingBtn = document.getElementById('btn-quick-add-sibling');
const nodeTextEditor = document.getElementById('node-text-editor');

// --- 4. Funções da Árvore ---
function getChildNodes(parentId) {
  let children = [];
  edges.get().forEach(edge => {
    if (edge.from === parentId) {
      children.push(edge.to);
      children = children.concat(getChildNodes(edge.to));
    }
  });
  return children;
}

function hasDirectChildren(parentId) {
  return edges.get().some(edge => edge.from === parentId);
}

// --- 5. Posicionamento da Interface ---
function updateUI() {
  if (currentSelectedNodeId === null || nodes.get(currentSelectedNodeId)?.hidden) {
    hideFloatingElements();
    return;
  }

  const box = network.getBoundingBox(currentSelectedNodeId);
  const centerDOM = network.canvasToDOM({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });
  const rightDOM = network.canvasToDOM({ x: box.right, y: (box.top + box.bottom) / 2 });
  const bottomDOM = network.canvasToDOM({ x: (box.left + box.right) / 2, y: box.bottom });

  // A) Barra Superior do Nó
  if (!floatingToolbar.classList.contains('hidden')) {
    floatingToolbar.style.left = `${centerDOM.x - floatingToolbar.offsetWidth / 2}px`;
    floatingToolbar.style.top = `${centerDOM.y - (box.bottom - box.top) / 2 - floatingToolbar.offsetHeight - 10}px`;
  }

  // B) Botão de Colapsar à Direita
  if (hasDirectChildren(currentSelectedNodeId)) {
    collapseBtn.classList.remove('hidden');
    collapseBtn.style.left = `${rightDOM.x + 10}px`;
    collapseBtn.style.top = `${rightDOM.y - 9}px`;
    collapseBtn.innerText = collapsedNodes.has(currentSelectedNodeId) ? '>' : '<';
  } else {
    collapseBtn.classList.add('hidden');
  }

  // C) Botão '+' Rápido à Direita (Criar Nó Filho)
  quickAddChildBtn.classList.remove('hidden');
  quickAddChildBtn.style.left = `${rightDOM.x + (hasDirectChildren(currentSelectedNodeId) ? 34 : 10)}px`;
  quickAddChildBtn.style.top = `${rightDOM.y - 11}px`;

  // D) Botão '+' na Parte Inferior Central (Criar Nó Irmão/Separado)
  quickAddSiblingBtn.classList.remove('hidden');
  quickAddSiblingBtn.style.left = `${bottomDOM.x - 11}px`;
  quickAddSiblingBtn.style.top = `${bottomDOM.y + 4}px`;

  // E) Editor Inline
  if (!nodeTextEditor.classList.contains('hidden')) {
    nodeTextEditor.style.left = `${centerDOM.x - nodeTextEditor.offsetWidth / 2}px`;
    nodeTextEditor.style.top = `${centerDOM.y - nodeTextEditor.offsetHeight / 2}px`;
  }
}

// --- Menu de Opções no Topo ---
const optionsToggleBtn = document.getElementById('btn-options-toggle');
const optionsDropdown = document.getElementById('options-dropdown');
const toggleDarkBtn = document.getElementById('btn-toggle-dark');
const exportPngBtn = document.getElementById('btn-export-png');

optionsToggleBtn.addEventListener('click', e => {
  e.stopPropagation();
  optionsDropdown.classList.toggle('hidden');
});

document.addEventListener('click', () => optionsDropdown.classList.add('hidden'));

toggleDarkBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  toggleDarkBtn.innerText = isDark ? '☀️ Modo Claro' : '🌙 Modo Escuro';
});

exportPngBtn.addEventListener('click', () => {
  const canvas = container.querySelector('canvas');
  if (!canvas) return;

  const imageURI = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = 'mapa-mental.png';
  link.href = imageURI;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

function animateLayout() {
  network.setOptions({ physics: { enabled: true } });
  setTimeout(() => {
    network.setOptions({ physics: { enabled: false } });
  }, 300);
}

function toggleCollapse(nodeId) {
  const children = getChildNodes(nodeId);
  if (children.length === 0) return;

  const isCollapsed = collapsedNodes.has(nodeId);

  if (isCollapsed) {
    collapsedNodes.delete(nodeId);
    children.forEach(id => nodes.update({ id, hidden: false }));
  } else {
    collapsedNodes.add(nodeId);
    children.forEach(id => nodes.update({ id, hidden: true }));
  }

  animateLayout();
  updateUI();
}

function hideFloatingElements() {
  currentSelectedNodeId = null;
  floatingToolbar.classList.add('hidden');
  collapseBtn.classList.add('hidden');
  quickAddChildBtn.classList.add('hidden');
  quickAddSiblingBtn.classList.add('hidden');
  nodeTextEditor.classList.add('hidden');
}

// --- 6. Operações nos Nós ---
function addChildNode() {
  saveState();

  const parentId = currentSelectedNodeId || 1;
  const parentNode = nodes.get(parentId);
  const newId = Date.now();

  if (collapsedNodes.has(parentId)) toggleCollapse(parentId);

  nodes.add({
    id: newId,
    label: '',
    level: (parentNode?.level || 0) + 1,
    color: { background: '#c3fc8d', border: '#a5f36e' },
    font: { color: '#000000' }
  });
  edges.add({ from: parentId, to: newId });

  animateLayout();
  network.selectNodes([newId]);
  currentSelectedNodeId = newId;
  startEditingText(newId);
}

// Adiciona um Nó Irmão (Conectado ao mesmo pai do nó selecionado)
function addSiblingNode() {
  if (!currentSelectedNodeId || currentSelectedNodeId === 1) {
    addChildNode();
    return;
  }

  saveState();

  const parentEdge = edges.get().find(edge => edge.to === currentSelectedNodeId);
  const parentId = parentEdge ? parentEdge.from : 1;
  const parentNode = nodes.get(parentId);
  const newId = Date.now();

  nodes.add({
    id: newId,
    label: '',
    level: (parentNode?.level || 0) + 1,
    color: { background: '#c3fc8d', border: '#a5f36e' },
    font: { color: '#000000' }
  });
  edges.add({ from: parentId, to: newId });

  animateLayout();
  network.selectNodes([newId]);
  currentSelectedNodeId = newId;
  startEditingText(newId);
}

function deleteNode() {
  if (!currentSelectedNodeId) return;
  if (currentSelectedNodeId === 1) {
    alert("O nó central não pode ser excluído.");
    return;
  }

  saveState();

  const nodesToDelete = [currentSelectedNodeId, ...getChildNodes(currentSelectedNodeId)];
  nodesToDelete.forEach(id => {
    nodes.remove(id);
    collapsedNodes.delete(id);
  });

  hideFloatingElements();
  animateLayout();
}

function startEditingText(nodeId) {
  const node = nodes.get(nodeId);
  if (!node) return;
  nodeTextEditor.value = node.label;
  nodeTextEditor.classList.remove('hidden');
  floatingToolbar.classList.add('hidden');
  updateUI();
  nodeTextEditor.focus();
  nodeTextEditor.select();
}

function finishEditingText() {
  if (currentSelectedNodeId && !nodeTextEditor.classList.contains('hidden')) {
    const val = nodeTextEditor.value.trim();
    if (val) nodes.update({ id: currentSelectedNodeId, label: val });
    nodeTextEditor.classList.add('hidden');
    updateUI();
  }
}

// --- 7. Eventos da Rede ---
network.on("selectNode", params => {
  currentSelectedNodeId = params.nodes[0];
  floatingToolbar.classList.remove('hidden');
  nodeTextEditor.classList.add('hidden');
  updateUI();
});

network.on("deselectNode", () => hideFloatingElements());
network.on("dragNode", () => updateUI());
network.on("zoom", () => updateUI());
network.on("dragging", () => updateUI());

network.on("doubleClick", params => {
  if (params.nodes.length > 0) {
    currentSelectedNodeId = params.nodes[0];
    startEditingText(currentSelectedNodeId);
  }
});

collapseBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (currentSelectedNodeId) toggleCollapse(currentSelectedNodeId);
});

quickAddChildBtn.addEventListener('click', e => {
  e.stopPropagation();
  addChildNode();
});

quickAddSiblingBtn.addEventListener('click', e => {
  e.stopPropagation();
  addSiblingNode();
});

// --- 8. Eventos de Interface e Teclado ---
document.getElementById('btn-delete').addEventListener('click', deleteNode);
document.getElementById('btn-edit-text').addEventListener('click', () => startEditingText(currentSelectedNodeId));

const topUndoBtn = document.getElementById('btn-top-undo');
if (topUndoBtn) topUndoBtn.addEventListener('click', undo);

nodeTextEditor.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); finishEditingText(); }
  if (e.key === 'Escape') { e.preventDefault(); hideFloatingElements(); }
});
nodeTextEditor.addEventListener('blur', finishEditingText);

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    if (document.activeElement.tagName !== 'INPUT') {
      e.preventDefault(); undo(); return;
    }
  }

  if (document.activeElement.tagName === 'INPUT') return;
  if (e.key === 'Tab') { e.preventDefault(); addChildNode(); }
  if (e.key === 'Enter' && currentSelectedNodeId) { e.preventDefault(); addSiblingNode(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && currentSelectedNodeId) { deleteNode(); }
});

// --- 9. Pan com Botão do Meio (Scroll Click) ---
let isDraggingView = false;
let lastMousePos = { x: 0, y: 0 };

container.addEventListener('mousedown', e => {
  if (e.button === 1) {
    e.preventDefault();
    isDraggingView = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
  }
});

container.addEventListener('mousemove', e => {
  if (isDraggingView) {
    e.preventDefault();
    const scale = network.getScale();
    const pos = network.getViewPosition();
    network.moveTo({
      position: {
        x: pos.x - ((e.clientX - lastMousePos.x) / scale),
        y: pos.y - ((e.clientY - lastMousePos.y) / scale)
      },
      animation: false
    });
    lastMousePos = { x: e.clientX, y: e.clientY };
    updateUI();
  }
});

window.addEventListener('mouseup', e => { if (e.button === 1) isDraggingView = false; });