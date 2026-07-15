const API_URL = 'https://script.google.com/macros/s/AKfycbzGBEd76N8X55EGEYChxBwmBPwgmBf44DMZ1HesRubd1dHZ3E8-4bFU_4icp7YLuE8e1w/exec'; 

let currentUser = null;
let allUsers = [];
let allCards = [];
let currentTargetListId = null; 
let activeCardId = null;

// Lógica de Autenticação
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
    const res = await apiCall({ action: 'login', nome: document.getElementById('username').value, senha: document.getElementById('password').value });
    if (res.success) startApp(res.user); else document.getElementById('auth-msg').innerText = res.error;
}

async function register() {
    const data = { action: 'register', type: document.querySelector('input[name="authType"]:checked').value, nome: document.getElementById('username').value, senha: document.getElementById('password').value, email: document.getElementById('email').value, zap: document.getElementById('zap').value, companyCode: document.getElementById('companyCode').value };
    if(!data.nome || !data.senha) return document.getElementById('auth-msg').innerText = 'Preencha os campos!';
    const res = await apiCall(data);
    if (res.success) startApp(res.user); else document.getElementById('auth-msg').innerText = res.error;
}

function logout() { currentUser = null; document.getElementById('app-screen').style.display = 'none'; document.getElementById('auth-screen').style.display = 'flex'; }

