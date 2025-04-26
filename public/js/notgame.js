document.addEventListener("DOMContentLoaded", () => {
    window.electron.ipcRenderer.on('champ-select-entered', (event) => {
        window.location.href = 'index.html';
    });
    window.electron.ipcRenderer.on('league-open', async (event) => {
        console.log("League of Legends aberto.");
        const el = document.getElementById('not-open');
        el.innerHTML = `
        <h1>League of Legends detectado!</h1>
        <p>${event.username}, inicie uma partida para usar o <strong>NexusVoice</strong>.</p>
      `;
        el.style.display = 'block';

    });
})

