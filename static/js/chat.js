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
    // Authentification
    authSection: document.getElementById('authSection'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    
    // Connexion
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    loginStatus: document.getElementById('loginStatus'),
    loginBtn: document.getElementById('loginBtn'),
    showRegister: document.getElementById('showRegister'),
    
    // Inscription
    registerUsername: document.getElementById('registerUsername'),
    registerEmail: document.getElementById('registerEmail'),
    registerPassword: document.getElementById('registerPassword'),
    registerStatus: document.getElementById('registerStatus'),
    registerBtn: document.getElementById('registerBtn'),
    showLogin: document.getElementById('showLogin'),
    
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
    searchUsersBtn: document.getElementById('searchUsersBtn'),
    userSearchContainer: document.getElementById('userSearchContainer'),
    userSearchInput: document.getElementById('userSearchInput'),
    closeUserSearch: document.getElementById('closeUserSearch'),
    searchResults: document.getElementById('searchResults'),
    
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

// Gestion de l'authentification
function showLoginForm() {
    elements.loginForm.style.display = 'block';
    elements.registerForm.style.display = 'none';
    clearAuthStatus();
}

function showRegisterForm() {
    elements.loginForm.style.display = 'none';
    elements.registerForm.style.display = 'block';
    clearAuthStatus();
}

function clearAuthStatus() {
    elements.loginStatus.textContent = '';
    elements.loginStatus.className = 'auth-status';
    elements.registerStatus.textContent = '';
    elements.registerStatus.className = 'auth-status';
}

function validateEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
}

function validateUsername(username) {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    if (!cleanUsername || cleanUsername.length < 2) {
        return { valid: false, message: 'Minimum 2 caractères requis' };
    }
    
    if (cleanUsername.length > 19) {
        return { valid: false, message: 'Maximum 19 caractères autorisés' };
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
        return { valid: false, message: 'Seules les lettres, chiffres et _ sont autorisés' };
    }
    
    return { valid: true, username: '@' + cleanUsername };
}

function handleLogin() {
    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value.trim();
    
    if (!email || !password) {
        elements.loginStatus.textContent = 'Veuillez remplir tous les champs';
        elements.loginStatus.className = 'auth-status error';
        return;
    }
    
    if (!validateEmail(email)) {
        elements.loginStatus.textContent = 'Adresse email invalide';
        elements.loginStatus.className = 'auth-status error';
        return;
    }
    
    elements.loginStatus.textContent = 'Connexion en cours...';
    elements.loginStatus.className = 'auth-status info';
    elements.loginBtn.disabled = true;
    
    socket.emit('login_user', { email, password });
}

function handleRegister() {
    const username = elements.registerUsername.value.trim();
    const email = elements.registerEmail.value.trim();
    const password = elements.registerPassword.value.trim();
    
    if (!username || !email || !password) {
        elements.registerStatus.textContent = 'Veuillez remplir tous les champs';
        elements.registerStatus.className = 'auth-status error';
        return;
    }
    
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
        elements.registerStatus.textContent = usernameValidation.message;
        elements.registerStatus.className = 'auth-status error';
        return;
    }
    
    if (!validateEmail(email)) {
        elements.registerStatus.textContent = 'Adresse email invalide';
        elements.registerStatus.className = 'auth-status error';
        return;
    }
    
    if (password.length < 6) {
        elements.registerStatus.textContent = 'Le mot de passe doit contenir au moins 6 caractères';
        elements.registerStatus.className = 'auth-status error';
        return;
    }
    
    elements.registerStatus.textContent = 'Création du compte...';
    elements.registerStatus.className = 'auth-status info';
    elements.registerBtn.disabled = true;
    
    socket.emit('register_user', {
        username: usernameValidation.username,
        email,
        password
    });
}

