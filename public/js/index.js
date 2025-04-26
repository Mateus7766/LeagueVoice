

let nickname = '';
let avatar = '';
let roomId = "123";
let data = ''

electron.ipcRenderer.invoke("isPlaying").then(async (gameData) => {
    const userpuuid = gameData.playerChampionSelections[0].puuid;
    data = gameData;
    const teamOne = gameData.teamOne;
    const playerChampionSelections = gameData.playerChampionSelections;
    let team = 'two'
    for (player of teamOne) {
        if (player.puuid == userpuuid) {
            team = 'one'
            break;
        }
    }
    const chanpionsName = await (await fetch('https://ddragon.leagueoflegends.com/cdn/14.8.1/data/en_US/championFull.json')).json();

    for (selection of playerChampionSelections) {
        nickname = chanpionsName.keys[selection.championId];
        avatar = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${selection.championId}.png`;
    }

    roomId = gameData.gameId + '-' + team;
    const loader = document.getElementById('loader');
    if (loader) {
        loader.remove();
    }
    startVoice();
}).catch(err => {
    console.log("Erro ao acessar o jogo:", err);
});





async function startVoice() {
    const socket = io("http://localhost:3000");
    const peers = {};
    const audioElements = {};
    const mutedPeers = {};
    let localStream;
    let isMuted = false;
    let globalMute = false;
    let localAudioAnalyser;

    document.getElementById("meu-usuario").innerHTML = `
    <img src="${avatar}" class="champion-avatar" alt="${nickname}">
    <span>${nickname}</span>
  `;

    document.getElementById("mute-self-btn").addEventListener("click", () => {
        isMuted = !isMuted;
        localStream.getAudioTracks()[0].enabled = !isMuted;
        document.getElementById("mute-self-btn").textContent = isMuted ? "🔊 Ativar meu microfone" : "🔇 Mutar meu microfone";
    });

    document.getElementById("mute-all-btn").addEventListener("click", () => {
        globalMute = !globalMute;
        Object.values(audioElements).forEach(audio => audio.muted = globalMute);
        document.getElementById("mute-all-btn").textContent = globalMute ? "🔊 Ouvir todos novamente" : "🔈 Parar de ouvir todos";
    });

    const led = document.getElementById("status-led");
    function setLedColor(color) {
        led.style.backgroundColor = color;
    }
    try {

        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLedColor("orange");


        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(localStream);
        localAudioAnalyser = audioContext.createAnalyser();
        source.connect(localAudioAnalyser);


        const dataArray = new Uint8Array(localAudioAnalyser.frequencyBinCount);
        function analyzeLocalVolume() {
            localAudioAnalyser.getByteFrequencyData(dataArray);
            const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;


            if (volume > 15) {
                document.getElementById("classe-aura").classList.add("speaking");
            } else {
                document.getElementById("classe-aura").classList.remove("speaking");
            }

            requestAnimationFrame(analyzeLocalVolume);
        }

        analyzeLocalVolume();

    } catch (err) {
        console.error("Erro ao acessar microfone:", err);
        return;
    }

    socket.emit("join", { roomId, nickname, avatar });

    socket.on("peer-joined", ({ peerId }) => {
        createPeerConnection(peerId, true);
    });

    socket.on("peer-left", ({ peerId }) => {
        if (peers[peerId]) {
            peers[peerId].close();
            delete peers[peerId];
        }
        delete audioElements[peerId];
    });

    socket.on("signal", async ({ from, signal }) => {
        if (!peers[from]) createPeerConnection(from, false);
        const peer = peers[from];

        if (signal.sdp) {
            await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            if (signal.sdp.type === "offer") {
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socket.emit("signal", { to: from, from: socket.id, signal: { sdp: answer } });
            }
        } else if (signal.candidate) {
            await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
    });

    socket.on("update-users", (users) => {
        const ul = document.getElementById("user-list");
        ul.innerHTML = "";
        Object.entries(users).forEach(([id, user]) => {
            if (id === socket.id) return;

            const li = document.createElement("li");
            li.className = "list-group-item d-flex align-items-center";
            li.setAttribute("data-peer", id);
            li.innerHTML = `
          <img src="${user.avatar}" class="champion-avatar" alt="${user.nickname}">
          <span class="me-2">${user.nickname}</span>
          <button class="btn btn-outline-danger btn-small" data-mute-peer="${id}">🔇</button>
        `;
            ul.appendChild(li);

            const muteBtn = li.querySelector(`[data-mute-peer="${id}"]`);
            muteBtn.addEventListener("click", () => {
                mutedPeers[id] = !mutedPeers[id];
                muteBtn.textContent = mutedPeers[id] ? "🔊" : "🔇";
                const audio = audioElements[id];
                if (audio) audio.muted = mutedPeers[id] || globalMute;
            });
        });
    });
}

function createPeerConnection(peerId, isInitiator) {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peers[peerId] = peer;
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

    peer.onicecandidate = e => {
        if (e.candidate) {
            socket.emit("signal", {
                to: peerId,
                from: socket.id,
                signal: { candidate: e.candidate }
            });
        }
    };

    peer.ontrack = e => {
        const audio = new Audio();
        audio.srcObject = e.streams[0];
        audio.autoplay = true;
        audio.muted = mutedPeers[peerId] || globalMute;
        audioElements[peerId] = audio;

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(e.streams[0]);
        const analyser = audioContext.createAnalyser();
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);

        const userCard = document.querySelector(`[data-peer="${peerId}"]`);
        const THRESHOLD = 15;

        function analyzeVolume() {
            analyser.getByteFrequencyData(dataArray);
            const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

            if (volume > THRESHOLD) {
                userCard?.classList.add("speaking");
            } else {
                userCard?.classList.remove("speaking");
            }

            requestAnimationFrame(analyzeVolume);
        }

        analyzeVolume();
    };

    if (isInitiator) {
        peer.createOffer().then(offer => {
            peer.setLocalDescription(offer);
            socket.emit("signal", {
                to: peerId,
                from: socket.id,
                signal: { sdp: offer }
            });
        });
    }

    setInterval(async () => {
        const stats = await peer.getStats();
        let sending = false, receiving = false;
        stats.forEach(report => {
            if (report.type === "outbound-rtp" && report.kind === "audio" && report.packetsSent > 0) sending = true;
            if (report.type === "inbound-rtp" && report.kind === "audio" && report.packetsReceived > 0) receiving = true;
        });
        setLedColor(sending && receiving ? "green" : "red");
    }, 2000);
}