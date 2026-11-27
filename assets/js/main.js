// ============================================================
// MAPA MENTAL — versão organizada
// ============================================================

const STORAGE_KEY = "mapa-mental-data-v2";
const THEME_KEY = "mapa-mental-theme";
const MAX_HISTORY = 50;

//imagem
const imageFileInput = document.getElementById("image-file-input");
const addImageBtn = document.getElementById("btn-add-image");

const nodes = new vis.DataSet();
const edges = new vis.DataSet();

let currentSelectedNodeId = null;
let isEditing = false;
let collapsedNodes = new Set();
let undoStack = [];
let redoStack = [];
let historyLock = false;
let saveTimer = null;

// ------------------------------------------------------------
// Elementos
// ------------------------------------------------------------

const container = document.getElementById("mynetwork");
const floatingToolbar = document.getElementById("floating-toolbar");
const collapseBtn = document.getElementById("btn-collapse-toggle");
const quickAddChildBtn = document.getElementById("btn-quick-add-child");
const quickAddSiblingBtn = document.getElementById("btn-quick-add-sibling");
const nodeTextEditor = document.getElementById("node-text-editor");
const emptyHint = document.getElementById("empty-hint");
const saveStatus = document.getElementById("save-status");

const optionsToggleBtn = document.getElementById("btn-options-toggle");
const optionsDropdown = document.getElementById("options-dropdown");
const toggleDarkBtn = document.getElementById("btn-toggle-dark");
const exportPngBtn = document.getElementById("btn-export-png");
const newMapBtn = document.getElementById("btn-new-map");
const undoBtn = document.getElementById("btn-undo");
const redoBtn = document.getElementById("btn-redo");
const stylePanel = document.getElementById("node-style-panel");
const colorInput = document.getElementById("node-color");
const sizeInput = document.getElementById("node-size");
const colorValue = document.getElementById("node-color-value");

// ------------------------------------------------------------
// Dados iniciais / armazenamento
// ------------------------------------------------------------

const defaultNodes = [
  {
    id: 1,
    label: "Meu mapa mental",
    level: 0,
    color: { background: "#8de8c7", border: "#54c59a" },
    font: { color: "#000000", size: 18, bold: true }
  }
];

const defaultEdges = [];

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function getSnapshot() {
  return {
    nodes: cloneData(nodes.get()),
    edges: cloneData(edges.get()),
    collapsed: [...collapsedNodes]
  };
}

function applySnapshot(snapshot) {
  historyLock = true;

  nodes.clear();
  edges.clear();

  nodes.add(cloneData(snapshot.nodes));
  edges.add(cloneData(snapshot.edges));

  collapsedNodes = new Set(snapshot.collapsed || []);

  // Oculta os descendentes de todos os nós colapsados.
  updateHiddenNodes();

  historyLock = false;
  hideFloatingElements();
  updateHistoryButtons();
  updateUI();
  saveToStorage();
}

function saveHistory() {
  if (historyLock) return;

  undoStack.push(getSnapshot());

  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }

  redoStack = [];
  updateHistoryButtons();
}

function undo() {
  if (!undoStack.length) return;

  const current = getSnapshot();
  const previous = undoStack.pop();

  redoStack.push(current);
  applySnapshot(previous);
}

function redo() {
  if (!redoStack.length) return;

  const current = getSnapshot();
  const next = redoStack.pop();

  undoStack.push(current);
  applySnapshot(next);
}

function updateHistoryButtons() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

function setSaveStatus(text) {
  saveStatus.textContent = text;
}

function saveToStorage() {
  clearTimeout(saveTimer);
  setSaveStatus("Salvando...");

  saveTimer = setTimeout(() => {
    const data = getSnapshot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaveStatus("Salvo");
  }, 250);
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    nodes.add(defaultNodes);
    return;
  }

  try {
    const data = JSON.parse(raw);

    nodes.add(data.nodes?.length ? data.nodes : defaultNodes);
    edges.add(data.edges || []);
    collapsedNodes = new Set(data.collapsed || []);

    updateHiddenNodes();
  } catch (error) {
    console.warn("Não foi possível carregar o mapa salvo.", error);
    nodes.clear();
    edges.clear();
    nodes.add(defaultNodes);
  }
}

