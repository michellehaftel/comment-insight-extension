// Get Study ID from URL hash
const studyId = window.location.hash.substring(1) || 'שגיאה בטעינה';
document.getElementById('studyIdText').textContent = studyId;

// Copy to clipboard
document.getElementById('copyButton').addEventListener('click', () => {
  navigator.clipboard.writeText(studyId).then(() => {
    const btn = document.getElementById('copyButton');
    btn.textContent = '✓ הועתק!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = '📋 העתקה';
      btn.classList.remove('copied');
    }, 2000);
  });
});

// Manual continue button
const redirectToTwitter = () => {
  chrome.tabs.create({ url: 'https://twitter.com' });
  setTimeout(() => {
    window.close();
  }, 300);
};

document.getElementById('continueButton').addEventListener('click', () => {
  redirectToTwitter();
});
