// Onboarding form handler

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('onboardingForm');
  const nicknameInput = document.getElementById('nickname');
  const genderSelect = document.getElementById('gender');
  const ageInput = document.getElementById('age');
  const sectorSelect = document.getElementById('sector');
  const citySelect = document.getElementById('city');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));

    // Validate inputs
    const nickname = nicknameInput.value.trim();
    const gender = genderSelect.value;
    const age = parseInt(ageInput.value);
    const sector = sectorSelect.value;
    const city = citySelect.value;

    let hasError = false;

    // Validate nickname: 3+ chars, no spaces, alphanumeric + underscore only
    const nicknameRegex = /^[a-zA-Z0-9_]{3,}$/;
    if (!nickname || !nicknameRegex.test(nickname)) {
      document.getElementById('nicknameError').classList.add('show');
      hasError = true;
    }

    if (!gender) {
      document.getElementById('genderError').classList.add('show');
      hasError = true;
    }

    if (!age || age < 13 || age > 120) {
      document.getElementById('ageError').classList.add('show');
      hasError = true;
    }

    if (!sector) {
      document.getElementById('sectorError').classList.add('show');
      hasError = true;
    }

    if (!city) {
      document.getElementById('cityError').classList.add('show');
      hasError = true;
    }

    if (hasError) return;

    // Disable button while saving
    submitBtn.disabled = true;
    submitBtn.textContent = 'שומר...';

    try {
      // Generate unique user ID (for backend)
      const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      // Generate unique study ID from nickname + random 4 digits
      const randomSuffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const studyId = nickname + '_' + randomSuffix;

      // Save to chrome.storage
      await chrome.storage.local.set({
        onboardingComplete: true,
        userId: userId,
        studyId: studyId,
        userNickname: nickname,
        userGender: gender,
        userAge: age,
        userSector: sector,
        userCountry: 'ישראל',
        userCountryName: 'ישראל',
        userCity: city,
        onboardingDate: new Date().toISOString()
      });

      console.log('✅ Onboarding complete! User data saved.');
      console.log('Study ID:', studyId);

      // Show success message
      submitBtn.textContent = '✓ נשמר! מעביר אתכם...';

      // Redirect to success page with Study ID in hash
      setTimeout(() => {
        window.location.href = `onboarding-success.html#${studyId}`;
      }, 1000);

    } catch (error) {
      console.error('Error saving onboarding data:', error);
      submitBtn.disabled = false;
      submitBtn.textContent = 'נסו שוב';
      alert('אירעה שגיאה בשמירת הפרטים. נא לנסות שוב.');
    }
  });

  // Real-time validation feedback
  nicknameInput.addEventListener('input', () => {
    const nicknameRegex = /^[a-zA-Z0-9_]{3,}$/;
    if (nicknameRegex.test(nicknameInput.value.trim())) {
      document.getElementById('nicknameError').classList.remove('show');
    }
  });

  genderSelect.addEventListener('change', () => {
    if (genderSelect.value) {
      document.getElementById('genderError').classList.remove('show');
    }
  });

  ageInput.addEventListener('input', () => {
    const age = parseInt(ageInput.value);
    if (age >= 13 && age <= 120) {
      document.getElementById('ageError').classList.remove('show');
    }
  });

  sectorSelect.addEventListener('change', () => {
    if (sectorSelect.value) {
      document.getElementById('sectorError').classList.remove('show');
    }
  });

  citySelect.addEventListener('change', () => {
    if (citySelect.value) {
      document.getElementById('cityError').classList.remove('show');
    }
  });
});
