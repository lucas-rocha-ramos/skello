// COLE A URL DO SEU GOOGLE APPS SCRIPT AQUI DENTRO DAS ASPAS
const API_URL = 'https://script.google.com/macros/s/AKfycbzGBEd76N8X55EGEYChxBwmBPwgmBf44DMZ1HesRubd1dHZ3E8-4bFU_4icp7YLuE8e1w/exec'; 

let currentUser = null;
let allUsers = [];

// Comunicação com o Back-end
async function apiCall(data) {
    const response = await fetch(API_URL, {
        method: 'POST',
        // Enviamos como text/plain para evitar bloqueio de CORS no navegador
        body: JSON.stringify(data) 
    });
    return response.json();
}

// Autenticação
async function login() {
    const nome = document.getElementById('username').value;
    const senha = document.getElementById('password').value;
    showMessage('Autenticando...');
    
    const res = await apiCall({ action: 'login', nome, senha });
    if (res.success) {
        startApp(res.user);
    } else {
        showMessage(res.error);
    }
}

async function register() {
    const nome = document.getElementById('username').value;
    const senha = document.getElementById('password').value;
    if(!nome || !senha) return showMessage('Preencha os campos!');
    showMessage('Criando conta...');
    
    const res = await apiCall({ action: 'register', nome, senha });
    if (res.success) {
        startApp(res.user);
    } else {
        showMessage('Erro ao registrar.');
    }
}

function showMessage(msg) {
    document.getElementById('auth-msg').innerText = msg;
}

function logout() {
    currentUser = null;
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
}

// Inicialização da Aplicação
async function startApp(user) {
    currentUser = user;
    document.body.setAttribute('data-role', user.role);
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    document.getElementById('user-display').innerText = `Olá, ${user.nome} (${user.role})`;
    
    loadBoard();
}

// Renderização do Kanban
async function loadBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '<div class="loader">Carregando dados...</div>';
    
    const res = await apiCall({ action: 'getData' });
    if (!res.success) return alert('Erro ao carregar dados');

    allUsers = res.usuarios; // Salva para o dropdown de assignees
    board.innerHTML = '';

    res.listas.forEach(list => {
        const listCards = res.cards.filter(c => c.listId === list.id);
        
        const listEl = document.createElement('div');
        listEl.className = 'list';
        listEl.innerHTML = `
            <div class="list-header">${list.title}</div>
            <div class="cards-container" data-list-id="${list.id}" 
                 ondrop="drop(event)" ondragover="allowDrop(event)">
            </div>
            <button class="add-btn admin-only" onclick="addCard('${list.id}')">+ Nova Demanda</button>
        `;

        const container = listEl.querySelector('.cards-container');
        listCards.forEach(card => renderCard(card, container));
        board.appendChild(listEl);
    });
}

function renderCard(card, container) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.draggable = true;
    cardEl.id = card.id;
    cardEl.ondragstart = drag;
    cardEl.innerHTML = `
        <div class="card-title">${card.title}</div>
        <div class="card-assignee">👤 ${card.assignee}</div>
    `;
    container.appendChild(cardEl);
}

// Ações do Admin
async function addList() {
    const title = prompt('Nome da nova lista:');
    if (!title) return;
    
    // Atualização Otimista (mostra na tela antes de salvar para parecer rápido)
    loadBoard(); // recarrega p/ prevenir bugs, ideal seria injetar na DOM
    await apiCall({ action: 'addList', title });
    loadBoard();
}

async function addCard(listId) {
    const title = prompt('Descreva a demanda:');
    if (!title) return;
    
    const assignee = prompt(`Atribuir para qual usuário?\nUsuários disponíveis: ${allUsers.join(', ')}`);
    if (!assignee) return;

    await apiCall({ action: 'addCard', title, assignee, listId });
    loadBoard();
}

// Drag and Drop (Movimentação com persistência no Google Sheets)
function allowDrop(ev) { ev.preventDefault(); }

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
    ev.dataTransfer.setData("sourceList", ev.target.parentElement.dataset.listId);
}

function drop(ev) {
    ev.preventDefault();
    const cardId = ev.dataTransfer.getData("text");
    const sourceListId = ev.dataTransfer.getData("sourceList");
    
    let targetContainer = ev.target;
    if (!targetContainer.classList.contains('cards-container')) {
        targetContainer = targetContainer.closest('.cards-container');
    }
    if (!targetContainer) return;

    const targetListId = targetContainer.dataset.listId;

    if (sourceListId !== targetListId) {
        // Move visualmente
        const cardEl = document.getElementById(cardId);
        targetContainer.appendChild(cardEl);
        
        // Salva no banco (Google Sheets) em background
        apiCall({ action: 'moveCard', cardId: cardId, newListId: targetListId });
    }
}
