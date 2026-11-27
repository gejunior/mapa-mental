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
const quickAddLeftBtn = document.getElementById("btn-quick-add-left");
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

  recalculateLevels();
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

    recalculateLevels();
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

function getNodeSide(nodeId) {
  if (nodeId === 1 || String(nodeId) === "1") return "root";
  const node = nodes.get(nodeId);
  if (!node) return "right";

  // Se já tem side explicitamente definido
  if (node.side === "left" || node.side === "right") return node.side;

  const rootNode = nodes.get(1);
  if (rootNode && typeof node.level === "number" && typeof rootNode.level === "number") {
    if (node.level < rootNode.level) {
      node.side = "left";
      return "left";
    }
    if (node.level > rootNode.level) {
      node.side = "right";
      return "right";
    }
  }

  // Verifica posição X no canvas em relação à raiz
  try {
    const rootPos = network.getPosition(1);
    const nodePos = network.getPosition(nodeId);
    if (nodePos && rootPos && nodePos.x < rootPos.x - 10) {
      node.side = "left";
      return "left";
    }
  } catch (e) {}

  let curr = nodeId;
  while (curr) {
    const parentId = getParentId(curr);
    if (!parentId) break;
    if (parentId === 1 || String(parentId) === "1") {
      const directChild = nodes.get(curr);
      if (directChild?.side === "left") return "left";
      if (rootNode && typeof directChild?.level === "number" && directChild.level < rootNode.level) {
        if (directChild) directChild.side = "left";
        return "left";
      }
      break;
    }
    curr = parentId;
  }
  return "right";
}

