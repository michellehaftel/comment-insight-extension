// Popup script for Discourse Lab extension

document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ Discourse Lab extension popup loaded');

  const angelBtn = document.getElementById('angelBtn');
  const devilBtn = document.getElementById('devilBtn');
  const botDescription = document.getElementById('botDescription');

  function applyUI(botType) {
    angelBtn.className = 'toggle-btn' + (botType === 'angel' ? ' active-angel' : '');
    devilBtn.className = 'toggle-btn' + (botType === 'devil' ? ' active-devil' : '');
    botDescription.textContent = botType === 'devil'
      ? 'Escalation mode (research)'
      : 'De-escalation assistant';
  }

  // Load current assignment
  const { botType } = await chrome.storage.local.get('botType');
  applyUI(botType || 'angel');

  angelBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ botType: 'angel' });
    applyUI('angel');
  });

  devilBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ botType: 'devil' });
    applyUI('devil');
  });
});
