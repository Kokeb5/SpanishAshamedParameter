from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, send, join_room, leave_room, disconnect
from flask_sqlalchemy import SQLAlchemy
import datetime
import uuid
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'chat_app_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chat.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Dictionnaires pour stocker les utilisateurs connectés et leurs statuts
connected_users = {}
user_rooms = {}

# Créer le dossier d'upload s'il n'existe pas
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Modèles de base de données
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    avatar = db.Column(db.String(200), default='default.png')
    status = db.Column(db.String(20), default='offline')
    last_seen = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    bio = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Room(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text, default='')
    private = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey('room.id'), nullable=False)
    message_type = db.Column(db.String(20), default='text')
    file_path = db.Column(db.String(200))
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    edited = db.Column(db.Boolean, default=False)
    reply_to = db.Column(db.Integer, db.ForeignKey('message.id'))
    
    user = db.relationship('User', backref='messages')
    room = db.relationship('Room', backref='messages')

class Reaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    emoji = db.Column(db.String(10), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message_id = db.Column(db.Integer, db.ForeignKey('message.id'), nullable=False)
    
    user = db.relationship('User')
    message = db.relationship('Message', backref='reactions')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/rooms')
def get_rooms():
    rooms = Room.query.filter_by(private=False).all()
    return jsonify([{
        'id': room.id,
        'name': room.name,
        'description': room.description,
        'message_count': len(room.messages)
    } for room in rooms])

@app.route('/api/users')
def get_users():
    users = User.query.all()
    return jsonify([{
        'id': user.id,
        'username': user.username,
        'status': user.status,
        'avatar': user.avatar,
        'last_seen': user.last_seen.isoformat() if user.last_seen else None
    } for user in users])

@app.route('/api/search_users')
def search_users():
    query = request.args.get('q', '').strip()
    
    if not query:
        return jsonify([])
    
    # Ajouter @ si pas présent
    if not query.startswith('@'):
        query = '@' + query
    
    # Recherche insensible à la casse
    users = User.query.filter(
        User.username.ilike(f'%{query}%')
    ).limit(20).all()
    
    return jsonify([{
        'id': user.id,
        'username': user.username,
        'status': user.status,
        'avatar': user.avatar,
        'last_seen': user.last_seen.isoformat() if user.last_seen else None,
        'bio': user.bio
    } for user in users])

@app.route('/api/messages/<int:room_id>')
def get_messages(room_id):
    messages = Message.query.filter_by(room_id=room_id).order_by(Message.timestamp.desc()).limit(50).all()
    messages.reverse()
    
    return jsonify([{
        'id': msg.id,
        'content': msg.content,
        'username': msg.user.username,
        'user_id': msg.user_id,
        'timestamp': msg.timestamp.strftime('%H:%M:%S'),
        'message_type': msg.message_type,
        'file_path': msg.file_path,
        'reactions': [{
            'emoji': r.emoji,
            'user_id': r.user_id,
            'username': r.user.username
        } for r in msg.reactions]
    } for msg in messages])

@socketio.on('connect')
def handle_connect():
    print('Client connecté')
    emit('request_user_info')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client déconnecté')
    # Mettre à jour le statut de l'utilisateur
    from flask import session
    session_id = session.get('session_id')
    if session_id and session_id in connected_users:
        user_id = connected_users[session_id]
        user = User.query.get(user_id)
        if user:
            user.status = 'offline'
            user.last_seen = datetime.datetime.utcnow()
            db.session.commit()
            
            # Notifier les autres utilisateurs
            emit('user_status_update', {
                'user_id': user_id,
                'username': user.username,
                'status': 'offline'
            }, broadcast=True)
        
        del connected_users[session_id]
        if session_id in user_rooms:
            del user_rooms[session_id]

@socketio.on('join_user')
def handle_join_user(data):
    username = data.get('username', '').strip()
    
    # Validation du nom d'utilisateur
    if not username:
        emit('error', {'message': 'Nom d\'utilisateur requis'})
        return
    
    if not username.startswith('@'):
        emit('error', {'message': 'Le nom d\'utilisateur doit commencer par @'})
        return
    
    if len(username) < 3:  # @ + au moins 2 caractères
        emit('error', {'message': 'Le nom d\'utilisateur doit contenir au moins 2 caractères après @'})
        return
    
    if len(username) > 20:  # @ + 19 caractères max
        emit('error', {'message': 'Le nom d\'utilisateur ne peut pas dépasser 19 caractères après @'})
        return
    
    # Vérifier les caractères autorisés
    username_part = username[1:]  # Sans le @
    if not username_part.replace('_', '').replace('-', '').isalnum():
        emit('error', {'message': 'Seules les lettres, chiffres, _ et - sont autorisés'})
        return
    
    # Vérifier l'unicité
    existing_user = User.query.filter(User.username.ilike(username)).first()
    if existing_user and existing_user.status == 'online':
        emit('error', {'message': 'Ce nom d\'utilisateur est déjà utilisé par un utilisateur connecté'})
        return
    
    # Créer ou récupérer l'utilisateur
    user = User.query.filter_by(username=username).first()
    if not user:
        user = User(username=username)
        db.session.add(user)
        db.session.commit()
    
    # Mettre à jour le statut
    user.status = 'online'
    user.last_seen = datetime.datetime.utcnow()
    db.session.commit()
    
    # Créer un ID de session unique
    from flask import session
    session['session_id'] = str(uuid.uuid4())
    session_id = session['session_id']
    
    # Associer l'utilisateur à la session
    connected_users[session_id] = user.id
    
    # Envoyer les informations de l'utilisateur
    emit('user_joined', {
        'user_id': user.id,
        'username': user.username,
        'avatar': user.avatar,
        'bio': user.bio
    })
    
    # Notifier les autres utilisateurs
    emit('user_status_update', {
        'user_id': user.id,
        'username': user.username,
        'status': 'online'
    }, broadcast=True, include_self=False)

@socketio.on('join_room')
def handle_join_room(data):
    room_name = data.get('room', 'general')
    from flask import session
    session_id = session.get('session_id')
    
    if not session_id or session_id not in connected_users:
        emit('error', {'message': 'Vous devez vous connecter d\'abord'})
        return
    
    # Créer la salle si elle n'existe pas
    room = Room.query.filter_by(name=room_name).first()
    if not room:
        room = Room(name=room_name, created_by=connected_users[session_id])
        db.session.add(room)
        db.session.commit()
    
    # Quitter l'ancienne salle
    if session_id in user_rooms:
        leave_room(user_rooms[session_id])
    
    # Rejoindre la nouvelle salle
    join_room(room_name)
    user_rooms[session_id] = room_name
    
    # Envoyer l'historique des messages de la salle
    messages = Message.query.filter_by(room_id=room.id).order_by(Message.timestamp.desc()).limit(50).all()
    messages.reverse()
    
    for msg in messages:
        emit('message', {
            'id': msg.id,
            'content': msg.content,
            'username': msg.user.username,
            'user_id': msg.user_id,
            'timestamp': msg.timestamp.strftime('%H:%M:%S'),
            'message_type': msg.message_type,
            'file_path': msg.file_path,
            'reactions': [{
                'emoji': r.emoji,
                'user_id': r.user_id,
                'username': r.user.username
            } for r in msg.reactions]
        })
    
    emit('room_joined', {'room': room_name, 'room_id': room.id})

@socketio.on('send_message')
def handle_message(data):
    from flask import session
    session_id = session.get('session_id')
    if not session_id or session_id not in connected_users:
        emit('error', {'message': 'Vous devez vous connecter d\'abord'})
        return
    
    user_id = connected_users[session_id]
    room_name = user_rooms.get(session_id, 'general')
    
    # Récupérer la salle
    room = Room.query.filter_by(name=room_name).first()
    if not room:
        emit('error', {'message': 'Salle introuvable'})
        return
    
    # Créer le message en base
    message_content = data.get('message', '').strip()
    if not message_content:
        return
    
    new_message = Message(
        content=message_content,
        user_id=user_id,
        room_id=room.id,
        message_type='text'
    )
    db.session.add(new_message)
    db.session.commit()
    
    # Récupérer l'utilisateur pour le nom
    user = User.query.get(user_id)
    
    # Diffuser le message à tous les clients dans la salle
    message_data = {
        'id': new_message.id,
        'content': new_message.content,
        'username': user.username,
        'user_id': user_id,
        'timestamp': new_message.timestamp.strftime('%H:%M:%S'),
        'message_type': 'text',
        'reactions': []
    }
    
    socketio.emit('message', message_data, to=room_name)

@socketio.on('add_reaction')
def handle_add_reaction(data):
    from flask import session
    session_id = session.get('session_id')
    if not session_id or session_id not in connected_users:
        return
    
    user_id = connected_users[session_id]
    message_id = data.get('message_id')
    emoji = data.get('emoji')
    
    if not message_id or not emoji:
        return
    
    # Vérifier si la réaction existe déjà
    existing_reaction = Reaction.query.filter_by(
        user_id=user_id,
        message_id=message_id,
        emoji=emoji
    ).first()
    
    if existing_reaction:
        # Supprimer la réaction
        db.session.delete(existing_reaction)
        action = 'removed'
    else:
        # Ajouter la réaction
        reaction = Reaction(
            user_id=user_id,
            message_id=message_id,
            emoji=emoji
        )
        db.session.add(reaction)
        action = 'added'
    
    db.session.commit()
    
    # Récupérer l'utilisateur
    user = User.query.get(user_id)
    room_name = user_rooms.get(session_id, 'general')
    
    # Notifier tous les clients dans la salle
    socketio.emit('reaction_update', {
        'message_id': message_id,
        'emoji': emoji,
        'user_id': user_id,
        'username': user.username,
        'action': action
    }, to=room_name)

@socketio.on('typing')
def handle_typing(data):
    from flask import session
    session_id = session.get('session_id')
    if not session_id or session_id not in connected_users:
        return
    
    user_id = connected_users[session_id]
    user = User.query.get(user_id)
    room_name = user_rooms.get(session_id, 'general')
    
    socketio.emit('user_typing', {
        'username': user.username,
        'typing': data.get('typing', False)
    }, to=room_name, include_self=False)

# Initialiser la base de données
with app.app_context():
    db.create_all()
    
    # Créer la salle générale si elle n'existe pas
    if not Room.query.filter_by(name='general').first():
        general_room = Room(name='general', description='Salle de discussion générale')
        db.session.add(general_room)
        db.session.commit()

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, use_reloader=False, log_output=True)