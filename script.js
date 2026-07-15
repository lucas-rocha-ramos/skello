const API_URL = 'https://script.google.com/macros/s/AKfycbzGBEd76N8X55EGEYChxBwmBPwgmBf44DMZ1HesRubd1dHZ3E8-4bFU_4icp7YLuE8e1w/exec'; 

let currentUser = null;
let allUsers = [];

function toggleAuthFields() {
    const type = document.querySelector('input[name="authType"]:checked').value;
    document.getElementById('fields-empresa').style.display = type === 'empresa' ? 'block' : 'none';
    document.getElementById('fields-user').style.display = type === 'user' ? 'block' : 'none';
}

async function apiCall(data) {
    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    return response.json();
}

async function login() {
    const nome = document.getElementById('username').value;
    const senha = document.getElementById('password').value;
    showMessage('Autenticando...');
    
    const res = await apiCall({ action: 'login', nome, senha });
    if (res.success) startApp(res.user);
    else showMessage(res.error);
}

async function register() {
    const type = document.querySelector('input[name="authType"]:checked').value;
    const nome = document.getElementById('username').value;
    const senha = document.getElementById('password').value;
    const email = document.getElementById('email').value;
    const zap = document.getElementById('zap').value;
    const companyCode = document.getElementById('companyCode').value;

    if(!nome || !senha) return showMessage('Preencha nome e senha!');
    showMessage('Criando conta...');
    
    const res = await apiCall({ action: 'register', type, nome, senha, email, zap, companyCode });
    if (res.success) startApp(res.user);
    else showMessage(res.error || 'Erro ao registrar.');
}

function showMessage(msg) { document.getElementById('auth-msg').innerText = msg; }

function logout() {
    currentUser = null;
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
}

function showConfig() {
    document.getElementById('display-company-code').innerText = currentUser.companyCode;
    document.getElementById('config-modal').style.display = 'flex';
}
function closeConfig() { document.getElementById('config-modal').style.display = 'none'; }

async function startApp(user) {
    currentUser = user;
    document.body.setAttribute('data-role', user.role);
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    document.getElementById('user-display').innerText = `Olá, ${user.nome} (${user.role === 'admin' ? 'Empresa' : 'Funcionário'})`;
    loadBoard();
}

async function loadBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '<div class="loader">Carregando workspace...</div>';
    
    const res = await apiCall({ action: 'getData', companyCode: currentUser.companyCode });
    if (!res.success) return alert('Erro ao carregar dados');

    allUsers = res.usuarios;
    board.innerHTML = '';

    res.listas.forEach(list => {
        const listCards = res.cards.filter(c => c.listId === list.id);
        const listEl = document.createElement('div');
        listEl.className = 'list';
        listEl.draggable = currentUser.role === 'admin';
        listEl.id = list.id;
        listEl.ondragstart = dragList;
        
        listEl.innerHTML = `
            <div class="list-header">${list.title}</div>
            <div class="cards-container" data-list-id="${list.id}" 
                 ondrop="dropCard(event)" ondragover="allowDrop(event)">
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
    cardEl.ondragstart = dragCard;
    cardEl.innerHTML = `
        <div class="card-title">${card.title}</div>
        <div class="card-assignee">􀉮 ${card.assignee}</div>
    `;
    container.appendChild(cardEl);
}

async function addList() {
    const title = prompt('Nome da nova lista:');
    if (!title) return;
    const pos = document.querySelectorAll('.list').length;
    await apiCall({ action: 'addList', title, companyCode: currentUser.companyCode, pos });
    loadBoard();
}

async function addCard(listId) {
    const title = prompt('Descreva a demanda:');
    if (!title) return;
    const assignee = prompt(`Atribuir para quem?\nEquipe: ${allUsers.join(', ')}`);
    if (!assignee) return;
    await apiCall({ action: 'addCard', title, assignee, listId, companyCode: currentUser.companyCode });
    loadBoard();
}

// Drag & Drop: CARDS
function allowDrop(ev) { ev.preventDefault(); }
function dragCard(ev) {
    ev.stopPropagation(); // Impede que a lista seja arrastada junto
    ev.dataTransfer.setData("type", "card");
    ev.dataTransfer.setData("id", ev.target.id);
    ev.dataTransfer.setData("sourceList", ev.target.parentElement.dataset.listId);
}
function dropCard(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer.getData("type") !== "card") return;
    
    const cardId = ev.dataTransfer.getData("id");
    const sourceListId = ev.dataTransfer.getData("sourceList");
    
    let targetContainer = ev.target;
    if (!targetContainer.classList.contains('cards-container')) {
        targetContainer = targetContainer.closest('.cards-container');
    }
    if (!targetContainer) return;

    const targetListId = targetContainer.dataset.listId;
    if (sourceListId !== targetListId) {
        targetContainer.appendChild(document.getElementById(cardId));
        apiCall({ action: 'moveCard', cardId: cardId, newListId: targetListId });
    }
}

// Drag & Drop: LISTAS
function allowDropList(ev) { ev.preventDefault(); }
function dragList(ev) {
    ev.dataTransfer.setData("type", "list");
    ev.dataTransfer.setData("id", ev.target.id);
}
function dropList(ev) {
    ev.preventDefault();
    if (ev.dataTransfer.getData("type") !== "list") return;
    
    const draggedId = ev.dataTransfer.getData("id");
    const draggedEl = document.getElementById(draggedId);
    let targetEl = ev.target.closest('.list');
    
    const board = document.getElementById('board');
    if (targetEl && targetEl !== draggedEl) {
        // Insere antes ou depois dependendo da posição do mouse
        const rect = targetEl.getBoundingClientRect();
        if (ev.clientX < rect.left + rect.width / 2) {
            board.insertBefore(draggedEl, targetEl);
        } else {
            board.insertBefore(draggedEl, targetEl.nextSibling);
        }
        
        // Salva a nova ordem no backend
        const listIds = Array.from(board.querySelectorAll('.list')).map(l => l.id);
        apiCall({ action: 'reorderLists', listIds });
    }
}
