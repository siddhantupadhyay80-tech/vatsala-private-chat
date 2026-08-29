import { ephemeralStorage } from '../security/storage.js';
import { renderIcons } from '../utils/icons.js';

export class SecurityCoreView {
  constructor(userSession) {
    this.session = userSession;
    this.container = document.getElementById('security-component-mount');
    this.render();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="sanctuary-container" style="max-width: 960px;">
        <div class="sanctuary-col" style="grid-column: 1 / -1;">
          
          <!-- Main Security Banner -->
          <div class="glass-card" style="padding: 24px; background: linear-gradient(135deg, rgba(0, 245, 212, 0.1), rgba(14, 18, 28, 0.9)); border: 1px solid rgba(0, 245, 212, 0.3);">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
              <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(0, 245, 212, 0.15); border: 1px solid var(--accent-cyan); display: flex; align-items: center; justify-content: center; color: var(--accent-cyan); font-size: 1.6rem; box-shadow: var(--shadow-glow-cyan);">
                  <i data-lucide="shield-check"></i>
                </div>
                <div>
                  <h2 style="font-family: var(--font-display); font-size: 1.3rem; color: #fff;">
                    AntiGravity Zero-Knowledge Architecture
                  </h2>
                  <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 2px;">
                    Active Session: <strong style="color: var(--accent-cyan); font-family: var(--font-mono);">${this.session.spaceId}</strong>
                  </p>
                </div>
              </div>

              <div style="display: flex; gap: 10px;">
                <button id="btn-export-key" class="btn btn-secondary" style="font-size: 0.82rem;">
                  <i data-lucide="download"></i> Backup Space Keys
                </button>
                <button id="btn-purge-session" class="btn btn-primary" style="background: var(--accent-red); font-size: 0.82rem;">
                  <i data-lucide="power"></i> Lock & Purge RAM
                </button>
              </div>
            </div>
          </div>

          <!-- Security Matrix 3-Card Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 10px;">
            
            <div class="glass-card" style="padding: 20px;">
              <div style="color: var(--accent-cyan); font-size: 1.2rem; margin-bottom: 8px;">
                <i data-lucide="key-round"></i>
              </div>
              <h3 style="font-size: 1rem; color: #fff; margin-bottom: 6px;">Zero Phone Identity</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
                No phone number, SIM card, or SMS OTP is required or logged. Your identity is mathematically bound to your Space ID.
              </p>
            </div>

            <div class="glass-card" style="padding: 20px;">
              <div style="color: var(--accent-rose); font-size: 1.2rem; margin-bottom: 8px;">
                <i data-lucide="lock"></i>
              </div>
              <h3 style="font-size: 1rem; color: #fff; margin-bottom: 6px;">AES-GCM-256 E2EE</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
                Hardware-accelerated encryption via Web Crypto API. Encryption keys never leave your browser device.
              </p>
            </div>

            <div class="glass-card" style="padding: 20px;">
              <div style="color: var(--accent-amber); font-size: 1.2rem; margin-bottom: 8px;">
                <i data-lucide="shield-alert"></i>
              </div>
              <h3 style="font-size: 1rem; color: #fff; margin-bottom: 6px;">Anti-Leak & Camouflage</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
                Press <kbd style="background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 4px; font-family: monospace;">Esc</kbd> anytime to disguise as Excel spreadsheet. Auto-blurs on tab change.
              </p>
            </div>
          </div>

          <!-- Cryptographic Specs Detail -->
          <div class="glass-card" style="padding: 20px; margin-top: 10px;">
            <h3 style="font-size: 0.95rem; color: #fff; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="terminal" style="color: var(--accent-cyan);"></i> Cryptographic Session Telemetry
            </h3>
            <div style="display: flex; flex-direction: column; gap: 8px; font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-secondary);">
              <div>• Encryption Cipher: <span style="color: var(--accent-cyan);">AES-GCM-256 (SubtleCrypto Native)</span></div>
              <div>• Key Derivation Function: <span style="color: var(--accent-cyan);">PBKDF2 (SHA-256, 100,000 Iterations)</span></div>
              <div>• Media Transit Security: <span style="color: var(--accent-cyan);">WebRTC DTLS-SRTP P2P + Zero-Knowledge Signaling</span></div>
              <div>• Volatile Memory Protection: <span style="color: var(--accent-green);">Active (Blob URL auto-revocation enabled)</span></div>
            </div>
          </div>

        </div>
      </div>
    `;

    renderIcons();
    this.attachEvents();
  }

  attachEvents() {
    const btnExport = document.getElementById('btn-export-key');
    const btnPurge = document.getElementById('btn-purge-session');

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const backupData = JSON.stringify({
          app: 'AntiGravity Duo',
          spaceId: this.session.spaceId,
          passphrase: this.session.passphrase,
          exportedAt: new Date().toISOString()
        }, null, 2);

        const blob = new Blob([backupData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AntiGravity_Duo_Keys_${this.session.spaceId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (btnPurge) {
      btnPurge.addEventListener('click', () => {
        if (confirm('Lock and purge all secret decrypted moments from device RAM?')) {
          ephemeralStorage.clearSession();
          window.location.reload();
        }
      });
    }
  }
}
