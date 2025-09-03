// Variables globales
const socket = io();
let currentUser = null;
let currentRoom = 'general';
let currentRoomId = null;
let typingTimer = null;
let isTyping = false;
let isDarkTheme = true;
let selectedIcon = null;

// Éléments DOM
const elements = {
    // Connexion
    loginSection: document.getElementById('loginSection'),
    usernameInput: document.getElementById('usernameInput'),
    joinBtn: document.getElementById('joinBtn'),
    
    // Profil
    userProfile: document.getElementById('userProfile'),
    currentUsername: document.getElementById('currentUsername'),
    
    // Salles
    roomsSection: document.getElementById('roomsSection'),
    roomsList: document.getElementById('roomsList'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    currentRoom: document.getElementById('currentRoom'),
    
    // Utilisateurs
    usersSection: document.getElementById('usersSection'),
    usersList: document.getElementById('usersList'),
    
    // Messages
    messagesContainer: document.getElementById('messagesContainer'),
    messages: document.getElementById('messages'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    typingIndicator: document.getElementById('typingIndicator'),
    typingUsers: document.getElementById('typingUsers'),
    
    // Interface
    themeToggle: document.getElementById('themeToggle'),
    iconSelector: document.getElementById('iconSelector'),
    appIcon: document.getElementById('appIcon'),
    searchBtn: document.getElementById('searchBtn'),
    searchBar: document.getElementById('searchBar'),
    searchInput: document.getElementById('searchInput'),
    closeSearch: document.getElementById('closeSearch'),
    
    // Sélecteur d'icônes
    iconSelectorModal: document.getElementById('iconSelectorModal'),
    confirmIconChange: document.getElementById('confirmIconChange'),
    cancelIconChange: document.getElementById('cancelIconChange'),
    
    // Emojis et fichiers
    emojiBtn: document.getElementById('emojiBtn'),
    emojiPicker: document.getElementById('emojiPicker'),
    fileBtn: document.getElementById('fileBtn'),
    imageBtn: document.getElementById('imageBtn'),
    fileInput: document.getElementById('fileInput'),
    imageInput: document.getElementById('imageInput'),
    
    // Modal
    createRoomModal: document.getElementById('createRoomModal'),
    newRoomName: document.getElementById('newRoomName'),
    newRoomDescription: document.getElementById('newRoomDescription'),
    confirmCreateRoom: document.getElementById('confirmCreateRoom'),
    cancelCreateRoom: document.getElementById('cancelCreateRoom')
};

// Utilitaires
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function showNotification(title, message, type = 'info') {
    // Créer une notification toast
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <strong>${title}</strong>
            <p>${message}</p>
        </div>
        <button class="notification-close">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Animation d'entrée
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Supprimer automatiquement après 5 secondes
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
    
    // Bouton de fermeture
    notification.querySelector('.notification-close').onclick = () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    };
}

// Gestion des thèmes
function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    document.body.classList.toggle('light-theme', !isDarkTheme);
    
    const icon = elements.themeToggle.querySelector('i');
    icon.className = isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';
    
    localStorage.setItem('chatTheme', isDarkTheme ? 'dark' : 'light');
}

// Charger le thème sauvegardé
function loadTheme() {
    const savedTheme = localStorage.getItem('chatTheme');
    if (savedTheme === 'light') {
        toggleTheme();
    }
}

// Gestion des icônes
function changeAppIcon(iconClass, iconName) {
    // Animation de changement
    elements.appIcon.classList.add('changing');
    
    setTimeout(() => {
        elements.appIcon.className = iconClass;
        elements.appIcon.classList.remove('changing');
        
        // Sauvegarder le choix
        localStorage.setItem('appIcon', iconClass);
        localStorage.setItem('appIconName', iconName);
        
        showNotification('Icône changée', `L'icône de PRIKEB est maintenant : ${iconName}`, 'success');
    }, 250);
}

function loadSavedIcon() {
    const savedIcon = localStorage.getItem('appIcon');
    if (savedIcon) {
        elements.appIcon.className = savedIcon;
    }
}

