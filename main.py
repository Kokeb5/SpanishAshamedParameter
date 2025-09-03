from flask import Flask, render_template
from flask_socketio import SocketIO, emit, send
import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'chat_app_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Stocker les messages en mémoire
messages = []

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    print('Client connecté')
    # Envoyer l'historique des messages au nouveau client
    for message in messages:
        emit('message', message)

@socketio.on('disconnect')
def handle_disconnect():
    print('Client déconnecté')

@socketio.on('send_message')
def handle_message(data):
    # Créer un message avec timestamp
    message = {
        'username': data.get('username', 'Anonyme'),
        'message': data.get('message', ''),
        'timestamp': datetime.datetime.now().strftime('%H:%M:%S')
    }
    
    # Ajouter le message à l'historique
    messages.append(message)
    
    # Limiter l'historique à 100 messages
    if len(messages) > 100:
        messages.pop(0)
    
    # Diffuser le message à tous les clients connectés
    emit('message', message, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, use_reloader=False, log_output=True)