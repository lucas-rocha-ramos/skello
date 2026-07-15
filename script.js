// Estado inicial mockado ou carregado do LocalStorage
let boardData = JSON.parse(localStorage.getItem('skelloData')) || [
    { id: 'list-1', title: 'A Fazer', cards: [] },
    { id: 'list-2', title: 'Em Andamento', cards: [] },
    { id: 'list-3', title: 'Concluído', cards: [] }
];

// Função principal de renderização
function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    boardData.forEach(list => {
        const listEl = document.createElement('div');
        listEl.className = 'list';
        listEl.innerHTML = `
            <div class="list-header">${list.title}</div>
            <div class="cards-container" data-list-id="${list.id}" 
                 ondrop="drop(event)" ondragover="allowDrop(event)">
            </div>
            <button class="admin-only" onclick="addCard('${list.id}')">+ Nova Demanda</button>
        `;

        const cardsContainer = listEl.querySelector('.cards-container');
        
        list.cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.draggable = true;
            cardEl.id = card.id;
            cardEl.ondragstart = drag;
            
            cardEl.innerHTML = `
                <div class="card-title">${card.title}</div>
                <div class="card-assignee">􀉮 ${card.assignee}</div>
            `;
            cardsContainer.appendChild(cardEl);
        });

        board.appendChild(listEl);
    });
    
    saveData();
}

// Ações do Administrador
function addList() {
    const title = prompt('Nome da nova lista:');
    if (title) {
        boardData.push({ id: 'list-' + Date.now(), title, cards: [] });
        renderBoard();
    }
}

function addCard(listId) {
    const title = prompt('Descreva a demanda:');
    if (!title) return;
    
    const assignee = prompt('Atribuir para qual usuário?');
    if (!assignee) return;

    const list = boardData.find(l => l.id === listId);
    list.cards.push({
        id: 'card-' + Date.now(),
        title,
        assignee
    });
    
    renderBoard();
}

// Sistema de Arrastar e Soltar (Drag & Drop)
function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
    ev.dataTransfer.setData("sourceList", ev.target.parentElement.dataset.listId);
}

function drop(ev) {
    ev.preventDefault();
    const cardId = ev.dataTransfer.getData("text");
    const sourceListId = ev.dataTransfer.getData("sourceList");
    
    // Identifica o contêiner de destino
    let targetContainer = ev.target;
    if (!targetContainer.classList.contains('cards-container')) {
        targetContainer = targetContainer.closest('.cards-container');
    }
    if (!targetContainer) return;

    const targetListId = targetContainer.dataset.listId;

    // Atualiza os dados internamente
    if (sourceListId !== targetListId) {
        let sourceList = boardData.find(l => l.id === sourceListId);
        let targetList = boardData.find(l => l.id === targetListId);
        
        const cardIndex = sourceList.cards.findIndex(c => c.id === cardId);
        const [movedCard] = sourceList.cards.splice(cardIndex, 1);
        
        targetList.cards.push(movedCard);
        renderBoard();
    }
}

// Controle de Perfis (Admin / Usuário)
function changeRole() {
    const role = document.getElementById('roleSelect').value;
    document.body.setAttribute('data-role', role);
}

// Persistência de Dados
function saveData() {
    localStorage.setItem('skelloData', JSON.stringify(boardData));
}

// Inicialização
document.body.setAttribute('data-role', 'admin');
renderBoard();
