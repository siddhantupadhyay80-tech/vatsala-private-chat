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

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog-card glass-card">
          <!-- Logo & Title -->
          <div style="text-align: center;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 54px; height: 54px; border-radius: 50%; background: radial-gradient(circle, #ff3366 0%, #8a2be2 100%); margin-bottom: 8px; box-shadow: 0 0 20px rgba(255, 51, 102, 0.5);">
              <i data-lucide="heart" style="color: #fff; width: 28px; height: 28px;"></i>
            </div>
            <h2 style="font-family: var(--font-display); font-size: 1.55rem; color: #fff; font-weight: 700; letter-spacing: 0.5px;">Vatsala</h2>
            <p style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 2px;">
              Permanent Encrypted Space for Couples
            </p>
          </div>

          <!-- Ultra-Simple 2-Field PIN Login Form -->
          <form id="auth-form" style="display: flex; flex-direction: column; gap: 14px; margin-top: 8px;">
            <!-- Field 1: Name -->
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase;">
                1. Your Name / Nickname
              </label>
              <input type="text" id="input-username" required placeholder="e.g. Rahul or Priya" class="chat-input-field" style="width: 100%; border-radius: var(--radius-md); font-size: 0.95rem;" />
            </div>

            <!-- Field 2: Permanent Couple Secret PIN -->
            <div>
              <label style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase;">
                <span>2. Permanent Couple PIN</span>
                <span style="color: var(--accent-cyan); font-size: 0.72rem;">Shared with Partner</span>
              </label>
              <input type="text" id="input-couple-pin" required placeholder="e.g. 7890 or LOVE99" class="chat-input-field" style="width: 100%; border-radius: var(--radius-md); font-family: var(--font-mono); color: var(--accent-cyan); font-size: 1.1rem; font-weight: 700; text-align: center; letter-spacing: 2px;" />
            </div>

            <!-- Info Pill -->
            <div style="background: rgba(0, 245, 212, 0.06); border: 1px dashed rgba(0, 245, 212, 0.3); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.74rem; color: var(--text-secondary); line-height: 1.4;">
              ✨ Dono partners bas same <strong>Permanent PIN</strong> daal kar enter karenge to apne aap aapas me auto-connect aur add ho jayenge!
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
