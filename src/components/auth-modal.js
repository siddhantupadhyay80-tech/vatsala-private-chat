import { cryptoEngine } from '../security/crypto.js';
import { ephemeralStorage } from '../security/storage.js';
import { renderIcons } from '../utils/icons.js';

export class AuthModal {
  constructor(onAuthenticated) {
    this.onAuthenticated = onAuthenticated;
    this.container = document.getElementById('modal-container');
  }

  show() {
    this.render();
  }

  hide() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  getInvitePinFromUrl() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pinParam = urlParams.get('pin') || urlParams.get('join') || urlParams.get('space');
      if (pinParam) return pinParam.trim().toUpperCase();

      // Check hash (e.g. #pin=1234 or #1234)
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('pin=')) {
        return hash.replace('pin=', '').trim().toUpperCase();
      } else if (hash.length >= 3 && hash.length <= 10) {
        return hash.trim().toUpperCase();
      }
    } catch (e) {}
    return '';
  }

  render() {
    if (!this.container) return;

    const invitePin = this.getInvitePinFromUrl();

    this.container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog-card glass-card" style="max-width: 380px;">
          <!-- Logo & Title -->
          <div style="text-align: center;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: radial-gradient(circle, #ff3366 0%, #8a2be2 100%); margin-bottom: 8px; box-shadow: 0 0 24px rgba(255, 51, 102, 0.6);">
              <i data-lucide="heart" style="color: #fff; width: 28px; height: 28px;"></i>
            </div>
            <h2 style="font-family: var(--font-display); font-size: 1.6rem; color: #fff; font-weight: 700;">Vatsala</h2>
            <p style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 2px;">
              Private 3D Encrypted Couple Space
            </p>
          </div>

          ${invitePin ? `
            <div style="background: rgba(0, 245, 212, 0.12); border: 1px solid var(--accent-cyan); padding: 8px 12px; border-radius: var(--radius-md); font-size: 0.78rem; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px; margin-top: 6px;">
              <i data-lucide="link-2" style="width: 16px; height: 16px; flex-shrink: 0;"></i>
              <span>Partner Invite Link Detected! PIN <strong>${invitePin}</strong> auto-applied.</span>
            </div>
          ` : ''}

          <!-- Ultra-Simple 2-Field Login Form -->
          <form id="auth-form" style="display: flex; flex-direction: column; gap: 14px; margin-top: 8px;">
            <!-- Field 1: Name -->
            <div>
              <label style="display: block; font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase;">
                1. Your Name
              </label>
              <input type="text" id="input-username" required placeholder="e.g. Rahul or Priya" class="chat-input-field" style="width: 100%; border-radius: var(--radius-md); font-size: 0.95rem;" autofocus />
            </div>

            <!-- Field 2: Permanent Couple Secret PIN -->
            <div>
              <label style="display: flex; justify-content: space-between; font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase;">
                <span>2. Secret Couple PIN</span>
                <span style="color: var(--accent-cyan); font-size: 0.72rem;">Any 4-digit code</span>
              </label>
              <input type="text" id="input-couple-pin" required value="${invitePin || '1234'}" placeholder="e.g. 1234 or 7788" class="chat-input-field" style="width: 100%; border-radius: var(--radius-md); font-family: var(--font-mono); color: var(--accent-cyan); font-size: 1.15rem; font-weight: 700; text-align: center; letter-spacing: 2px;" />
            </div>

            <!-- Easy Tip -->
            <div style="background: rgba(255, 255, 255, 0.05); border: 1px dashed rgba(255, 255, 255, 0.15); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.72rem; color: var(--text-secondary); line-height: 1.4;">
              💡 <strong>Simple Rule:</strong> Dono phones me same 4-digit PIN daalenge to bina kisi request ke aapas me turant jud jayenge!
            </div>

            <button type="submit" id="btn-submit-auth" class="btn btn-primary" style="width: 100%; padding: 12px; margin-top: 4px; border-radius: var(--radius-md); font-size: 0.95rem;">
              <i data-lucide="lock"></i> Enter Private Space ❤️
            </button>
          </form>
        </div>
      </div>
    `;

    renderIcons();
    this.attachEvents();
  }

  attachEvents() {
    const form = document.getElementById('auth-form');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userName = document.getElementById('input-username').value.trim();
        const pin = document.getElementById('input-couple-pin').value.trim().toUpperCase();

        if (!userName || !pin) return;

        const submitBtn = document.getElementById('btn-submit-auth');
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Connecting Orbit...</span>`;

        try {
          const spaceId = `PIN-${pin}`;
          await cryptoEngine.deriveKey(pin, spaceId);

          const userId = `user_${Math.random().toString(36).substring(2, 9)}`;
          ephemeralStorage.saveSession(spaceId, userId, userName, pin);

          this.hide();

          if (this.onAuthenticated) {
            this.onAuthenticated({
              spaceId,
              pin,
              userId,
              userName,
              passphrase: pin
            });
          }
        } catch (err) {
          console.error('PIN derivation failed:', err);
          alert('Failed to initialize security key.');
          submitBtn.disabled = false;
        }
      });
    }
  }
}