// Controle de Modais
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showConfig() { document.getElementById('display-company-code').innerText = currentUser.companyCode; openModal('config-modal'); }

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
    allCards = res.cards;
    board.innerHTML = '';

    res.listas.forEach(list => {
        const listCards = allCards.filter(c => c.listId === list.id);
        const listEl = document.createElement('div');
        listEl.className = 'list'; listEl.draggable = currentUser.role === 'admin'; listEl.id = list.id; listEl.ondragstart = dragList;
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

function renderCard(card, container) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card'; cardEl.draggable = true; cardEl.id = card.id; cardEl.ondragstart = dragCard;
    
    let capaHtml = card.capa ? `<div class="card-cover" style="background-color: ${card.capa}"></div>` : '';
    let etiqHtml = card.etiquetas ? `<div class="card-label">${card.etiquetas}</div>` : '';
    let dataHtml = card.data ? `<div class="card-date">􀐫 ${card.data}</div>` : '';

    cardEl.innerHTML = `
        ${capaHtml}
        <button class="edit-pencil admin-only" onclick="openQuickMenu(event, '${card.id}')">✎</button>
        ${etiqHtml}
        <div class="card-header-row">
            <div class="check-circle" onclick="toggleCheck(event, this)"></div>
            <div class="card-title" onclick="openCardDetails('${card.id}')">${card.title}</div>
        </div>
        <div class="card-footer-row">
            <div class="card-assignee">􀉮 ${card.assignee}</div>
            ${dataHtml}
        </div>
    `;
    container.appendChild(cardEl);
}

// Criações Simples
function openNewListModal() { document.getElementById('input-new-list-title').value = ''; openModal('modal-new-list'); }
async function confirmAddList() {
    const title = document.getElementById('input-new-list-title').value; if (!title) return;
    closeModal('modal-new-list');
    await apiCall({ action: 'addList', title, companyCode: currentUser.companyCode, pos: document.querySelectorAll('.list').length });
    loadBoard();
}

function openNewCardModal(listId) {
    currentTargetListId = listId; document.getElementById('input-new-card-title').value = '';
    const select = document.getElementById('select-new-card-assignee');
    select.innerHTML = '<option value="">Selecione um funcionário...</option>' + allUsers.map(u => `<option value="${u}">${u}</option>`).join('');
    openModal('modal-new-card');
}
async function confirmAddCard() {
    const title = document.getElementById('input-new-card-title').value;
    const assignee = document.getElementById('select-new-card-assignee').value;
    if (!title || !assignee) return alert("Preencha título e funcionário.");
    closeModal('modal-new-card');
    await apiCall({ action: 'addCard', title, assignee, listId: currentTargetListId, companyCode: currentUser.companyCode });
    loadBoard();
}

// ----------------- NOVO SISTEMA DE AÇÕES E ATUALIZAÇÕES -----------------
async function updateCardField(cardId, field, value) {
    await apiCall({ action: 'updateCard', cardId, field, value });
    loadBoard();
}

function openQuickMenu(event, cardId) {
    event.stopPropagation(); activeCardId = cardId;
    const menu = document.getElementById('quick-actions-menu');
    menu.style.display = 'flex'; menu.style.left = event.pageX + 'px'; menu.style.top = event.pageY + 'px';
}
document.addEventListener('click', () => document.getElementById('quick-actions-menu').style.display = 'none');

function openCardDetails(cardId) {
    activeCardId = cardId || activeCardId;
    const card = allCards.find(c => c.id === activeCardId);
    document.getElementById('detail-card-title').innerText = card.title;
    document.getElementById('detail-description').value = card.descricao || '';
    openModal('modal-card-details');
}

function saveDescription(val) { updateCardField(activeCardId, 'descricao', val); }

function toggleCheck(event, el) { event.stopPropagation(); el.closest('.card').classList.toggle('completed'); }
function toggleDetailCheck(el) { el.classList.toggle('completed'); }

// Central de Ações do Card
function cardAction(action) {
    const cardObj = allCards.find(c => c.id === activeCardId);
    
    if(action === 'abrir') openCardDetails();
    if(action === 'etiquetas') {
        const val = prompt('Digite o nome da etiqueta (ex: URGENTE, Frontend, Bug):');
        if(val !== null) updateCardField(activeCardId, 'etiquetas', val);
    }
    if(action === 'membros') {
        const val = prompt(`Atribuir para outro membro.\nDigite o nome exato. Membros disponíveis: ${allUsers.join(', ')}`);
        if(val) updateCardField(activeCardId, 'assignee', val);
    }
    if(action === 'capa') {
        const val = prompt('Digite a cor da capa em inglês ou código Hexadecimal\nEx: red, blue, #ff3b30, #34c759, orange');
        if(val !== null) updateCardField(activeCardId, 'capa', val);
    }
    if(action === 'datas') {
        const val = prompt('Digite a data de entrega (ex: 20 Out):');
        if(val !== null) updateCardField(activeCardId, 'data', val);
    }
    if(action === 'mover') alert('Para mover, clique e segure o cartão (Drag & Drop) e arraste até a lista desejada.');
    if(action === 'jira') alert('A integração com Jira exige chaves de API Enterprise.');
    if(action === 'copiar_cartao') {
        const title = prompt('Qual será o título da cópia?', cardObj.title + ' (Cópia)');
        if(title) { apiCall({ action: 'copyCard', cardId: activeCardId, newTitle: title }).then(loadBoard); }
    }
    if(action === 'copiar_link') {
        navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?card=${activeCardId}`);
        alert('Link do cartão copiado para a área de transferência!');
    }
    if(action === 'espelho') alert('A criação de cartões espelhados está em desenvolvimento.');
    if(action === 'arquivar') {
        if(confirm('Tem certeza que deseja arquivar e ocultar este cartão?')) updateCardField(activeCardId, 'arquivado', true);
    }
}

// Drag & Drop
function allowDrop(ev) { ev.preventDefault(); }
function dragCard(ev) { ev.stopPropagation(); ev.dataTransfer.setData("type", "card"); ev.dataTransfer.setData("id", ev.target.id); ev.dataTransfer.setData("sourceList", ev.target.parentElement.dataset.listId); }
function dropCard(ev) {
    ev.preventDefault(); ev.stopPropagation(); if (ev.dataTransfer.getData("type") !== "card") return;
    const cardId = ev.dataTransfer.getData("id"), sourceListId = ev.dataTransfer.getData("sourceList");
    let targetContainer = ev.target.closest('.cards-container'); if (!targetContainer) return;
    const targetListId = targetContainer.dataset.listId;
    if (sourceListId !== targetListId) { targetContainer.appendChild(document.getElementById(cardId)); apiCall({ action: 'moveCard', cardId, newListId: targetListId }); }
}
function allowDropList(ev) { ev.preventDefault(); }
function dragList(ev) { ev.dataTransfer.setData("type", "list"); ev.dataTransfer.setData("id", ev.target.id); }
function dropList(ev) {
    ev.preventDefault(); if (ev.dataTransfer.getData("type") !== "list") return;
    const draggedEl = document.getElementById(ev.dataTransfer.getData("id")); let targetEl = ev.target.closest('.list');
    const board = document.getElementById('board');
    if (targetEl && targetEl !== draggedEl) {
        const rect = targetEl.getBoundingClientRect();
        if (ev.clientX < rect.left + rect.width / 2) board.insertBefore(draggedEl, targetEl); else board.insertBefore(draggedEl, targetEl.nextSibling);
        apiCall({ action: 'reorderLists', listIds: Array.from(board.querySelectorAll('.list')).map(l => l.id) });
    }
}
