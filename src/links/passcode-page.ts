export function buildPasscodePage(code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Protected Link</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0d0d14;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .card {
      background: #16161f;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 24px;
      padding: 48px 40px 40px;
      max-width: 380px;
      width: calc(100% - 32px);
      text-align: center;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
    }

    .lock-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      background: linear-gradient(135deg, #6c63ff22, #a78bfa22);
      border: 1px solid rgba(108, 99, 255, 0.3);
      border-radius: 20px;
      margin-bottom: 24px;
    }

    .lock-wrapper svg {
      width: 32px;
      height: 32px;
    }

    h1 {
      color: #f0f0f5;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.3px;
      margin-bottom: 8px;
    }

    .subtitle {
      color: #6b6b80;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 36px;
    }

    .digits {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 28px;
    }

    .digit {
      width: 60px;
      height: 68px;
      background: #0d0d14;
      border: 1.5px solid #2a2a3d;
      border-radius: 14px;
      color: #f0f0f5;
      font-size: 26px;
      font-weight: 700;
      text-align: center;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      caret-color: transparent;
    }

    .digit:focus {
      border-color: #6c63ff;
      box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.18);
    }

    .digit.filled {
      border-color: #4d46c8;
    }

    .digit.error-shake {
      border-color: #ff4f6a;
      animation: shake 0.35s ease;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-6px); }
      40%       { transform: translateX(6px); }
      60%       { transform: translateX(-4px); }
      80%       { transform: translateX(4px); }
    }

    .btn {
      width: 100%;
      padding: 15px;
      background: linear-gradient(135deg, #6c63ff, #a78bfa);
      color: #fff;
      border: none;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.2px;
      transition: opacity 0.2s, transform 0.1s;
    }

    .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .btn:not(:disabled):hover  { opacity: 0.9; }
    .btn:not(:disabled):active { transform: scale(0.98); }

    .loading {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .error-msg {
      color: #ff6b80;
      font-size: 13px;
      margin-top: 16px;
      min-height: 18px;
      transition: opacity 0.2s;
    }

    .error-msg:empty { opacity: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="lock-wrapper">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="11" width="14" height="10" rx="3" fill="#6c63ff" opacity="0.9"/>
        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#a78bfa" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="16" r="1.5" fill="#fff" opacity="0.85"/>
      </svg>
    </div>

    <h1>Protected Link</h1>
    <p class="subtitle">Enter the 4-digit passcode to access this link</p>

    <div class="digits">
      <input class="digit" id="d0" type="password" inputmode="numeric" maxlength="1" autocomplete="off" />
      <input class="digit" id="d1" type="password" inputmode="numeric" maxlength="1" autocomplete="off" />
      <input class="digit" id="d2" type="password" inputmode="numeric" maxlength="1" autocomplete="off" />
      <input class="digit" id="d3" type="password" inputmode="numeric" maxlength="1" autocomplete="off" />
    </div>

    <button class="btn" id="submit-btn" onclick="submitPasscode()">Unlock</button>
    <p class="error-msg" id="error-msg"></p>
  </div>

  <script>
    const inputs = Array.from(document.querySelectorAll('.digit'));
    const btn    = document.getElementById('submit-btn');
    const errEl  = document.getElementById('error-msg');

    inputs.forEach((input, i) => {
      input.addEventListener('input', () => {
        const val = input.value.replace(/\\D/g, '');
        input.value = val;
        input.classList.toggle('filled', val.length > 0);

        if (val.length === 1 && i < inputs.length - 1) {
          inputs[i + 1].focus();
        }

        if (getPasscode().length === 4) submitPasscode();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 0) {
          inputs[i - 1].value = '';
          inputs[i - 1].classList.remove('filled');
          inputs[i - 1].focus();
        }
        if (e.key === 'Enter') submitPasscode();
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData?.getData('text') ?? '').replace(/\\D/g, '').slice(0, 4);
        pasted.split('').forEach((ch, j) => {
          if (inputs[i + j]) {
            inputs[i + j].value = ch;
            inputs[i + j].classList.add('filled');
          }
        });
        const next = inputs[Math.min(i + pasted.length, inputs.length - 1)];
        next.focus();
        if (getPasscode().length === 4) submitPasscode();
      });
    });

    inputs[0].focus();

    function getPasscode() {
      return inputs.map(inp => inp.value).join('');
    }

    function setShakeError(message) {
      inputs.forEach(inp => {
        inp.classList.remove('error-shake');
        void inp.offsetWidth;
        inp.classList.add('error-shake');
      });
      errEl.textContent = message;
      setTimeout(() => {
        inputs.forEach(inp => {
          inp.value = '';
          inp.classList.remove('filled', 'error-shake');
        });
        inputs[0].focus();
      }, 600);
    }

    async function submitPasscode() {
      const passcode = getPasscode();
      if (passcode.length < 4) return;

      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span>Verifying…';
      errEl.textContent = '';

      try {
        const response = await fetch('/links/${code}/verify-passcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode }),
        });

        const data = await response.json();

        if (response.ok) {
          btn.textContent = '✓ Redirecting…';
          window.location.href = data.originalUrl;
          return;
        }

        setShakeError(response.status === 401 ? 'Wrong passcode. Try again.' : 'Something went wrong.');
      } catch {
        setShakeError('Network error. Please try again.');
      } finally {
        btn.disabled = false;
        if (btn.textContent !== '✓ Redirecting…') {
          btn.textContent = 'Unlock';
        }
      }
    }
  </script>
</body>
</html>`;
}
