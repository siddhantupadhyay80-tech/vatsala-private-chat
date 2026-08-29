import { cryptoEngine } from '../security/crypto.js';
import { ephemeralStorage } from '../security/storage.js';
import { renderIcons } from '../utils/icons.js';

export class MediaVaultView {
  constructor(socket, userSession) {
    this.socket = socket;
    this.session = userSession;
    this.container = document.getElementById('vault-component-mount');
    this.mediaItems = [];
    this.activeViewerUrl = null;

    this.render();
    this.initSocketListeners();
    this.seedDemoMoments();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="vault-container">
        <!-- Vault Banner -->
        <div class="vault-header-banner glass-card">
          <div class="vault-title-group">
            <h2>
              <i data-lucide="shield-alert" style="color: var(--accent-rose);"></i>
              Encrypted Secret Vault
            </h2>
            <p>
              Photos and videos are hardware-encrypted on your device. Unviewed items stay encrypted; view-once media self-destructs.
            </p>
          </div>
          <div class="vault-actions-group">
            <label class="btn-upload-secret" for="vault-file-input">
              <i data-lucide="upload-cloud"></i>
              <span>Encrypt & Share Media</span>
            </label>
            <input type="file" id="vault-file-input" accept="image/*,video/*" style="display: none;" />
          </div>
        </div>

        <!-- Filter Tags -->
        <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;">
          <button class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.8rem; border-radius: var(--radius-full); background: rgba(255, 51, 102, 0.2); border-color: var(--accent-rose);">
            🌟 All Moments (<span id="vault-count">0</span>)
          </button>
          <button class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.8rem; border-radius: var(--radius-full);">
            🔥 View-Once Only
          </button>
          <button class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.8rem; border-radius: var(--radius-full);">
            ✈️ Trips & Dates
          </button>
        </div>

        <!-- Media Grid -->
        <div class="vault-grid" id="vault-grid">
          <!-- Items dynamically populated -->
        </div>
      </div>
    `;

    renderIcons();
    this.attachEvents();
  }

  attachEvents() {
    const fileInput = document.getElementById('vault-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isViewOnce = confirm('Would you like this media to be "VIEW ONCE" (Auto-destructs after 10s)?\n\nClick OK for View-Once, or Cancel for Permanent Vault.');
        await this.handleEncryptAndUpload(file, isViewOnce);
        fileInput.value = '';
      });
    }
  }

  async handleEncryptAndUpload(file, isViewOnce = false) {
    try {
      // 1. Encrypt raw binary on client
      const encrypted = await cryptoEngine.encryptBinary(file);

      // Create thumbnail / object URL in RAM
      const localUrl = ephemeralStorage.createManagedBlobUrl(file);

      const mediaRecord = {
        id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: file.name,
        type: file.type.startsWith('video') ? 'video' : 'image',
        isViewOnce,
        encryptedPayload: encrypted,
        localBlobUrl: localUrl,
        senderName: this.session.userName,
        timestamp: Date.now(),
        viewed: false
      };

      this.mediaItems.unshift(mediaRecord);
      this.renderGrid();

      // Transmit encrypted payload to partner via WebSocket relay
      if (this.socket) {
        this.socket.emit('send-encrypted-media', {
          id: mediaRecord.id,
          title: mediaRecord.title,
          type: mediaRecord.type,
          isViewOnce: mediaRecord.isViewOnce,
          encryptedPayload: encrypted,
          senderName: mediaRecord.senderName,
          timestamp: mediaRecord.timestamp
        });
      }
    } catch (err) {
      console.error('Failed to encrypt media file:', err);
      alert('Encryption failed. Please check file size and permissions.');
    }
  }

  initSocketListeners() {
    if (!this.socket) return;

    this.socket.on('receive-encrypted-media', (payload) => {
      this.mediaItems.unshift({
        ...payload,
        localBlobUrl: null, // Will decrypt on click
        viewed: false
      });
      this.renderGrid();
    });
  }

  renderGrid() {
    const grid = document.getElementById('vault-grid');
    const countEl = document.getElementById('vault-count');
    if (!grid) return;

    if (countEl) countEl.textContent = this.mediaItems.length;

    grid.innerHTML = '';

    this.mediaItems.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'vault-media-card';
      card.id = `card-${item.id}`;

      let viewOnceTag = item.isViewOnce
        ? `<div class="view-once-badge"><i data-lucide="flame" style="width: 12px; height: 12px;"></i> View Once</div>`
        : '';

      let mediaPreview = '';
      if (item.viewed && item.isViewOnce) {
        mediaPreview = `
          <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#111; color:var(--accent-red); padding:20px; text-align:center;">
            <i data-lucide="flame-kindling" style="width:36px; height:36px; margin-bottom:8px;"></i>
            <span style="font-size:0.8rem; font-weight:bold;">EXPIRED & PURGED</span>
          </div>
        `;
      } else if (item.localBlobUrl) {
        if (item.type === 'video') {
          mediaPreview = `<video src="${item.localBlobUrl}#t=0.5" preload="metadata"></video>`;
        } else {
          mediaPreview = `<img src="${item.localBlobUrl}" alt="${item.title}" loading="lazy" />`;
        }
      } else {
        // Un-decrypted remote item
        mediaPreview = `
          <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(18,22,35,0.9); color:var(--accent-cyan); padding:20px; text-align:center;">
            <i data-lucide="lock" style="width:32px; height:32px; margin-bottom:8px;"></i>
            <span style="font-size:0.75rem; font-family:var(--font-mono);">AES-256 ENCRYPTED</span>
            <span style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">Click to Decrypt</span>
          </div>
        `;
      }

      card.innerHTML = `
        ${viewOnceTag}
        ${mediaPreview}
        <div class="vault-media-overlay">
          <div class="vault-media-title">${item.title || 'Private Moment'}</div>
          <div class="vault-media-tag">
            <i data-lucide="shield-check" style="width: 12px; height: 12px;"></i>
            <span>By ${item.senderName} • ${new Date(item.timestamp).toLocaleDateString()}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => this.openMediaViewer(item));
      grid.appendChild(card);
    });

    renderIcons();
  }

  async openMediaViewer(item) {
    if (item.viewed && item.isViewOnce) {
      alert('This view-once media has already expired and was permanently wiped.');
      return;
    }

    // Decrypt if needed
    let activeUrl = item.localBlobUrl;
    if (!activeUrl && item.encryptedPayload) {
      try {
        const decryptedBlob = await cryptoEngine.decryptBinary(item.encryptedPayload);
        activeUrl = ephemeralStorage.createManagedBlobUrl(decryptedBlob);
        item.localBlobUrl = activeUrl;
      } catch (err) {
        alert('Decryption failed. Secret key mismatch.');
        return;
      }
    }

    const viewerContainer = document.getElementById('media-viewer-container');
    if (!viewerContainer) return;

    let countdownSeconds = 10;
    let timerInterval = null;

    viewerContainer.innerHTML = `
      <div class="modal-backdrop" id="viewer-backdrop" style="background: rgba(4, 5, 8, 0.96);">
        <div style="position: relative; max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          
          <!-- Top bar -->
          <div style="position: absolute; top: -50px; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; color: #fff;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="shield-check" style="color: var(--accent-cyan); width: 18px; height: 18px;"></i>
              <span style="font-family: var(--font-mono); font-size: 0.88rem;">${item.title}</span>
            </div>
            ${item.isViewOnce ? `
              <div style="background: var(--accent-red); color: #fff; font-weight: bold; font-family: var(--font-mono); padding: 4px 12px; border-radius: var(--radius-full);" id="view-once-countdown">
                🔥 Purge in ${countdownSeconds}s
              </div>
            ` : ''}
            <button id="btn-close-viewer" class="btn btn-secondary" style="padding: 6px 12px;">
              <i data-lucide="x"></i> Close
            </button>
          </div>

          <!-- Media Display -->
          <div style="border-radius: var(--radius-lg); overflow: hidden; max-height: 80vh; max-width: 85vw; box-shadow: 0 0 40px rgba(0,0,0,0.9), 0 0 20px rgba(255,51,102,0.3); border: 1px solid rgba(255,255,255,0.2);">
            ${item.type === 'video' ? `
              <video src="${activeUrl}" controls autoplay style="max-height: 75vh; max-width: 80vw; display: block;"></video>
            ` : `
              <img src="${activeUrl}" alt="Moment" style="max-height: 75vh; max-width: 80vw; object-fit: contain; display: block;" />
            `}
          </div>
        </div>
      </div>
    `;

    renderIcons();

    const closeViewer = () => {
      if (timerInterval) clearInterval(timerInterval);
      viewerContainer.innerHTML = '';
      if (item.isViewOnce) {
        item.viewed = true;
        ephemeralStorage.revokeBlobUrl(item.localBlobUrl);
        item.localBlobUrl = null;
        this.renderGrid();
      }
    };

    document.getElementById('btn-close-viewer')?.addEventListener('click', closeViewer);

    if (item.isViewOnce) {
      const countdownEl = document.getElementById('view-once-countdown');
      timerInterval = setInterval(() => {
        countdownSeconds--;
        if (countdownEl) countdownEl.textContent = `🔥 Purge in ${countdownSeconds}s`;
        if (countdownSeconds <= 0) {
          clearInterval(timerInterval);
          closeViewer();
        }
      }, 1000);
    }
  }

  // Demonstration starter media with zero-gravity aesthetics
  seedDemoMoments() {
    // Generate a sleek procedural starter canvas moment
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 750;
    const ctx = canvas.getContext('2d');

    // Cosmic gradient
    const grad = ctx.createLinearGradient(0, 0, 600, 750);
    grad.addColorStop(0, '#0f0c29');
    grad.addColorStop(0.5, '#302b63');
    grad.addColorStop(1, '#24243e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 750);

    // Glowing Twin Hearts Art
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ff3366';
    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💫 AntiGravity Sanctuary', 300, 320);

    ctx.font = '18px Space Grotesk, sans-serif';
    ctx.fillStyle = '#00f5d4';
    ctx.fillText('First Encrypted Moment in Space Orbit', 300, 380);

    ctx.font = '14px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Hardware Encrypted • E2EE AES-GCM-256', 300, 420);

    canvas.toBlob(async (blob) => {
      const url = ephemeralStorage.createManagedBlobUrl(blob);
      const encrypted = await cryptoEngine.encryptBinary(blob);

      this.mediaItems.push({
        id: 'seed_moment_1',
        title: 'Cosmic Journey Launch',
        type: 'image',
        isViewOnce: false,
        encryptedPayload: encrypted,
        localBlobUrl: url,
        senderName: 'AntiGravity Core',
        timestamp: Date.now() - 3600000 * 24,
        viewed: false
      });

      this.renderGrid();
    });
  }
}