function openIconSelector() {
    elements.iconSelectorModal.classList.add('show');
    
    // Marquer l'icône actuelle comme sélectionnée
    const currentIconClass = elements.appIcon.className;
    document.querySelectorAll('.icon-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.icon === currentIconClass) {
            option.classList.add('selected');
            selectedIcon = {
                class: currentIconClass,
                name: option.dataset.name
            };
        }
    });
}

function closeIconSelector() {
    elements.iconSelectorModal.classList.remove('show');
    selectedIcon = null;
    
    // Retirer toutes les sélections
    document.querySelectorAll('.icon-option').forEach(option => {
        option.classList.remove('selected');
    });
}

// Gestion des utilisateurs
function updateUsersList(users) {
    elements.usersList.innerHTML = '';
    
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.innerHTML = `
            <div class="avatar">
                <i class="fas fa-user"></i>
            </div>
            <span class="username">${escapeHtml(user.username)}</span>
            <span class="status ${user.status}">${user.status === 'online' ? 'En ligne' : 'Hors ligne'}</span>
        `;
        
        // Clic pour message privé (à implémenter)
        userDiv.onclick = () => {
            if (user.username !== currentUser.username) {
                // Implémenter les messages privés
                console.log('Message privé à', user.username);
            }
        };
        
        elements.usersList.appendChild(userDiv);
    });
}

// Gestion des salles
function updateRoomsList(rooms) {
    elements.roomsList.innerHTML = '';
    
    rooms.forEach(room => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room-item';
        if (room.name === currentRoom) {
            roomDiv.classList.add('active');
        }
        
        roomDiv.innerHTML = `
            <i class="fas fa-hashtag"></i>
            <span>${escapeHtml(room.name)}</span>
            <span class="room-count">${room.message_count || 0}</span>
        `;
        
        roomDiv.onclick = () => joinRoom(room.name);
        elements.roomsList.appendChild(roomDiv);
    });
}

function joinRoom(roomName) {
    if (roomName === currentRoom) return;
    
    currentRoom = roomName;
    elements.currentRoom.textContent = `# ${roomName}`;
    elements.messages.innerHTML = '';
    
    // Mettre à jour l'interface
    document.querySelectorAll('.room-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelectorAll('.room-item').forEach(item => {
        if (item.textContent.includes(roomName)) {
            item.classList.add('active');
        }
    });
    
    socket.emit('join_room', { room: roomName });
}