function createNewMap() {
  if (!confirm("Criar um novo mapa? O mapa atual será substituído.")) return;

  saveHistory();

  nodes.clear();
  edges.clear();
  collapsedNodes.clear();

  nodes.add(cloneData(defaultNodes));

  network.fit({ animation: true });
  selectNode(1);
  saveToStorage();
}

// ------------------------------------------------------------
// Configuração do vis-network
// ------------------------------------------------------------

const options = {
  nodes: {
    shape: "box",
    margin: 10,
    borderWidth: 1,
    borderRadius: 8,
    shadow: {
      enabled: true,
      color: "rgba(0,0,0,0.12)",
      size: 4,
      x: 1,
      y: 1
    },
    chosen: {
      node: (values) => {
        values.borderWidth = 2;
      }
    }
  },

  edges: {
    smooth: {
      type: "cubicBezier",
      forceDirection: "horizontal",
      roundness: 0.7
    },
    color: {
      color: "#68ad7c",
      highlight: "#3a7d4e"
    },
    width: 2
  },

  layout: {
    hierarchical: {
      enabled: true,
      direction: "LR",
      sortMethod: "directed",
      nodeSpacing: 90,
      levelSeparation: 170,
      parentCentralization: true
    }
  },

  interaction: {
    dragNodes: true,
    dragView: true,
    zoomView: true,
    selectConnectedEdges: false,
    hover: true,
    multiselect: false
  },

  physics: {
    enabled: true,
    solver: "hierarchicalRepulsion",
    hierarchicalRepulsion: {
      centralGravity: 0,
      springLength: 100,
      springConstant: 0.01,
      nodeDistance: 120,
      damping: 0.3
    }
  }
};

const network = new vis.Network(container, { nodes, edges }, options);

// ------------------------------------------------------------
// Árvore
// ------------------------------------------------------------

function getDirectChildren(parentId) {
  return edges.get({
    filter: edge => String(edge.from) === String(parentId)
  }).map(edge => edge.to);
}

function getChildNodes(parentId) {
  const result = [];
  const queue = [...getDirectChildren(parentId)];

  while (queue.length) {
    const id = queue.shift();
    result.push(id);
    queue.push(...getDirectChildren(id));
  }

  return result;
}

function hasDirectChildren(parentId) {
  return getDirectChildren(parentId).length > 0;
}

function getParentId(nodeId) {
  const edge = edges.get({
    filter: edge => String(edge.to) === String(nodeId)
  })[0];

  return edge ? edge.from : null;
}

function updateHiddenNodes() {
  const hidden = new Set();

  collapsedNodes.forEach(id => {
    getChildNodes(id).forEach(childId => hidden.add(childId));
  });

  nodes.forEach(node => {
    const shouldHide = hidden.has(node.id);

    if (node.hidden !== shouldHide) {
      nodes.update({ id: node.id, hidden: shouldHide });
    }
  });
}

// ------------------------------------------------------------
// Layout / UI
// ------------------------------------------------------------

function animateLayout() {
  network.setOptions({ physics: { enabled: true } });

  setTimeout(() => {
    network.setOptions({ physics: { enabled: false } });
  }, 350);
}

function hideFloatingElements() {
  currentSelectedNodeId = null;
  floatingToolbar.classList.add("hidden");
  collapseBtn.classList.add("hidden");
  quickAddChildBtn.classList.add("hidden");
  quickAddSiblingBtn.classList.add("hidden");
  stylePanel.classList.add("hidden");
  nodeTextEditor.classList.add("hidden");
  isEditing = false;
}

function selectNode(id) {
  if (!nodes.get(id)) return;

  currentSelectedNodeId = id;
  syncStylePanel();
  network.selectNodes([id]);
  floatingToolbar.classList.remove("hidden");
  stylePanel.classList.remove("hidden");
  nodeTextEditor.classList.add("hidden");
  isEditing = false;
  updateUI();
}

