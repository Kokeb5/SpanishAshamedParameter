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
