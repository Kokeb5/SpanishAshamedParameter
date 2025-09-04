let localVideo = document.getElementById('localVideo');
let remoteVideo = document.getElementById('remoteVideo');
let callIdInput = document.getElementById('callId');

let localStream;
let peerConnection;
let callId;

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function createConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => { remoteVideo.srcObject = event.streams[0]; };
    peerConnection.onicecandidate = event => { if(event.candidate) console.log("ICE:", event.candidate); };
}

async function startCall(type) {
    callId = callIdInput.value;
    if(!callId){ alert("Renseigne l'ID de l'appel !"); return; }

    let constraints = (type==='video') ? {video:true, audio:true} : {video:false, audio:true};

    try { localStream = await navigator.mediaDevices.getUserMedia(constraints); localVideo.srcObject = localStream; }
    catch(err){ console.log("Erreur caméra/micro:", err); return; }

    createConnection();
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await fetch("/offer", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({call_id:callId, offer:offer, type:type})});

    let checkAnswer = setInterval(async ()=>{
        let res = await fetch(/get_offer/${callId});
        let data = await res.json();
        if(data.answer){ await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)); clearInterval(checkAnswer);}
    },1000);
}

async function acceptCall(){
    callId = callIdInput.value;
    if(!callId){ alert("Renseigne l'ID de l'appel !"); return; }

    createConnection();

    let res = await fetch(/get_offer/${callId});
    let data = await res.json();
    if(!data.offer){ alert("Pas d'appel trouvé."); return; }

    let constraints = (data.type==='video') ? {video:true, audio:true} : {video:false, audio:true};
    try{ localStream = await navigator.mediaDevices.getUserMedia(constraints); localVideo.srcObject = localStream; }
    catch(err){ console.log("Erreur caméra/micro:", err); return; }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await fetch("/answer", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({call_id:callId, answer:answer})});
}

async function endCall(){
    if(!callId) return;
    await fetch("/end_call",{method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({call_id:callId})});
    if(peerConnection){ peerConnection.close(); peerConnection=null; }
    remoteVideo.srcObject=null; callId=null;
    alert("Appel terminé !");
}

async function shareScreen(){
    if(!peerConnection){ alert("Démarre d'abord un appel !"); return; }
    try{
        const screenStream = await navigator.mediaDevices.getDisplayMedia({video:true});
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s=>s.track.kind==='video');
        sender.replaceTrack(videoTrack);
        videoTrack.onended = async ()=>{
            const localVideoTrack = localStream.getVideoTracks()[0];
            sender.replaceTrack(localVideoTrack);
            localVideo.srcObject = localStream;
        };
        localVideo.srcObject = screenStream;
    } catch(err){ console.log("Erreur partage d'écran:", err); }
}
// ------------------- Tes fonctionnalités existantes -------------------
// Exemple : login, mot de passe, mot de passe oublié, etc.
// Laisse ton ancien code ici, ne pas supprimer.

// ------------------- Messagerie temps réel -------------------
const socket = io();

function joinConversation() {
    const user1 = document.getElementById("sender").value;
    const user2 = document.getElementById("receiver").value;
    if (!user1 || !user2) return;
    socket.emit('join', { user1, user2 });
}

function sendMessage() {
    const sender = document.getElementById("sender").value;
    const receiver = document.getElementById("receiver").value;
    const message = document.getElementById("message").value;
    if (!sender || !receiver || !message) return;

    socket.emit('send_message', { sender, receiver, message });
    document.getElementById("message").value = "";
}

socket.on('receive_message', data => {
    const chatDiv = document.getElementById("chat");
    chatDiv.innerHTML += <p><b>${data.sender}:</b> ${data.message}</p>;
});

socket.on('load_messages', data => {
    const chatDiv = document.getElementById("chat");
    chatDiv.innerHTML = "";
    data.forEach(m => {
        chatDiv.innerHTML += <p><b>${m.sender}:</b> ${m.message}</p>;
    });
});

document.getElementById("receiver").addEventListener("blur", joinConversation);

// ------------------- Appels Audio / Vidéo -------------------
let localStream = null;
let remoteStream = null;
let pc = null;
const servers = null; // Ajouter STUN/TURN pour production

async function startCall(video = false) {
    const sender = document.getElementById("sender").value;
    const receiver = document.getElementById("receiver").value;
    if (!sender || !receiver) return;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
        document.getElementById("localVideo").srcObject = localStream;
    } catch (e) {
        alert("Erreur accès caméra/micro: " + e);
        return;
    }

    pc = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
        remoteStream = event.streams[0];
        document.getElementById("remoteVideo").srcObject = remoteStream;
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const room = [sender, receiver].sort().join("_");
    socket.emit('call_user', { room, sender, receiver, offer });
}

socket.on('incoming_call', async data => {
    const accept = confirm(Appel de ${data.sender}. Accepter ?);
    if (!accept) return;

    const sender = document.getElementById("sender").value;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    document.getElementById("localVideo").srcObject = localStream;

    pc = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
        remoteStream = event.streams[0];
        document.getElementById("remoteVideo").srcObject = remoteStream;
    };

    await pc.setRemoteDescription(data.offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('answer_call', { room: data.room, answer });
});

socket.on('call_answered', async data => {
    await pc.setRemoteDescription(data.answer);
});

function endCall() {
    if (pc) pc.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    socket.emit('end_call', { room: [document.getElementById("sender").value, document.getElementById("receiver").value].sort().join("_") });
}

// ------------------- Partage d'écran -------------------
async function startScreenShare() {
    if (!pc) return alert("Commencez un appel avant le partage d'écran");

    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = screenStream.getTracks()[0];
        const sender = pc.getSenders().find(s => s.track.kind === "video");
        if (sender) sender.replaceTrack(track);

        track.onended = () => {
            // Quand l’utilisateur arrête le partage, on remet sa caméra
            localStream.getVideoTracks()[0].enabled = true;
            const sender = pc.getSenders().find(s => s.track.kind === "video");
            if (sender) sender.replaceTrack(localStream.getVideoTracks()[0]);
        };
    } catch (e) {
        alert("Erreur partage d'écran: " + e);
    }