function updateUI() {
  if (
    currentSelectedNodeId === null ||
    !nodes.get(currentSelectedNodeId) ||
    nodes.get(currentSelectedNodeId).hidden
  ) {
    hideFloatingElements();
    return;
  }

  const box = network.getBoundingBox(currentSelectedNodeId);

  const centerDOM = network.canvasToDOM({
    x: (box.left + box.right) / 2,
    y: (box.top + box.bottom) / 2
  });

  const rightDOM = network.canvasToDOM({
    x: box.right,
    y: (box.top + box.bottom) / 2
  });

  const bottomDOM = network.canvasToDOM({
    x: (box.left + box.right) / 2,
    y: box.bottom
  });

  if (!floatingToolbar.classList.contains("hidden")) {
    floatingToolbar.style.left =
      `${centerDOM.x - floatingToolbar.offsetWidth / 2}px`;

    floatingToolbar.style.top =
      `${centerDOM.y - (box.bottom - box.top) / 2 - floatingToolbar.offsetHeight - 10}px`;
  }

  if (hasDirectChildren(currentSelectedNodeId)) {
    collapseBtn.classList.remove("hidden");
    collapseBtn.style.left = `${rightDOM.x + 8}px`;
    collapseBtn.style.top = `${rightDOM.y - 10}px`;
    collapseBtn.textContent =
      collapsedNodes.has(currentSelectedNodeId) ? "+" : "−";
  } else {
    collapseBtn.classList.add("hidden");
  }

  quickAddChildBtn.classList.remove("hidden");
  quickAddChildBtn.style.left =
    `${rightDOM.x + (hasDirectChildren(currentSelectedNodeId) ? 31 : 8)}px`;
  quickAddChildBtn.style.top = `${rightDOM.y - 12}px`;

  quickAddSiblingBtn.classList.remove("hidden");
  quickAddSiblingBtn.style.left = `${bottomDOM.x - 12}px`;
  quickAddSiblingBtn.style.top = `${bottomDOM.y + 5}px`;

  if (!stylePanel.classList.contains("hidden")) {
    stylePanel.style.left = `${Math.min(centerDOM.x + 15, window.innerWidth - 230)}px`;
    stylePanel.style.top = `${Math.min(bottomDOM.y + 38, window.innerHeight - 170)}px`;
  }

  if (!nodeTextEditor.classList.contains("hidden")) {
    nodeTextEditor.style.left =
      `${centerDOM.x - nodeTextEditor.offsetWidth / 2}px`;

    nodeTextEditor.style.top =
      `${centerDOM.y - nodeTextEditor.offsetHeight / 2}px`;
  }

  const hasMoreThanOneNode = nodes.length > 1;
  emptyHint.classList.toggle("hidden-hint", hasMoreThanOneNode);
}

// ------------------------------------------------------------
// Criação / edição
// ------------------------------------------------------------

function nextNodeId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function addNode(parentId, level, label = "") {
  saveHistory();

  const id = nextNodeId();

  nodes.add({
    id,
    label,
    level,
    color: {
      background: "#c3fc8d",
      border: "#a5f36e"
    },
    font: {
      color: "#000000"
    }
  });

  edges.add({ from: parentId, to: id });

  if (collapsedNodes.has(parentId)) {
    collapsedNodes.delete(parentId);
    updateHiddenNodes();
  }

  animateLayout();
  selectNode(id);
  startEditingText(id);
  saveToStorage();

  return id;
}

function addChildNode() {
  const parentId = currentSelectedNodeId || 1;
  const parentNode = nodes.get(parentId);

  if (!parentNode) return;

  addNode(parentId, (parentNode.level || 0) + 1);
}

function addSiblingNode() {
  if (!currentSelectedNodeId || currentSelectedNodeId === 1) {
    addChildNode();
    return;
  }

  const parentId = getParentId(currentSelectedNodeId) || 1;
  const parentNode = nodes.get(parentId);

  addNode(parentId, (parentNode?.level || 0) + 1);
}

