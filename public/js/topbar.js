document.addEventListener("DOMContentLoaded", () => {
    const minimize = document.getElementById("minimize");
    const maxmize = document.getElementById("maxmize");
    const close = document.getElementById("close");
  
    minimize.addEventListener("click", () =>  window.electron.ipcRenderer.invoke("minimize"));
    close.addEventListener("click", () => window.close());
    maxmize.addEventListener("click", () =>  window.electron.ipcRenderer.invoke("maxmize"));
  });  