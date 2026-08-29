import { renderIcons } from '../utils/icons.js';

export class RequestModal {
  constructor(socket, userSession) {
    this.socket = socket;
    this.session = userSession;
    this.container = document.getElementById('modal-container');
  }

  showSendRequestModal() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="modal-backdrop" id="req-modal-backdrop">
        <div class="modal-dialog-card glass-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="user-plus" style="color: var(--accent-cyan); width: 20px; height: 20px;"></i>
              <h3 style="font-size: 1.1rem; color: #fff; font-weight: 700;">Add Partner</h3>
            </div>
            <button id="btn-close-req-modal" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;">
              <i data-lucide="x"></i>
            </button>
          </div>

          <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
            Apne partner ka <strong>User Code</strong> enter karein. Unhe instantly screen par notification chala jayega!
          </p>

          <div style="background: rgba(0, 245, 212, 0.06); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--accent-cyan);">
            Your Code: <strong>${this.session.spaceId}</strong> (Share with partner)
          </div>

          <form id="send-req-form" style="display: flex; flex-direction: column; gap: 10px;">
            <input type="text" id="input-target-code" required placeholder="Enter Partner's Code (e.g. DUO-1234)" class="chat-input-field" style="width: 100%; text-transform: uppercase; font-family: var(--font-mono); font-weight: 600;" />
            
            <button type="submit" id="btn-submit-partner-req" class="btn btn-primary" style="width: 100%; padding: 10px;">
              <i data-lucide="send"></i> Send Partner Request 💌
            </button>
          </form>
        </div>
      </div>
    `;

    renderIcons();

    document.getElementById('btn-close-req-modal')?.addEventListener('click', () => {
      this.container.innerHTML = '';
    });

    document.getElementById('send-req-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const targetCode = document.getElementById('input-target-code').value.trim();
      if (!targetCode) return;

      if (this.socket) {
        this.socket.emit('send-partner-request', {
          fromUserId: this.session.userId,
          fromUserName: this.session.userName,
          toUserCode: targetCode
        });
      }

      this.container.innerHTML = '';
    });
  }

  showIncomingRequestModal(requestData, onAccept, onDecline) {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="modal-backdrop" id="incoming-req-backdrop">
        <div class="modal-dialog-card glass-card" style="border-color: var(--accent-rose); box-shadow: var(--shadow-glow-rose);">
          <div style="text-align: center;">
            <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(255, 51, 102, 0.2); border: 2px solid var(--accent-rose); display: inline-flex; align-items: center; justify-content: center; color: var(--accent-rose); font-size: 1.5rem; margin-bottom: 8px;">
              <i data-lucide="heart-handshake"></i>
            </div>
            <h3 style="font-size: 1.25rem; color: #fff; font-weight: 700;">Partner Invitation!</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">
              <strong style="color: var(--accent-rose-light); font-size: 1rem;">${requestData.fromUserName}</strong> (${requestData.fromUserCode}) wants to connect with you in a private couple orbit!
            </p>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 6px;">
            <button id="btn-decline-req" class="btn btn-secondary" style="flex: 1; padding: 10px;">
              <i data-lucide="x"></i> Decline
            </button>
            <button id="btn-accept-req" class="btn btn-primary" style="flex: 1.5; padding: 10px;">
              <i data-lucide="heart"></i> Accept & Connect ❤️
            </button>
          </div>
        </div>
      </div>
    `;

    renderIcons();

    document.getElementById('btn-accept-req')?.addEventListener('click', () => {
      this.container.innerHTML = '';
      if (onAccept) onAccept();
    });

    document.getElementById('btn-decline-req')?.addEventListener('click', () => {
      this.container.innerHTML = '';
      if (onDecline) onDecline();
    });
  }
}