function startEditingText(nodeId) {
  const node = nodes.get(nodeId);
  if (!node) return;

  currentSelectedNodeId = nodeId;
  isEditing = true;

  nodeTextEditor.value = node.label || "";
  nodeTextEditor.classList.remove("hidden");
  floatingToolbar.classList.add("hidden");
  stylePanel.classList.add("hidden");

  updateUI();

  nodeTextEditor.focus();
  nodeTextEditor.select();
}

function finishEditingText(save = true) {
  if (!isEditing) return;

  const nodeId = currentSelectedNodeId;
  const node = nodes.get(nodeId);

  if (node && save) {
    const value = nodeTextEditor.value.trim();

    if (value && value !== node.label) {
      saveHistory();
      nodes.update({ id: nodeId, label: value });
      saveToStorage();
    } else if (!value && !node.label) {
      nodes.remove(nodeId);
      edges.remove(
        edges.get({
          filter: edge =>
            String(edge.from) === String(nodeId) ||
            String(edge.to) === String(nodeId)
        }).map(edge => edge.id)
      );
      network.unselectAll();
    }
  }

  isEditing = false;
  nodeTextEditor.classList.add("hidden");

  if (nodeId && nodes.get(nodeId)) {
    selectNode(nodeId);
  } else {
    hideFloatingElements();
  }

  updateUI();
}

function deleteNode() {
  if (!currentSelectedNodeId) return;

  if (currentSelectedNodeId === 1) {
    alert("O nó central não pode ser excluído.");
    return;
  }

  saveHistory();

  const nodeId = currentSelectedNodeId;
  const nodesToDelete = [nodeId, ...getChildNodes(nodeId)];

  nodesToDelete.forEach(id => {
    nodes.remove(id);
    collapsedNodes.delete(id);
  });

  hideFloatingElements();
  network.unselectAll();

  animateLayout();
  saveToStorage();
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file || !currentSelectedNodeId) return;

  // Limite recomendado de 2MB para não sobrecarregar o localStorage
  if (file.size > 2 * 1024 * 1024) {
    alert("Escolha uma imagem menor que 2MB.");
    imageFileInput.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    const imageUrl = e.target.result;

    saveHistory();

    const node = nodes.get(currentSelectedNodeId);

    nodes.update({
      id: currentSelectedNodeId,
      shape: "image",
      image: imageUrl,
      // Se o nó não tiver texto, podemos manter um rótulo básico ou deixar o rótulo atual
      label: node.label || ""
    });

    saveToStorage();
    animateLayout();
    updateUI();
    imageFileInput.value = ""; // Limpa o input
  };

  reader.readAsDataURL(file);
}

// Abrir o seletor de arquivos ao clicar em "Imagem"
addImageBtn.addEventListener("click", () => {
  if (currentSelectedNodeId) {
    imageFileInput.click();
  }
});

// Processar o arquivo selecionado
imageFileInput.addEventListener("change", handleImageUpload);

// ------------------------------------------------------------
// Colapso
// ------------------------------------------------------------

function toggleCollapse(nodeId) {
  if (!hasDirectChildren(nodeId)) return;

  saveHistory();

  if (collapsedNodes.has(nodeId)) {
    collapsedNodes.delete(nodeId);
  } else {
    collapsedNodes.add(nodeId);
  }

  updateHiddenNodes();
  animateLayout();
  updateUI();
  saveToStorage();
}

// ------------------------------------------------------------
// Personalização do nó
// ------------------------------------------------------------

function getNodeBackground(node) {
  return node?.color?.background || "#c3fc8d";
}

function updateNodeStyle() {
  const id = currentSelectedNodeId;
  const node = nodes.get(id);
  if (!node) return;

  const color = colorInput.value;
  const size = Number(sizeInput.value);

  if (
    getNodeBackground(node) === color &&
    Number(node.font?.size || 14) === size
  ) {
    return;
  }

  saveHistory();

  nodes.update({
    id,
    color: {
      ...(node.color || {}),
      background: color,
      border: color
    },
    font: {
      ...(node.font || {}),
      color: "#000000",
      size
    }
  });

  colorValue.textContent = color.toUpperCase();
  saveToStorage();
  updateUI();
}

