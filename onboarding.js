// Onboarding form handler

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('onboardingForm');
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
    const gender = genderSelect.value;
    const age = parseInt(ageInput.value);
    const sector = sectorSelect.value;
    const city = citySelect.value;

    let hasError = false;

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
      // Generate unique user ID
      const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      // Save to chrome.storage
      await chrome.storage.local.set({
        onboardingComplete: true,
        userId: userId,
        userGender: gender,
        userAge: age,
        userSector: sector,
        userCountry: 'ישראל',
        userCountryName: 'ישראל',
        userCity: city,
        onboardingDate: new Date().toISOString()
      });

      console.log('✅ Onboarding complete! User data saved.');

      // Show success message
      submitBtn.textContent = '✓ נשמר! מעביר אתכם...';

      // Redirect to Twitter/X after 1 second
      setTimeout(() => {
        window.location.href = 'https://twitter.com';
      }, 1000);

    } catch (error) {
      console.error('Error saving onboarding data:', error);
      submitBtn.disabled = false;
      submitBtn.textContent = 'נסו שוב';
      alert('אירעה שגיאה בשמירת הפרטים. נא לנסות שוב.');
    }
  });

  // Real-time validation feedback
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