// Gestion des messages
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.dataset.messageId = data.id;
    
    if (currentUser && data.user_id === currentUser.user_id) {
        messageDiv.classList.add('own');
    }
    
    const reactionsHtml = data.reactions ? data.reactions.map(reaction => 
        `<span class="reaction ${currentUser && reaction.user_id === currentUser.user_id ? 'active' : ''}" 
              data-emoji="${reaction.emoji}" data-message-id="${data.id}">
            ${reaction.emoji} <span class="reaction-count">1</span>
         </span>`
    ).join('') : '';
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-username">${escapeHtml(data.username)}</span>
            <span class="message-timestamp">${data.timestamp}</span>
        </div>
        <div class="message-content" data-message-id="${data.id}">
            ${escapeHtml(data.content)}
        </div>
        <div class="message-reactions">${reactionsHtml}</div>
        <div class="message-actions" style="display: none;">
            <button class="action-btn reaction-btn" data-message-id="${data.id}">
                <i class="fas fa-smile"></i>
            </button>
            <button class="action-btn reply-btn" data-message-id="${data.id}">
                <i class="fas fa-reply"></i>
            </button>
        </div>
    `;
    
    // Ajouter les événements pour les réactions
    messageDiv.addEventListener('mouseenter', () => {
        messageDiv.querySelector('.message-actions').style.display = 'flex';
    });
    
    messageDiv.addEventListener('mouseleave', () => {
        messageDiv.querySelector('.message-actions').style.display = 'none';
    });
    
    // Bouton de réaction
    messageDiv.querySelector('.reaction-btn').onclick = (e) => {
        e.stopPropagation();
        showEmojiPicker(data.id);
    };
    
    elements.messages.appendChild(messageDiv);
    scrollToBottom();
}

// Gestion des réactions
function showEmojiPicker(messageId) {
    elements.emojiPicker.style.display = 'block';
    elements.emojiPicker.dataset.targetMessage = messageId;
    
    // Positionner près du message
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const rect = messageElement.getBoundingClientRect();
        elements.emojiPicker.style.top = `${rect.top - elements.emojiPicker.offsetHeight - 10}px`;
        elements.emojiPicker.style.left = `${rect.left}px`;
    }
}

function addReaction(messageId, emoji) {
    socket.emit('add_reaction', {
        message_id: messageId,
        emoji: emoji
    });
    elements.emojiPicker.style.display = 'none';
}

// Gestion de la frappe
function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        socket.emit('typing', { typing: true });
    }
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        isTyping = false;
        socket.emit('typing', { typing: false });
    }, 1000);
}

function updateTypingIndicator(data) {
    if (data.typing) {
        elements.typingUsers.textContent = data.username;
        elements.typingIndicator.style.display = 'block';
    } else {
        elements.typingIndicator.style.display = 'none';
    }
}

// Fonctions d'envoi
function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message || !currentUser) return;
    
    socket.emit('send_message', {
        message: message
    });
    
    elements.messageInput.value = '';
    
    // Arrêter l'indicateur de frappe
    if (isTyping) {
        isTyping = false;
        socket.emit('typing', { typing: false });
    }
}

// Recherche
function toggleSearch() {
    const isVisible = elements.searchBar.style.display !== 'none';
    elements.searchBar.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        elements.searchInput.focus();
    }
}

function searchMessages() {
    const query = elements.searchInput.value.toLowerCase();
    const messages = document.querySelectorAll('.message');
    
    messages.forEach(message => {
        const content = message.querySelector('.message-content').textContent.toLowerCase();
        const username = message.querySelector('.message-username').textContent.toLowerCase();
        
        if (content.includes(query) || username.includes(query)) {
            message.style.display = 'block';
            if (query) {
                message.classList.add('search-highlight');
            } else {
                message.classList.remove('search-highlight');
            }
        } else if (query) {
            message.style.display = 'none';
        } else {
            message.style.display = 'block';
        }
    });
}

// Event Listeners
elements.joinBtn.onclick = () => {
    const username = elements.usernameInput.value.trim();
    if (username) {
        socket.emit('join_user', { username });
    }
};

elements.usernameInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
        elements.joinBtn.click();
    }
};

elements.sendBtn.onclick = sendMessage;

elements.messageInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    } else {
        handleTyping();
    }
};

elements.themeToggle.onclick = toggleTheme;
elements.iconSelector.onclick = openIconSelector;
elements.searchBtn.onclick = toggleSearch;
elements.closeSearch.onclick = () => {
    elements.searchBar.style.display = 'none';
    elements.searchInput.value = '';
    searchMessages();
};

elements.searchInput.oninput = searchMessages;

elements.emojiBtn.onclick = () => {
    const isVisible = elements.emojiPicker.style.display !== 'none';
    elements.emojiPicker.style.display = isVisible ? 'none' : 'block';
};

// Sélection d'emojis
document.querySelectorAll('.emoji-item').forEach(item => {
    item.onclick = () => {
        const emoji = item.dataset.emoji;
        if (elements.emojiPicker.dataset.targetMessage) {
            addReaction(elements.emojiPicker.dataset.targetMessage, emoji);
        } else {
            elements.messageInput.value += emoji;
            elements.messageInput.focus();
            elements.emojiPicker.style.display = 'none';
        }
    };
});

// Fermer le sélecteur d'emojis en cliquant ailleurs
document.onclick = (e) => {
    if (!elements.emojiPicker.contains(e.target) && !elements.emojiBtn.contains(e.target)) {
        elements.emojiPicker.style.display = 'none';
    }
};

elements.createRoomBtn.onclick = () => {
    elements.createRoomModal.classList.add('show');
    elements.newRoomName.focus();
};

elements.cancelCreateRoom.onclick = () => {
    elements.createRoomModal.classList.remove('show');
    elements.newRoomName.value = '';
    elements.newRoomDescription.value = '';
};

elements.confirmCreateRoom.onclick = () => {
    const roomName = elements.newRoomName.value.trim();
    if (roomName) {
        joinRoom(roomName);
        elements.createRoomModal.classList.remove('show');
        elements.newRoomName.value = '';
        elements.newRoomDescription.value = '';
    }
};

// Event listeners pour le sélecteur d'icônes
elements.cancelIconChange.onclick = closeIconSelector;

elements.confirmIconChange.onclick = () => {
    if (selectedIcon) {
        changeAppIcon(selectedIcon.class, selectedIcon.name);
    }
    closeIconSelector();
};

// Sélection d'icônes
document.querySelectorAll('.icon-option').forEach(option => {
    option.onclick = () => {
        // Retirer la sélection précédente
        document.querySelectorAll('.icon-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Sélectionner la nouvelle icône
        option.classList.add('selected');
        selectedIcon = {
            class: option.dataset.icon,
            name: option.dataset.name
        };
    };
});

// Socket Events
socket.on('connect', () => {
    console.log('Connecté au serveur');
    showNotification('Connexion', 'Connecté au serveur de chat', 'success');
});

socket.on('disconnect', () => {
    console.log('Déconnecté du serveur');
    showNotification('Connexion', 'Déconnecté du serveur', 'warning');
});

socket.on('request_user_info', () => {
    // Le serveur demande les informations utilisateur
});

socket.on('user_joined', (data) => {
    currentUser = data;
    elements.currentUsername.textContent = data.username;
    elements.loginSection.style.display = 'none';
    elements.userProfile.style.display = 'block';
    elements.roomsSection.style.display = 'block';
    elements.usersSection.style.display = 'block';
    elements.messageInput.disabled = false;
    elements.sendBtn.disabled = false;
    
    // Rejoindre la salle générale
    socket.emit('join_room', { room: 'general' });
    
    showNotification('Bienvenue sur PRIKEB', `Connecté en tant que ${data.username}`, 'success');
});

socket.on('room_joined', (data) => {
    currentRoomId = data.room_id;
    showNotification('Salle', `Vous avez rejoint # ${data.room}`, 'info');
});