function syncStylePanel() {
  const node = nodes.get(currentSelectedNodeId);
  if (!node) return;

  colorInput.value = getNodeBackground(node);
  sizeInput.value = Number(node.font?.size || 14);
  colorValue.textContent = colorInput.value.toUpperCase();
}

// ------------------------------------------------------------
// Reagrupar Nós por Arrasto (Drag & Drop de Ramos)
// ------------------------------------------------------------

function handleNodeReparent(draggedNodeId, newParentId) {
  // Regras de validação:
  // 1. Não pode reconectar a si mesmo
  if (draggedNodeId === newParentId) return;

  // 2. Não pode reconectar a um dos seus próprios descendentes (evita loops infinitos)
  const descendants = getChildNodes(draggedNodeId);
  if (descendants.includes(newParentId)) {
    alert("Não é possível mover um nó pai para dentro de um de seus descendentes.");
    return;
  }

  // 3. O nó central (raiz) não pode virar filho de outro nó
  if (draggedNodeId === 1 || draggedNodeId === "1") return;

  saveHistory();

  // Encontra a aresta antiga que ligava este nó ao pai antigo
  const oldEdge = edges.get({
    filter: edge => String(edge.to) === String(draggedNodeId)
  })[0];

  // Remove a conexão antiga e cria a nova conexão para o novo pai
  if (oldEdge) {
    edges.remove(oldEdge.id);
  }

  edges.add({ from: newParentId, to: draggedNodeId });

  // Se o novo pai estiver colapsado, expande ele para mostrar o novo filho
  if (collapsedNodes.has(newParentId)) {
    collapsedNodes.delete(newParentId);
    updateHiddenNodes();
  }

  // Atualiza o nível (level) do nó e de todos os seus filhos recursivamente
  const newParentNode = nodes.get(newParentId);
  const levelOffset = ((newParentNode?.level || 0) + 1) - (nodes.get(draggedNodeId)?.level || 1);

  const nodesToUpdate = [draggedNodeId, ...descendants];
  nodesToUpdate.forEach(id => {
    const node = nodes.get(id);
    if (node) {
      nodes.update({
        id,
        level: (node.level || 0) + levelOffset
      });
    }
  });

  animateLayout();
  saveToStorage();
  updateUI();
}

// Evento disparado quando o usuário solta o nó arrastado
network.on("dragEnd", params => {
  if (!params.nodes.length) return;

  const draggedNodeId = params.nodes[0];
  
  // Identifica se o nó foi solto em cima de outro nó
  const targetNodeId = network.getNodeAt(params.pointer.DOM);

  if (targetNodeId && targetNodeId !== draggedNodeId) {
    handleNodeReparent(draggedNodeId, targetNodeId);
  }
});

// ------------------------------------------------------------
// Menu / exportação
// ------------------------------------------------------------

optionsToggleBtn.addEventListener("click", event => {
  event.stopPropagation();
  optionsDropdown.classList.toggle("hidden");
});

document.addEventListener("click", () => {
  optionsDropdown.classList.add("hidden");
});

optionsDropdown.addEventListener("click", event => {
  event.stopPropagation();
});

toggleDarkBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");

  const isDark = document.body.classList.contains("dark-mode");

  toggleDarkBtn.textContent = isDark
    ? "☀ Modo claro"
    : "🌙 Modo escuro";

  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
});

function loadTheme() {
  const theme = localStorage.getItem(THEME_KEY);

  if (theme === "dark") {
    document.body.classList.add("dark-mode");
    toggleDarkBtn.textContent = "☀ Modo claro";
  }
}

exportPngBtn.addEventListener("click", () => {
  const canvas = container.querySelector("canvas");
  if (!canvas) return;

  const imageURI = canvas.toDataURL("image/png");

  const link = document.createElement("a");
  link.download = "mapa-mental.png";
  link.href = imageURI;
  link.click();

  optionsDropdown.classList.add("hidden");
});