function recalculateLevels() {
  const rootId = 1;
  const rootNode = nodes.get(rootId);
  if (!rootNode) return;

  const relativeLevels = new Map();
  relativeLevels.set(String(rootId), 0);

  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift();
    const parentRel = relativeLevels.get(String(parentId)) ?? 0;
    const parentSide = getNodeSide(parentId);

    const directChildren = getDirectChildren(parentId);
    directChildren.forEach(childId => {
      const childNode = nodes.get(childId);
      if (!childNode) return;

      let childSide;
      let childRel;

      if (parentId === 1 || String(parentId) === "1") {
        childSide = getNodeSide(childId);
        childRel = childSide === "left" ? -1 : 1;
      } else {
        childSide = parentSide === "left" ? "left" : "right";
        childRel = childSide === "left" ? parentRel - 1 : parentRel + 1;
      }

      relativeLevels.set(String(childId), childRel);
      queue.push(childId);
    });
  }

  let minRel = 0;
  relativeLevels.forEach(val => {
    if (val < minRel) minRel = val;
  });

  const offset = -minRel;

  const updates = [];
  relativeLevels.forEach((rel, id) => {
    const node = nodes.get(id);
    if (node) {
      const newLevel = rel + offset;
      const newSide = rel < 0 ? "left" : (rel > 0 ? "right" : "root");
      if (node.level !== newLevel || node.side !== newSide) {
        updates.push({ id: node.id, level: newLevel, side: newSide });
      }
    }
  });

  if (updates.length) {
    nodes.update(updates);
  }
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
  quickAddLeftBtn.classList.add("hidden");
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
  if (activeDraggedNodeId) return;

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

  const leftDOM = network.canvasToDOM({
    x: box.left,
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

  const isRoot = currentSelectedNodeId === 1 || currentSelectedNodeId === "1";
  const nodeSide = getNodeSide(currentSelectedNodeId);
  const hasChildren = hasDirectChildren(currentSelectedNodeId);

  if (isRoot) {
    quickAddLeftBtn.classList.remove("hidden");
    quickAddLeftBtn.style.left = `${leftDOM.x - 32}px`;
    quickAddLeftBtn.style.top = `${leftDOM.y - 12}px`;
    quickAddLeftBtn.title = "Adicionar ideia à esquerda";

    quickAddChildBtn.classList.remove("hidden");
    quickAddChildBtn.style.left = `${rightDOM.x + (hasChildren ? 31 : 8)}px`;
    quickAddChildBtn.style.top = `${rightDOM.y - 12}px`;
    quickAddChildBtn.title = "Adicionar ideia à direita";

    if (hasChildren) {
      collapseBtn.classList.remove("hidden");
      collapseBtn.style.left = `${rightDOM.x + 8}px`;
      collapseBtn.style.top = `${rightDOM.y - 10}px`;
      collapseBtn.textContent = "−";
    } else {
      collapseBtn.classList.add("hidden");
    }
  } else if (nodeSide === "left") {
    quickAddLeftBtn.classList.remove("hidden");
    quickAddLeftBtn.style.left = `${leftDOM.x - (hasChildren ? 55 : 32)}px`;
    quickAddLeftBtn.style.top = `${leftDOM.y - 12}px`;
    quickAddLeftBtn.title = "Adicionar ideia filha";

    quickAddChildBtn.classList.add("hidden");

    if (hasChildren) {
      collapseBtn.classList.remove("hidden");
      collapseBtn.style.left = `${leftDOM.x - 28}px`;
      collapseBtn.style.top = `${leftDOM.y - 10}px`;
      collapseBtn.textContent = "−";
    } else {
      collapseBtn.classList.add("hidden");
    }
  } else {
    quickAddLeftBtn.classList.add("hidden");

    quickAddChildBtn.classList.remove("hidden");
    quickAddChildBtn.style.left = `${rightDOM.x + (hasChildren ? 31 : 8)}px`;
    quickAddChildBtn.style.top = `${rightDOM.y - 12}px`;
    quickAddChildBtn.title = "Adicionar ideia filha";

    if (hasChildren) {
      collapseBtn.classList.remove("hidden");
      collapseBtn.style.left = `${rightDOM.x + 8}px`;
      collapseBtn.style.top = `${rightDOM.y - 10}px`;
      collapseBtn.textContent = "−";
    } else {
      collapseBtn.classList.add("hidden");
    }
  }

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

function addNode(parentId, side = "right", label = "") {
  saveHistory();

  const parentNode = nodes.get(parentId);
  const id = nextNodeId();
  const chosenSide = side || (parentId === 1 || String(parentId) === "1" ? "right" : getNodeSide(parentId));

  let newLevel;
  if (chosenSide === "left") {
    if (!parentNode || (parentNode.level || 0) <= 0) {
      const updates = [];
      nodes.forEach(n => {
        updates.push({ id: n.id, level: (n.level || 0) + 1 });
      });
      nodes.update(updates);
      newLevel = 0;
    } else {
      newLevel = (parentNode.level || 1) - 1;
    }
  } else {
    newLevel = (parentNode?.level || 0) + 1;
  }

  nodes.add({
    id,
    label,
    side: chosenSide,
    level: newLevel,
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

  recalculateLevels();
  animateLayout();
  selectNode(id);
  startEditingText(id);
  saveToStorage();

  return id;
}

function addChildNode(preferredSide) {
  const parentId = currentSelectedNodeId || 1;
  const parentNode = nodes.get(parentId);

  if (!parentNode) return;

  let side;
  if (parentId === 1 || parentId === "1") {
    side = preferredSide || "right";
  } else {
    side = preferredSide || getNodeSide(parentId);
  }

  addNode(parentId, side);
}

function addSiblingNode() {
  if (!currentSelectedNodeId || currentSelectedNodeId === 1 || currentSelectedNodeId === "1") {
    addChildNode("right");
    return;
  }

  const parentId = getParentId(currentSelectedNodeId) || 1;
  const currentSide = getNodeSide(currentSelectedNodeId);

  addNode(parentId, currentSide);
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

  const edgesToRemove = edges.get({
    filter: edge =>
      nodesToDelete.includes(edge.from) ||
      nodesToDelete.includes(edge.to)
  }).map(edge => edge.id);

  if (edgesToRemove.length) {
    edges.remove(edgesToRemove);
  }

  hideFloatingElements();
  network.unselectAll();

  recalculateLevels();
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
// Exclusão de Ramos Filhos / Colapso
// ------------------------------------------------------------

function deleteChildBranches(parentId) {
  if (!parentId) return;

  const childrenToDelete = getChildNodes(parentId);
  if (!childrenToDelete.length) return;

  saveHistory();

  childrenToDelete.forEach(id => {
    nodes.remove(id);
    collapsedNodes.delete(id);
  });

  const edgesToRemove = edges.get({
    filter: edge =>
      childrenToDelete.includes(edge.from) ||
      childrenToDelete.includes(edge.to)
  }).map(edge => edge.id);

  if (edgesToRemove.length) {
    edges.remove(edgesToRemove);
  }

  collapsedNodes.delete(parentId);

  recalculateLevels();
  animateLayout();
  updateUI();
  saveToStorage();
}

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

  const isTargetRoot = newParentId === 1 || newParentId === "1";
  if (!isTargetRoot) {
    const parentSide = getNodeSide(newParentId);
    nodes.update({ id: draggedNodeId, side: parentSide });
    descendants.forEach(id => {
      nodes.update({ id, side: parentSide });
    });
  }

  recalculateLevels();
  animateLayout();
  saveToStorage();
  updateUI();
}

// ------------------------------------------------------------
// Guias Inteligentes de Alinhamento e Simetria de Espaço (Smart Guides)
// ------------------------------------------------------------

let activeDraggedNodeId = null;
let activeGuides = null;
const SNAP_THRESHOLD_PX = 9;

function getParentNodeId(nodeId) {
  const inEdges = edges.get({
    filter: edge => String(edge.to) === String(nodeId)
  });
  return inEdges.length ? inEdges[0].from : null;
}

function calculateGuidesAndSnapping(draggedId, currentX, currentY, scale = 1.0) {
  const threshold = SNAP_THRESHOLD_PX / scale;
  let snapX = null;
  let snapY = null;
  let hGuide = null;
  let vGuide = null;
  let symYGuide = null;
  let symXGuide = null;

  const parentId = getParentNodeId(draggedId);
  const allNodeIds = nodes.getIds();
  const otherNodes = [];

  for (const id of allNodeIds) {
    if (id === draggedId) continue;
    if (collapsedNodes.has(id)) continue;
    const nObj = network.body.nodes[id];
    if (!nObj || nObj.options.hidden) continue;
    const pos = network.getPosition(id);
    otherNodes.push({
      id,
      x: pos.x,
      y: pos.y,
      isParent: parentId && String(id) === String(parentId)
    });
  }

  // 1. Alinhamento Horizontal (mesmo Y que célula anterior/pai, ou nós acima/abaixo)
  let bestHDiff = threshold + 1;
  let bestHNode = null;
  for (const n of otherNodes) {
    const rawDiff = Math.abs(currentY - n.y);
    const weightedDiff = n.isParent ? rawDiff * 0.8 : rawDiff;
    if (rawDiff <= threshold && weightedDiff < bestHDiff) {
      bestHDiff = weightedDiff;
      bestHNode = n;
      snapY = n.y;
    }
  }

  if (bestHNode) {
    const alignedNodes = otherNodes.filter(n => Math.abs(n.y - bestHNode.y) <= 2 / scale);
    const allX = [currentX, bestHNode.x, ...alignedNodes.map(n => n.x)];
    hGuide = {
      y: bestHNode.y,
      x1: Math.min(...allX) - 35 / scale,
      x2: Math.max(...allX) + 35 / scale,
      points: [
        { x: currentX, y: bestHNode.y },
        { x: bestHNode.x, y: bestHNode.y },
        ...alignedNodes.map(n => ({ x: n.x, y: bestHNode.y }))
      ]
    };
  }

  // 2. Alinhamento Vertical (mesmo X que nós da mesma coluna ou nós acima/abaixo)
  let bestVDiff = threshold + 1;
  let bestVNode = null;
  for (const n of otherNodes) {
    const diff = Math.abs(currentX - n.x);
    if (diff <= threshold && diff < bestVDiff) {
      bestVDiff = diff;
      bestVNode = n;
      snapX = n.x;
    }
  }

  if (bestVNode) {
    const alignedNodes = otherNodes.filter(n => Math.abs(n.x - bestVNode.x) <= 2 / scale);
    const allY = [currentY, bestVNode.y, ...alignedNodes.map(n => n.y)];
    vGuide = {
      x: bestVNode.x,
      y1: Math.min(...allY) - 35 / scale,
      y2: Math.max(...allY) + 35 / scale,
      points: [
        { x: bestVNode.x, y: currentY },
        { x: bestVNode.x, y: bestVNode.y },
        ...alignedNodes.map(n => ({ x: bestVNode.x, y: n.y }))
      ]
    };
  }

  // 3. Simetria de Espaço Vertical (Y) entre células (mesma coluna / ramos adjacentes)
  const colNodes = otherNodes.filter(n => Math.abs(n.x - currentX) < 140 / scale);
  let bestSymYDiff = threshold + 1;

  for (let i = 0; i < colNodes.length; i++) {
    for (let j = i + 1; j < colNodes.length; j++) {
      const a = colNodes[i].y < colNodes[j].y ? colNodes[i] : colNodes[j];
      const b = colNodes[i].y < colNodes[j].y ? colNodes[j] : colNodes[i];
      const gap = b.y - a.y;
      if (gap < 25 / scale) continue;

      // Configuração A: Nó arrastado no meio exato entre A e B
      const midTarget = (a.y + b.y) / 2;
      const midDiff = Math.abs(currentY - midTarget);
      if (midDiff <= threshold && midDiff < bestSymYDiff) {
        bestSymYDiff = midDiff;
        if (bestHNode === null || midDiff < bestHDiff) {
          snapY = midTarget;
        }
        symYGuide = {
          type: "between",
          targetY: midTarget,
          gap: gap / 2,
          span1: { start: a.y, end: midTarget },
          span2: { start: midTarget, end: b.y },
          x: (a.x + b.x) / 2
        };
      }

      // Configuração B: Nó arrastado abaixo de B (sequência A -> B -> Nó)
      const belowTarget = b.y + gap;
      const belowDiff = Math.abs(currentY - belowTarget);
      if (belowDiff <= threshold && belowDiff < bestSymYDiff) {
        bestSymYDiff = belowDiff;
        if (bestHNode === null || belowDiff < bestHDiff) {
          snapY = belowTarget;
        }
        symYGuide = {
          type: "after",
          targetY: belowTarget,
          gap: gap,
          span1: { start: a.y, end: b.y },
          span2: { start: b.y, end: belowTarget },
          x: (a.x + b.x) / 2
        };
      }

      // Configuração C: Nó arrastado acima de A (sequência Nó -> A -> B)
      const aboveTarget = a.y - gap;
      const aboveDiff = Math.abs(currentY - aboveTarget);
      if (aboveDiff <= threshold && aboveDiff < bestSymYDiff) {
        bestSymYDiff = aboveDiff;
        if (bestHNode === null || aboveDiff < bestHDiff) {
          snapY = aboveTarget;
        }
        symYGuide = {
          type: "before",
          targetY: aboveTarget,
          gap: gap,
          span1: { start: aboveTarget, end: a.y },
          span2: { start: a.y, end: b.y },
          x: (a.x + b.x) / 2
        };
      }
    }
  }

  // 4. Simetria de Espaço Horizontal (X) entre células
  const rowNodes = otherNodes.filter(n => Math.abs(n.y - currentY) < 140 / scale);
  let bestSymXDiff = threshold + 1;

  for (let i = 0; i < rowNodes.length; i++) {
    for (let j = i + 1; j < rowNodes.length; j++) {
      const a = rowNodes[i].x < rowNodes[j].x ? rowNodes[i] : rowNodes[j];
      const b = rowNodes[i].x < rowNodes[j].x ? rowNodes[j] : rowNodes[i];
      const gap = b.x - a.x;
      if (gap < 25 / scale) continue;

      const midTarget = (a.x + b.x) / 2;
      const midDiff = Math.abs(currentX - midTarget);
      if (midDiff <= threshold && midDiff < bestSymXDiff) {
        bestSymXDiff = midDiff;
        if (bestVNode === null || midDiff < bestVDiff) {
          snapX = midTarget;
        }
        symXGuide = {
          type: "between",
          targetX: midTarget,
          gap: gap / 2,
          span1: { start: a.x, end: midTarget },
          span2: { start: midTarget, end: b.x },
          y: (a.y + b.y) / 2
        };
      }

      const afterTarget = b.x + gap;
      const afterDiff = Math.abs(currentX - afterTarget);
      if (afterDiff <= threshold && afterDiff < bestSymXDiff) {
        bestSymXDiff = afterDiff;
        if (bestVNode === null || afterDiff < bestVDiff) {
          snapX = afterTarget;
        }
        symXGuide = {
          type: "after",
          targetX: afterTarget,
          gap: gap,
          span1: { start: a.x, end: b.x },
          span2: { start: b.x, end: afterTarget },
          y: (a.y + b.y) / 2
        };
      }

      const beforeTarget = a.x - gap;
      const beforeDiff = Math.abs(currentX - beforeTarget);
      if (beforeDiff <= threshold && beforeDiff < bestSymXDiff) {
        bestSymXDiff = beforeDiff;
        if (bestVNode === null || beforeDiff < bestVDiff) {
          snapX = beforeTarget;
        }
        symXGuide = {
          type: "before",
          targetX: beforeTarget,
          gap: gap,
          span1: { start: beforeTarget, end: a.x },
          span2: { start: a.x, end: b.x },
          y: (a.y + b.y) / 2
        };
      }
    }
  }

  const hasGuides = hGuide || vGuide || symYGuide || symXGuide;
  return {
    snapX,
    snapY,
    guides: hasGuides ? {
      horizontal: hGuide,
      vertical: vGuide,
      symmetryY: symYGuide,
      symmetryX: symXGuide
    } : null
  };
}

function drawSmartGuides(ctx) {
  if (!activeGuides) return;

  const scale = network.getScale();
  const lw = 1.5 / scale;
  const isDark = document.body.classList.contains("dark-mode");
  const alignColor = isDark ? "#58a6ff" : "#0969da";
  const symColor = isDark ? "#c084fc" : "#8b5cf6";
  const symBg = isDark ? "rgba(124, 58, 237, 0.95)" : "rgba(109, 40, 217, 0.95)";

  ctx.save();
  try {
    // 1. Linha de alinhamento horizontal
    if (activeGuides.horizontal) {
      const h = activeGuides.horizontal;
      ctx.beginPath();
      ctx.setLineDash([5 / scale, 4 / scale]);
      ctx.lineWidth = lw;
      ctx.strokeStyle = alignColor;
      ctx.moveTo(h.x1, h.y);
      ctx.lineTo(h.x2, h.y);
      ctx.stroke();

      ctx.setLineDash([]);
      for (const pt of h.points) {
        ctx.beginPath();
        ctx.arc(pt.x, h.y, 4 / scale, 0, Math.PI * 2);
        ctx.fillStyle = alignColor;
        ctx.fill();
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    }

    // 2. Linha de alinhamento vertical
    if (activeGuides.vertical) {
      const v = activeGuides.vertical;
      ctx.beginPath();
      ctx.setLineDash([5 / scale, 4 / scale]);
      ctx.lineWidth = lw;
      ctx.strokeStyle = alignColor;
      ctx.moveTo(v.x, v.y1);
      ctx.lineTo(v.x, v.y2);
      ctx.stroke();

      ctx.setLineDash([]);
      for (const pt of v.points) {
        ctx.beginPath();
        ctx.arc(v.x, pt.y, 4 / scale, 0, Math.PI * 2);
        ctx.fillStyle = alignColor;
        ctx.fill();
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    }

    // 3. Indicadores de Simetria de Espaço Vertical (Y)
    if (activeGuides.symmetryY) {
      const s = activeGuides.symmetryY;
      const dimX = s.x;
      const tickSize = 6 / scale;

      const drawSpanGuideY = (span, gapVal) => {
        const yStart = Math.min(span.start, span.end);
        const yEnd = Math.max(span.start, span.end);
        const midY = (yStart + yEnd) / 2;

        ctx.beginPath();
        ctx.setLineDash([3 / scale, 2 / scale]);
        ctx.lineWidth = lw;
        ctx.strokeStyle = symColor;
        ctx.moveTo(dimX, yStart);
        ctx.lineTo(dimX, yEnd);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(dimX - tickSize, yStart);
        ctx.lineTo(dimX + tickSize, yStart);
        ctx.moveTo(dimX - tickSize, yEnd);
        ctx.lineTo(dimX + tickSize, yEnd);
        ctx.stroke();

        const label = Math.round(gapVal) + "px";
        const fontSize = 11 / scale;
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const textWidth = ctx.measureText(label).width;
        const pillW = textWidth + 12 / scale;
        const pillH = 18 / scale;
        const pillX = dimX - pillW / 2;
        const pillY = midY - pillH / 2;
        const r = 4 / scale;

        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(pillX, pillY, pillW, pillH, r);
        } else {
          ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fillStyle = symBg;
        ctx.fill();
        ctx.lineWidth = 1 / scale;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, dimX, midY);
      };

      drawSpanGuideY(s.span1, s.gap);
      drawSpanGuideY(s.span2, s.gap);
    }

    // 4. Indicadores de Simetria de Espaço Horizontal (X)
    if (activeGuides.symmetryX) {
      const s = activeGuides.symmetryX;
      const dimY = s.y;
      const tickSize = 6 / scale;

      const drawSpanGuideX = (span, gapVal) => {
        const xStart = Math.min(span.start, span.end);
        const xEnd = Math.max(span.start, span.end);
        const midX = (xStart + xEnd) / 2;

        ctx.beginPath();
        ctx.setLineDash([3 / scale, 2 / scale]);
        ctx.lineWidth = lw;
        ctx.strokeStyle = symColor;
        ctx.moveTo(xStart, dimY);
        ctx.lineTo(xEnd, dimY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(xStart, dimY - tickSize);
        ctx.lineTo(xStart, dimY + tickSize);
        ctx.moveTo(xEnd, dimY - tickSize);
        ctx.lineTo(xEnd, dimY + tickSize);
        ctx.stroke();

        const label = Math.round(gapVal) + "px";
        const fontSize = 11 / scale;
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const textWidth = ctx.measureText(label).width;
        const pillW = textWidth + 12 / scale;
        const pillH = 18 / scale;
        const pillX = midX - pillW / 2;
        const pillY = dimY - pillH / 2;
        const r = 4 / scale;

        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(pillX, pillY, pillW, pillH, r);
        } else {
          ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fillStyle = symBg;
        ctx.fill();
        ctx.lineWidth = 1 / scale;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, midX, dimY);
      };

      drawSpanGuideX(s.span1, s.gap);
      drawSpanGuideX(s.span2, s.gap);
    }
  } finally {
    ctx.restore();
  }
}

// Evento de início do arrasto de nó
network.on("dragStart", params => {
  if (params.nodes && params.nodes.length) {
    activeDraggedNodeId = params.nodes[0];
    activeGuides = null;
    hideFloatingElements();

    if (network.interactionHandler?.drag?.selection) {
      network.interactionHandler.drag.selection.forEach(item => {
        item.xFixed = false;
        item.yFixed = false;
      });
    }

    const nodeObj = network.body.nodes[activeDraggedNodeId];
    if (nodeObj?.options?.fixed) {
      nodeObj.options.fixed.x = false;
      nodeObj.options.fixed.y = false;
    }
  }
});

// Intercepta antes do desenho para aplicar o snap magnético
network.on("beforeDrawing", ctx => {
  if (activeDraggedNodeId) {
    const nodeObj = network.body.nodes[activeDraggedNodeId];
    if (nodeObj) {
      const scale = network.getScale();
      const { snapX, snapY, guides } = calculateGuidesAndSnapping(
        activeDraggedNodeId,
        nodeObj.x,
        nodeObj.y,
        scale
      );

      if (snapX !== null) {
        nodeObj.x = snapX;
      }
      if (snapY !== null) {
        nodeObj.y = snapY;
      }
      activeGuides = guides;
    }
  } else {
    activeGuides = null;
  }
});

// Renderiza as guias visuais por cima dos nós e arestas
network.on("afterDrawing", ctx => {
  drawSmartGuides(ctx);
});

// Evento disparado quando o usuário solta o nó arrastado
network.on("dragEnd", params => {
  if (!params.nodes.length) return;

  const draggedNodeId = params.nodes[0];
  const targetNodeId = network.getNodeAt(params.pointer.DOM);

  activeGuides = null;

  if (targetNodeId && targetNodeId !== draggedNodeId) {
    activeDraggedNodeId = null;
    handleNodeReparent(draggedNodeId, targetNodeId);
  } else {
    // Nó movido livremente ou com snap
    const nodeObj = network.body.nodes[draggedNodeId];
    if (nodeObj) {
      nodes.update({
        id: draggedNodeId,
        x: nodeObj.x,
        y: nodeObj.y
      });
      saveToStorage();
    }
    activeDraggedNodeId = null;
    network.redraw();
    selectNode(draggedNodeId);
    updateUI();
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
    deleteChildBranches(currentSelectedNodeId);
  }
});

quickAddLeftBtn.addEventListener("click", event => {
  event.stopPropagation();
  addChildNode("left");
});

quickAddChildBtn.addEventListener("click", event => {
  event.stopPropagation();
  addChildNode("right");
});

quickAddSiblingBtn.addEventListener("click", event => {
  event.stopPropagation();
  addChildNode();
});

document.getElementById("btn-delete")?.addEventListener("click", deleteNode);
document.getElementById("btn-delete-panel")?.addEventListener("click", deleteNode);

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