socket.on('message', displayMessage);

socket.on('reaction_update', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.message_id}"]`);
    if (messageElement) {
        const reactionsContainer = messageElement.querySelector('.message-reactions');
        let reactionElement = reactionsContainer.querySelector(`[data-emoji="${data.emoji}"]`);
        
        if (data.action === 'added') {
            if (!reactionElement) {
                reactionElement = document.createElement('span');
                reactionElement.className = 'reaction';
                reactionElement.dataset.emoji = data.emoji;
                reactionElement.dataset.messageId = data.message_id;
                reactionElement.innerHTML = `${data.emoji} <span class="reaction-count">1</span>`;
                reactionsContainer.appendChild(reactionElement);
            } else {
                const count = parseInt(reactionElement.querySelector('.reaction-count').textContent) + 1;
                reactionElement.querySelector('.reaction-count').textContent = count;
            }
            
            if (currentUser && data.user_id === currentUser.user_id) {
                reactionElement.classList.add('active');
            }
        } else if (reactionElement) {
            const count = parseInt(reactionElement.querySelector('.reaction-count').textContent) - 1;
            if (count <= 0) {
                reactionElement.remove();
            } else {
                reactionElement.querySelector('.reaction-count').textContent = count;
            }
            
            if (currentUser && data.user_id === currentUser.user_id) {
                reactionElement.classList.remove('active');
            }
        }
    }
});

socket.on('user_typing', updateTypingIndicator);

socket.on('user_status_update', (data) => {
    // Mettre à jour la liste des utilisateurs
    fetch('/api/users')
        .then(r => r.json())
        .then(updateUsersList);
    
    if (data.status === 'online') {
        showNotification('Utilisateur', `${data.username} s'est connecté`, 'info');
    }
});

socket.on('error', (data) => {
    showNotification('Erreur', data.message, 'error');
});

// Initialisation
loadTheme();
loadSavedIcon();

// Charger les salles et utilisateurs
setInterval(() => {
    if (currentUser) {
        fetch('/api/rooms').then(r => r.json()).then(updateRoomsList);
        fetch('/api/users').then(r => r.json()).then(updateUsersList);
    }
}, 5000);

// Focus sur le champ nom d'utilisateur au chargement
elements.usernameInput.focus();