// Recherche d'utilisateurs
function searchUsers(query) {
    if (!query || query.length < 2) {
        elements.searchResults.classList.remove('show');
        return;
    }
    
    fetch(`/api/search_users?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(users => {
            displaySearchResults(users);
        })
        .catch(err => {
            console.error('Erreur lors de la recherche:', err);
            elements.searchResults.innerHTML = '<div class="no-results">Erreur lors de la recherche</div>';
            elements.searchResults.classList.add('show');
        });
}

function displaySearchResults(users) {
    elements.searchResults.innerHTML = '';
    
    if (users.length === 0) {
        elements.searchResults.innerHTML = '<div class="no-results">Aucun utilisateur trouvé</div>';
    } else {
        users.forEach(user => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'search-result-item';
            
            const isCurrentUser = currentUser && user.username === currentUser.username;
            
            resultDiv.innerHTML = `
                <div class="avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="search-result-info">
                    <div class="search-result-username">${escapeHtml(user.username.replace('@', ''))}</div>
                    <div class="search-result-status">${user.status === 'online' ? 'En ligne' : 'Hors ligne'} • Vu ${formatLastSeen(user.last_seen)}</div>
                </div>
                <div class="search-result-actions">
                    ${!isCurrentUser ? `
                        <button class="search-action-btn" onclick="startPrivateChat('${user.username}')">
                            <i class="fas fa-comment"></i>
                        </button>
                        <button class="search-action-btn secondary" onclick="viewUserProfile('${user.username}')">
                            <i class="fas fa-user"></i>
                        </button>
                    ` : '<span class="search-result-status">Vous</span>'}
                </div>
            `;
            
            elements.searchResults.appendChild(resultDiv);
        });
    }
    
    elements.searchResults.classList.add('show');
}

function formatLastSeen(lastSeen) {
    const now = new Date();
    const seen = new Date(lastSeen);
    const diffMs = now - seen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'à l\'instant';
    if (diffMins < 60) return `il y a ${diffMins}min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    return seen.toLocaleDateString('fr-FR');
}

function startPrivateChat(username) {
    showNotification('Message privé', `Fonctionnalité bientôt disponible pour ${username}`, 'info');
    closeUserSearch();
}

function viewUserProfile(username) {
    showNotification('Profil utilisateur', `Profil de ${username} - Fonctionnalité bientôt disponible`, 'info');
    closeUserSearch();
}

function openUserSearch() {
    elements.userSearchContainer.style.display = 'block';
    elements.userSearchInput.focus();
    elements.searchResults.classList.remove('show');
}

function closeUserSearch() {
    elements.userSearchContainer.style.display = 'none';
    elements.userSearchInput.value = '';
    elements.searchResults.classList.remove('show');
}

// Gestion des utilisateurs
function updateUsersList(users) {
    elements.usersList.innerHTML = '';
    
    // Filtrer pour n'afficher que les utilisateurs en ligne
    const onlineUsers = users.filter(user => user.status === 'online');
    
    if (onlineUsers.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'no-results';
        emptyDiv.textContent = 'Aucun utilisateur en ligne';
        elements.usersList.appendChild(emptyDiv);
        return;
    }
    
    onlineUsers.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.innerHTML = `
            <div class="avatar">
                <i class="fas fa-user"></i>
            </div>
            <span class="username">${escapeHtml(user.username.replace('@', ''))}</span>
            <span class="status ${user.status}">En ligne</span>
        `;
        
        // Clic pour voir le profil ou envoyer un message
        userDiv.onclick = () => {
            if (user.username !== currentUser.username) {
                startPrivateChat(user.username);
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
            <span class="message-username">${escapeHtml(data.username.replace('@', ''))}</span>
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

// Event Listeners pour l'authentification
elements.showRegister.onclick = (e) => {
    e.preventDefault();
    showRegisterForm();
};

elements.showLogin.onclick = (e) => {
    e.preventDefault();
    showLoginForm();
};

elements.loginBtn.onclick = handleLogin;
elements.registerBtn.onclick = handleRegister;

// Gestion des touches Entrée
elements.loginPassword.onkeypress = (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
};

elements.registerPassword.onkeypress = (e) => {
    if (e.key === 'Enter') {
        handleRegister();
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

// Event listeners pour la recherche d'utilisateurs
elements.searchUsersBtn.onclick = openUserSearch;
elements.closeUserSearch.onclick = closeUserSearch;

elements.userSearchInput.oninput = (e) => {
    const query = e.target.value.trim();
    searchUsers(query);
};

elements.userSearchInput.onkeypress = (e) => {
    if (e.key === 'Escape') {
        closeUserSearch();
    }
};

// Fermer la recherche en cliquant ailleurs
document.onclick = (e) => {
    if (!elements.userSearchContainer.contains(e.target) && 
        !elements.searchUsersBtn.contains(e.target) && 
        !elements.emojiPicker.contains(e.target) && 
        !elements.emojiBtn.contains(e.target)) {
        elements.userSearchContainer.style.display = 'none';
        elements.emojiPicker.style.display = 'none';
    }
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
    elements.authSection.style.display = 'none';
    elements.userProfile.style.display = 'block';
    elements.roomsSection.style.display = 'block';
    elements.usersSection.style.display = 'block';
    elements.messageInput.disabled = false;
    elements.sendBtn.disabled = false;
    
    // Rejoindre la salle générale
    socket.emit('join_room', { room: 'general' });
    
    showNotification('Bienvenue sur PRIKEB', `Connecté en tant que ${data.username}`, 'success');
});

socket.on('registration_success', (data) => {
    elements.registerStatus.textContent = data.message;
    elements.registerStatus.className = 'auth-status success';
    elements.registerBtn.disabled = false;
    
    // Basculer vers le formulaire de connexion après 2 secondes
    setTimeout(() => {
        showLoginForm();
        elements.loginEmail.value = elements.registerEmail.value;
        showNotification('Inscription réussie', 'Vous pouvez maintenant vous connecter', 'success');
    }, 2000);
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

// Initialiser l'état des boutons
elements.loginBtn.disabled = false;
elements.registerBtn.disabled = false;

// Gérer les erreurs d'authentification
socket.on('error', (data) => {
    if (elements.loginForm.style.display !== 'none') {
        elements.loginStatus.textContent = data.message;
        elements.loginStatus.className = 'auth-status error';
        elements.loginBtn.disabled = false;
    } else {
        elements.registerStatus.textContent = data.message;
        elements.registerStatus.className = 'auth-status error';
        elements.registerBtn.disabled = false;
    }
});

// Focus sur le champ email au chargement
elements.loginEmail.focus();