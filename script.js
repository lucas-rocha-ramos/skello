const API_URL = 'https://script.google.com/macros/s/AKfycbzGBEd76N8X55EGEYChxBwmBPwgmBf44DMZ1HesRubd1dHZ3E8-4bFU_4icp7YLuE8e1w/exec'; 

let currentUser = null;
let allUsers = [];
let currentTargetListId = null; 
let activeCardId = null;

// Lógica de Autenticação (Mantida)
function toggleAuthFields() {
    const type = document.querySelector('input[name="authType"]:checked').value;
    document.getElementById('fields-empresa').style.display = type === 'empresa' ? 'block' : 'none';
    document.getElementById('fields-user').style.display = type === 'user' ? 'block' : 'none';
}

async function apiCall(data) {
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
    return response.json();
}

async function login() {
    const nome = document.getElementById('username').value;
    const senha = document.getElementById('password').value;
    const res = await apiCall({ action: 'login', nome, senha });
    if (res.success) startApp(res.user);
    else document.getElementById('auth-msg').innerText = res.error;
}

async function register() {
    const type = document.querySelector('input[name="authType"]:checked').value;
    const nome = document.getElementById('username').value;
    const senha = document.getElementById('password').value;
    const email = document.getElementById('email').value;
    const zap = document.getElementById('zap').value;
    const companyCode = document.getElementById('companyCode').value;

    if(!nome || !senha) return document.getElementById('auth-msg').innerText = 'Preencha nome e senha!';
    const res = await apiCall({ action: 'register', type, nome, senha, email, zap, companyCode });
    if (res.success) startApp(res.user);
    else document.getElementById('auth-msg').innerText = res.error || 'Erro ao registrar.';
}

function logout() {
    currentUser = null;
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
}

// Controle de Modais
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showConfig() {
    document.getElementById('display-company-code').innerText = currentUser.companyCode;
    openModal('config-modal');
}

// Inicialização e Carregamento do Board
async function startApp(user) {
    currentUser = user;
    document.body.setAttribute('data-role', user.role);
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    document.getElementById('user-display').innerText = `Olá, ${user.nome}`;
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
            <div class="cards-container" data-list-id="${list.id}" ondrop="dropCard(event)" ondragover="allowDrop(event)"></div>
            <button class="add-btn admin-only" onclick="openNewCardModal('${list.id}')">+ Nova Demanda</button>
        `;

        const container = listEl.querySelector('.cards-container');
        listCards.forEach(card => renderCard(card, container));
        board.appendChild(listEl);
    });
}

// Renderização do Card com Sistema de Checklist e Lápis
function renderCard(card, container) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.draggable = true;
    cardEl.id = card.id;
    cardEl.ondragstart = dragCard;
    
    // Simula estado de check baseado numa classe local
    cardEl.innerHTML = `
        <button class="edit-pencil admin-only" onclick="openQuickMenu(event, '${card.id}')">✎</button>
        <div class="card-header-row">
            <div class="check-circle" onclick="toggleCheck(event, this)"></div>
            <div class="card-title" onclick="openCardDetails('${card.id}', '${card.title}')">${card.title}</div>
        </div>
        <div class="card-assignee">􀉮 ${card.assignee}</div>
    `;
    container.appendChild(cardEl);
}

// --- NOVAS FUNÇÕES DE MODAIS (Substituindo os Prompts) ---

function openNewListModal() {
    document.getElementById('input-new-list-title').value = '';
    openModal('modal-new-list');
}

async function confirmAddList() {
    const title = document.getElementById('input-new-list-title').value;
    if (!title) return;
    closeModal('modal-new-list');
    const pos = document.querySelectorAll('.list').length;
    await apiCall({ action: 'addList', title, companyCode: currentUser.companyCode, pos });
    loadBoard();
}

function openNewCardModal(listId) {
    currentTargetListId = listId;
    document.getElementById('input-new-card-title').value = '';
    
    const select = document.getElementById('select-new-card-assignee');
    select.innerHTML = '<option value="">Selecione um funcionário...</option>';
    allUsers.forEach(user => {
        select.innerHTML += `<option value="${user}">${user}</option>`;
    });
    
    openModal('modal-new-card');
}

async function confirmAddCard() {
    const title = document.getElementById('input-new-card-title').value;
    const assignee = document.getElementById('select-new-card-assignee').value;
    if (!title || !assignee) return alert("Preencha o título e selecione o funcionário.");
    
    closeModal('modal-new-card');
    await apiCall({ action: 'addCard', title, assignee, listId: currentTargetListId, companyCode: currentUser.companyCode });
    loadBoard();
}

// --- FUNÇÕES DE CHECKLIST E MENUS ---

function toggleCheck(event, element) {
    event.stopPropagation(); // Evita arrastar o card
    const card = element.closest('.card');
    card.classList.toggle('completed');
}

function toggleDetailCheck(element) {
    element.classList.toggle('completed');
    // Sincroniza visualmente com o card menor por fora
    if(activeCardId) {
        const outsideCard = document.getElementById(activeCardId);
        if(element.classList.contains('completed')) outsideCard.classList.add('completed');
        else outsideCard.classList.remove('completed');
    }
}

function openQuickMenu(event, cardId) {
    event.stopPropagation();
    activeCardId = cardId;
    const menu = document.getElementById('quick-actions-menu');
    
    // Pega a posição do mouse para abrir o menu exatamente onde clicou
    menu.style.display = 'flex';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
}

// Fecha o context menu se clicar fora
document.addEventListener('click', () => {
    document.getElementById('quick-actions-menu').style.display = 'none';
});

function openCardDetails(cardId, title) {
    // Se veio do Menu Rápido, title pode estar vazio, então pegamos da DOM
    if(!title && activeCardId) {
        title = document.querySelector(`#${activeCardId} .card-title`).innerText;
    }
    
    activeCardId = cardId || activeCardId;
    document.getElementById('detail-card-title').innerText = title;
    openModal('modal-card-details');
}

// --- DRAG & DROP (Mantido) ---
function allowDrop(ev) { ev.preventDefault(); }
function dragCard(ev) {
    ev.stopPropagation(); 
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
    
    let targetContainer = ev.target.closest('.cards-container');
    if (!targetContainer) return;

    const targetListId = targetContainer.dataset.listId;
    if (sourceListId !== targetListId) {
        targetContainer.appendChild(document.getElementById(cardId));
        apiCall({ action: 'moveCard', cardId: cardId, newListId: targetListId });
    }
}

function allowDropList(ev) { ev.preventDefault(); }
function dragList(ev) {
    ev.dataTransfer.setData("type", "list");
    ev.dataTransfer.setData("id", ev.target.id);
}
function dropList(ev) {
    ev.preventDefault();
    if (ev.dataTransfer.getData("type") !== "list") return;
    
    const draggedEl = document.getElementById(ev.dataTransfer.getData("id"));
    let targetEl = ev.target.closest('.list');
    
    const board = document.getElementById('board');
    if (targetEl && targetEl !== draggedEl) {
        const rect = targetEl.getBoundingClientRect();
        if (ev.clientX < rect.left + rect.width / 2) board.insertBefore(draggedEl, targetEl);
        else board.insertBefore(draggedEl, targetEl.nextSibling);
        
        const listIds = Array.from(board.querySelectorAll('.list')).map(l => l.id);
        apiCall({ action: 'reorderLists', listIds });
    }
}
