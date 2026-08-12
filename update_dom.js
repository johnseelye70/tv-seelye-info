const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Replace DOM Elements declarations
app = app.replace("const adminNavBtn = document.getElementById('admin-nav-btn');", "const addShowsBtn = document.getElementById('add-shows-btn');\n    const settingsBtn = document.getElementById('settings-btn');");
app = app.replace("const adminModal = document.getElementById('admin-modal');", "const addShowsModal = document.getElementById('add-shows-modal');\n    const settingsModal = document.getElementById('settings-modal');");
app = app.replace("const closeAdminBtn = document.getElementById('close-admin-btn');", "const closeAddShowsBtn = document.getElementById('close-add-shows-btn');\n    const closeSettingsBtn = document.getElementById('close-settings-btn');");

// Update login state to unhide both buttons
app = app.replace("adminNavBtn.classList.remove('hidden');", "addShowsBtn.classList.remove('hidden');\n                settingsBtn.classList.remove('hidden');");
app = app.replace("adminNavBtn.classList.add('hidden');", "addShowsBtn.classList.add('hidden');\n            settingsBtn.classList.add('hidden');");

// Update the event listeners for opening/closing the modals
const modalListeners = `
    // Add Shows Modal
    addShowsBtn.addEventListener('click', () => {
        addShowsModal.classList.remove('hidden');
    });
    closeAddShowsBtn.addEventListener('click', () => {
        addShowsModal.classList.add('hidden');
    });

    // Settings Modal
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
`;

app = app.replace(/adminNavBtn\.addEventListener\('click', \(\) => \{\s*adminModal\.classList\.remove\('hidden'\);\s*\}\);/, '');
app = app.replace(/closeAdminBtn\.addEventListener\('click', \(\) => \{\s*adminModal\.classList\.add\('hidden'\);\s*\}\);/, modalListeners);

fs.writeFileSync('app.js', app);
console.log('App DOM refs updated');