newMapBtn.addEventListener("click", () => {
  optionsDropdown.classList.add("hidden");
  createNewMap();
});

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

// ------------------------------------------------------------
// Eventos da rede
// ------------------------------------------------------------

network.on("selectNode", params => {
  if (!params.nodes.length) return;
  selectNode(params.nodes[0]);
});

network.on("deselectNode", () => {
  if (!isEditing) hideFloatingElements();
});

network.on("dragNode", updateUI);
network.on("zoom", updateUI);
network.on("dragging", updateUI);

network.on("doubleClick", params => {
  if (!params.nodes.length) return;
  startEditingText(params.nodes[0]);
});

collapseBtn.addEventListener("click", event => {
  event.stopPropagation();
  if (currentSelectedNodeId) {
    toggleCollapse(currentSelectedNodeId);
  }
});

quickAddChildBtn.addEventListener("click", event => {
  event.stopPropagation();
  addChildNode();
});

quickAddSiblingBtn.addEventListener("click", event => {
  event.stopPropagation();
  addChildNode();
});

document.getElementById("btn-delete").addEventListener("click", deleteNode);

document.getElementById("btn-edit-text").addEventListener("click", () => {
  if (currentSelectedNodeId) {
    startEditingText(currentSelectedNodeId);
  }
});

nodeTextEditor.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    finishEditingText(true);
  }

  if (event.key === "Escape") {
    event.preventDefault();
    finishEditingText(false);
  }
});

nodeTextEditor.addEventListener("blur", () => finishEditingText(true));

// ------------------------------------------------------------
// Controles de personalização
// ------------------------------------------------------------

colorInput.addEventListener("input", updateNodeStyle);
sizeInput.addEventListener("input", updateNodeStyle);

// ------------------------------------------------------------
// Atalhos
// ------------------------------------------------------------

document.addEventListener("keydown", event => {
  const active = document.activeElement;
  const editingInput = active && active.tagName === "INPUT";

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    if (!editingInput) {
      event.preventDefault();
      undo();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    if (!editingInput) {
      event.preventDefault();
      redo();
    }
    return;
  }

  if (editingInput) return;

  if (event.key === "Tab") {
    event.preventDefault();
    addChildNode();
    return;
  }

  if (event.key === "Enter" && currentSelectedNodeId) {
    event.preventDefault();
    addSiblingNode();
    return;
  }

  if (
    (event.key === "Delete" || event.key === "Backspace") &&
    currentSelectedNodeId
  ) {
    event.preventDefault();
    deleteNode();
  }
});

// ------------------------------------------------------------
// Pan com botão do meio
// ------------------------------------------------------------

let isDraggingView = false;
let lastMousePos = { x: 0, y: 0 };

container.addEventListener("mousedown", event => {
  if (event.button !== 1) return;

  event.preventDefault();

  isDraggingView = true;
  lastMousePos = {
    x: event.clientX,
    y: event.clientY
  };
});

container.addEventListener("mousemove", event => {
  if (!isDraggingView) return;

  event.preventDefault();

  const scale = network.getScale();
  const pos = network.getViewPosition();

  network.moveTo({
    position: {
      x: pos.x - (event.clientX - lastMousePos.x) / scale,
      y: pos.y - (event.clientY - lastMousePos.y) / scale
    },
    animation: false
  });

  lastMousePos = {
    x: event.clientX,
    y: event.clientY
  };

  updateUI();
});

window.addEventListener("mouseup", event => {
  if (event.button === 1) {
    isDraggingView = false;
  }
});

// ------------------------------------------------------------
// Inicialização
// ------------------------------------------------------------

loadTheme();
loadFromStorage();

network.once("afterDrawing", () => {
  network.setOptions({ physics: { enabled: false } });
  network.fit({ animation: false });
  updateHistoryButtons();
  updateUI();
});

window.addEventListener("beforeunload", () => {
  clearTimeout(saveTimer);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getSnapshot()));
});
