import { renderIcons } from '../utils/icons.js';
import { notificationEngine } from '../utils/notifications.js';

export class ProfileModal {
  constructor(currentSession, onProfileUpdated) {
    this.session = currentSession;
    this.onProfileUpdated = onProfileUpdated;
    this.container = document.getElementById('modal-container');
    this.profileData = this.loadProfile();
  }

  loadProfile() {
    try {
      const saved = localStorage.getItem('agy_duo_my_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {}

    return {
      name: this.session.userName || 'Rahul',
      bio: 'In our celestial space forever ❤️',
      avatarUrl: '',
      pin: this.session.pin || this.session.spaceId?.replace('PIN-', '') || '1234'
    };
  }

  saveProfile(data) {
    this.profileData = { ...this.profileData, ...data };
    try {
      localStorage.setItem('agy_duo_my_profile', JSON.stringify(this.profileData));
    } catch (e) {}

    if (this.onProfileUpdated) {
      this.onProfileUpdated(this.profileData);
    }
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

    const { name, bio, avatarUrl, pin } = this.profileData;

    this.container.innerHTML = `
      <div class="modal-backdrop" id="profile-modal-backdrop">
        <div class="modal-dialog-card glass-card profile-dialog">
          
          <!-- Top Header -->
          <div class="profile-header-bar">
            <h3 style="font-family: var(--font-display); font-size: 1.2rem; color: #fff;">My Profile</h3>
            <button id="btn-close-profile" class="btn btn-secondary" style="padding: 3px 8px; font-size: 0.75rem;">
              <i data-lucide="x"></i>
            </button>
          </div>

          <!-- Avatar / Profile Picture with Upload Camera -->
          <div class="profile-avatar-section">
            <div class="profile-avatar-wrapper">
              ${avatarUrl ? `
                <img src="${avatarUrl}" alt="Avatar" class="profile-avatar-img" id="profile-preview-img" />
              ` : `
                <div class="profile-avatar-placeholder" id="profile-preview-placeholder">
                  ${name.charAt(0).toUpperCase()}
                </div>
              `}
              <label for="input-avatar-file" class="avatar-camera-btn" title="Change Profile Photo">
                <i data-lucide="camera" style="width: 16px; height: 16px; color: #fff;"></i>
              </label>
              <input type="file" id="input-avatar-file" accept="image/*" style="display: none;" />
            </div>
            <span style="font-size: 0.72rem; color: var(--accent-cyan); margin-top: 4px;">Tap camera to upload photo</span>
          </div>

          <!-- Edit Profile Form -->
          <form id="form-edit-profile" style="display: flex; flex-direction: column; gap: 14px;">
            <!-- Name Input -->
            <div>
              <label class="profile-label">
                <i data-lucide="user" style="width: 13px; height: 13px; color: var(--accent-rose);"></i>
                <span>Your Name</span>
              </label>
              <input type="text" id="input-profile-name" value="${this.escapeHtml(name)}" required placeholder="Enter your name" class="chat-input-field profile-input" />
            </div>

            <!-- About / Bio Input (WhatsApp Style) -->
            <div>
              <label class="profile-label">
                <i data-lucide="info" style="width: 13px; height: 13px; color: var(--accent-cyan);"></i>
                <span>About / Bio</span>
              </label>
              <input type="text" id="input-profile-bio" value="${this.escapeHtml(bio)}" placeholder="Write something romantic or cute..." class="chat-input-field profile-input" />
              
              <!-- Quick Romantic Bio Chips -->
              <div class="bio-chips-list">
                <span class="bio-chip" data-text="Forever with you ❤️">Forever with you ❤️</span>
                <span class="bio-chip" data-text="Only for my love 🔐">Only for my love 🔐</span>
                <span class="bio-chip" data-text="In our private orbit ✨">In our private orbit ✨</span>
                <span class="bio-chip" data-text="Available in Space 🟢">Available in Space 🟢</span>
              </div>
            </div>

            <!-- Permanent Couple PIN (Copyable) -->
            <div>
              <label class="profile-label">
                <i data-lucide="key" style="width: 13px; height: 13px; color: var(--accent-amber);"></i>
                <span>Permanent Couple PIN</span>
              </label>
              <div class="profile-pin-box" id="btn-copy-profile-pin" title="Tap to copy PIN">
                <span style="font-family: var(--font-mono); font-size: 1.15rem; font-weight: 700; color: var(--accent-cyan); letter-spacing: 2px;">${pin}</span>
                <button type="button" class="btn-copy-pin-pill">
                  <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copy PIN
                </button>
              </div>
            </div>

            <!-- Save Button -->
            <button type="submit" class="btn btn-primary" style="padding: 11px; margin-top: 4px; border-radius: var(--radius-md); font-size: 0.92rem;">
              <i data-lucide="check"></i> Save Profile
            </button>
          </form>

        </div>
      </div>
    `;

    renderIcons();
    this.attachEvents();
  }

  attachEvents() {
    document.getElementById('btn-close-profile')?.addEventListener('click', () => {
      this.hide();
    });

    // Copy PIN
    document.getElementById('btn-copy-profile-pin')?.addEventListener('click', () => {
      const pin = this.profileData.pin;
      navigator.clipboard.writeText(pin);
      notificationEngine.showToast('PIN Copied', `PIN ${pin} copied! Share with your partner.`, 'check');
    });

    // Bio Chips
    document.querySelectorAll('.bio-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-text');
        const bioInput = document.getElementById('input-profile-bio');
        if (bioInput) bioInput.value = text;
      });
    });

    // Upload Avatar File
    const fileInput = document.getElementById('input-avatar-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Url = event.target.result;
          this.profileData.avatarUrl = base64Url;

          // Update Preview in DOM
          const previewImg = document.getElementById('profile-preview-img');
          const previewPlaceholder = document.getElementById('profile-preview-placeholder');

          if (previewImg) {
            previewImg.src = base64Url;
          } else if (previewPlaceholder) {
            const newImg = document.createElement('img');
            newImg.src = base64Url;
            newImg.alt = 'Avatar';
            newImg.className = 'profile-avatar-img';
            newImg.id = 'profile-preview-img';
            previewPlaceholder.replaceWith(newImg);
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Form Submit
    document.getElementById('form-edit-profile')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('input-profile-name').value.trim();
      const bio = document.getElementById('input-profile-bio').value.trim();

      if (!name) return;

      this.saveProfile({
        name,
        bio
      });

      notificationEngine.showToast('Profile Updated', 'Aapka Name, Photo aur Bio save ho gaya!', 'user-check');
      this.hide();
    });
  }

  escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
