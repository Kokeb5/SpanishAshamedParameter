// Connexion Socket.IO
const socket = io();

// Éléments DOM
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const usernameInput = document.getElementById('username');

// Variable pour stocker le nom d'utilisateur
let currentUsername = '';

// Fonction pour faire défiler vers le bas
function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Fonction pour afficher un message
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    // Vérifier si c'est notre propre message
    if (data.username === currentUsername) {
        messageDiv.classList.add('own');
    } else {
        messageDiv.classList.add('other');
    }
    
    messageDiv.innerHTML = `
        <div class="message-meta">${data.username} - ${data.timestamp}</div>
        <div class="message-content">${escapeHtml(data.message)}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
}

// Fonction pour échapper le HTML (sécurité)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fonction pour envoyer un message
function sendMessage() {
    const message = messageInput.value.trim();
    const username = usernameInput.value.trim() || 'Anonyme';
    
    if (message === '') {
        return;
    }
    
    // Mettre à jour le nom d'utilisateur actuel
    currentUsername = username;
    
    // Envoyer le message au serveur
    socket.emit('send_message', {
        username: username,
        message: message
    });
    
    // Vider le champ de saisie
    messageInput.value = '';
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Écouter les messages entrants
socket.on('message', displayMessage);

// Message de connexion
socket.on('connect', function() {
    console.log('Connecté au serveur de chat');
});

// Message de déconnexion
socket.on('disconnect', function() {
    console.log('Déconnecté du serveur de chat');
});

// Focus sur le champ de message au chargement
messageInput.focus();