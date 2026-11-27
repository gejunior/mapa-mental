# ✦ Mapa Mental

Uma aplicação web interativa, leve e moderna para criação, organização, personalização e visualização de mapas mentais diretamente no navegador, sem necessidade de cadastro ou instalação de dependências pesadas.

---

## 🚀 Funcionalidades

### 🧠 Estruturação Flexível de Ideias
- **Navegação Multidirecional**: Crie nós filhos tanto para a **direita** quanto para a **esquerda** do nó central.
- **Criação Acima e Abaixo**: Adicione ideias filhas ou irmãs acima ou abaixo da célula atual por botões dedicados ou atalhos de teclado.
- **Posicionamento 2D Totalmente Livre**: Mova e ajuste nós livremente pelo canvas na horizontal e na vertical.
- **Reorganização de Ramos (Reparenting)**: Arraste uma célula e solte-a sobre outro nó para transferir todo o ramo hierarquicamente.

### 📐 Guias Inteligentes e Alinhamento Magnético (Smart Guides)
- **Sugestão de Alinhamento**: Ao arrastar nós, linhas-guia magnéticas indicam o alinhamento horizontal (eixo Y) e vertical (eixo X) com células vizinhas e nós irmãos.
- **Simetria de Espaçamento**: O sistema calcula e sinaliza visualmente com réguas e medições em pixels quando o espaçamento entre células consecutivas for simétrico.
- **Snapping Magnético**: Encaixe suave automático ao aproximar nós das posições alinhadas.

### 📂 Colapsar e Expandir Ramos (Sem Excluir Dados)
- **Recolhimento Seguro**: Oculte ramos inteiros para focar apenas nas partes relevantes do mapa, sem risco de apagar as células.
- **Indicador Visual no Canvas**: Células com ramos recolhidos exibem um badge azul circular (`+` ou contador de nós) no Canvas mesmo quando não selecionadas.
- **Botão Alternador Dinâmico**: O botão circular ao lado da célula altera entre `−` (Recolher) e `+` (Expandir) com estilos visuais claros.
- **Arrasto de Nó Recolhido**: Mover uma célula recolhida translada todos os seus filhos ocultos, preservando a diagramação relativa ao expandir.

### 🎨 Estilização e Formatação Visual
- **Paleta de Cores com Borda Proporcional**:
  - Seleção de cor de fundo personalizada para cada célula.
  - O sistema calcula e aplica automaticamente uma **borda elegante cerca de 35% a 50% mais escura**, gerando alto contraste, profundidade e acabamento refinado.
- **Tipografia Completa**:
  - **Negrito** (`Ctrl + B`), **Itálico** (`Ctrl + I`) e **Sublinhado** (`Ctrl + U`).
  - Cor da fonte personalizável com seletor de cor.
  - Ajuste de tamanho da fonte (de 11px a 24px) em tempo real.
- **Inserção de Imagens**: Anexe fotos e ilustrações às células com validação preventiva de tamanho (máximo 2MB) para garantir performance.

### 🧭 Navegação, Produtividade e Utilidades
- **Centralização Instantânea (Fit View)**: Centralize e ajuste o zoom de todo o mapa mental na tela com um único clique (botão no topo, botão flutuante, duplo clique no fundo vazio ou atalho <kbd>Espaço</kbd> / <kbd>Ctrl + 0</kbd>).
- **Desfazer e Refazer (Undo / Redo)**: Histórico completo de ações via botões da interface ou atalhos <kbd>Ctrl + Z</kbd> e <kbd>Ctrl + Y</kbd>.
- **Salvamento Automático**: O mapa é salvo continuamente no `localStorage` do navegador com indicador de status em tempo real.
- **Exportação para Imagem**: Salve o mapa completo como imagem PNG de alta resolução.
- **Modo Escuro (Dark Mode)**: Tema escuro integrado com alternância instantânea e persistência de preferência.
- **Pan com o Botão do Meio**: Mova livremente a área de visualização segurando e arrastando com o botão do meio do mouse (scroll click).

---

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
| :--- | :--- |
| <kbd>Tab</kbd> | Adicionar nó filho abaixo |
| <kbd>Shift</kbd> + <kbd>Tab</kbd> | Adicionar nó filho acima |
| <kbd>Enter</kbd> | Adicionar nó irmão abaixo |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | Adicionar nó irmão acima |
| <kbd>/</kbd> ou <kbd>C</kbd> | Recolher / Expandir ramos filhos |
| <kbd>Espaço</kbd> / <kbd>Ctrl</kbd> + <kbd>0</kbd> / <kbd>Home</kbd> / <kbd>F</kbd> | Centralizar visão do mapa mental |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> | Alternar negrito na fonte |
| <kbd>Ctrl</kbd> + <kbd>I</kbd> | Alternar itálico na fonte |
| <kbd>Ctrl</kbd> + <kbd>U</kbd> | Alternar sublinhado na fonte |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Desfazer última alteração |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> | Refazer última alteração |
| <kbd>Delete</kbd> ou <kbd>Backspace</kbd> | Excluir nó selecionado |
| **Duplo clique na célula** | Editar texto diretamente |
| **Duplo clique no fundo** | Centralizar visão no mapa completo |
| **Botão do meio do mouse** | Arrastar visualização (Pan) |

---

## 📁 Estrutura do Projeto

```text
mapa-mental/
├── index.html              # Estrutura HTML5 da página, menus e containers
├── README.md               # Documentação explicativa do projeto
└── assets/
    ├── css/
    │   └── styles.css      # Estilização completa, variáveis, temas e animações
    └── js/
        └── main.js         # Lógica central, integração Vis.js, eventos e estado
```

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3**: Interface responsiva, botões flutuantes, inputs nativos e variáveis CSS.
- **JavaScript (ES6+)**: Manipulação de estado reativa, histórico de snapshots e tratamento de eventos.
- **Canvas 2D API**: Renderização de sublinhados, réguas inteligentes de simetria, alinhamento e badges de colapso.
- **[vis-network](https://visjs.github.io/vis-network/)**: Biblioteca para renderização do grafo de nós e arestas com curvas de Bézier cúbicas.
- **LocalStorage API**: Armazenamento local persistente dos nós, arestas, temas e estados colapsados.

---

## 🖥️ Como Executar

Por ser uma aplicação web estática client-side, você não precisa instalar bibliotecas adicionais:

1. Clone ou baixe este repositório.
2. Abra o arquivo `index.html` em qualquer navegador moderno (Chrome, Brave, Firefox, Edge, etc.).
3. *(Opcional)* Se preferir rodar com um servidor local estático simples:
   ```bash
   # Com Node.js:
   npx serve .

   # Ou com Python:
   python3 -m http.server 8080
   ```
4. Acesse `http://localhost:8080` (ou a porta informada pelo servidor).

---

## 📄 Licença

Este projeto é de uso livre para estudos, organização pessoal e desenvolvimento contínuo.
