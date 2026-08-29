import { renderIcons } from '../utils/icons.js';
import { ephemeralStorage } from '../security/storage.js';
import { notificationEngine } from '../utils/notifications.js';
import { ProfileModal } from './profile-modal.js';
import confetti from 'canvas-confetti';

export class HomeView {
  constructor(socket, userSession, onOpenChat, onStartCall, onSendPing, onRemovePartner, onSendLovePulse) {
    this.socket = socket;
    this.session = userSession;
    this.onOpenChat = onOpenChat;
    this.onStartCall = onStartCall;
    this.onSendPing = onSendPing;
    this.onRemovePartner = onRemovePartner;
    this.onSendLovePulse = onSendLovePulse;

    this.container = document.getElementById('chat-component-mount');
    this.friends = ephemeralStorage.getFriendsList();
    this.pendingRequests = ephemeralStorage.getPendingRequests();
    this.myProfile = this.loadMyProfile();
    this.searchQuery = '';

    const pin = this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '');
    notificationEngine.subscribeToPush(pin);

    this.render();
  }

  loadMyProfile() {
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

  setFriends(friends) {
    this.friends = friends;
    this.render();
  }

  setPendingRequests(requests) {
    this.pendingRequests = requests;
    this.render();
  }

  render() {
    if (!this.container) return;

    const pin = this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '');
    const isNotifGranted = 'Notification' in window && Notification.permission === 'granted';

    const filteredFriends = this.friends.filter(f => 
      !this.searchQuery || 
      (f.userName && f.userName.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
      (f.userCode && f.userCode.toLowerCase().includes(this.searchQuery.toLowerCase()))
    );

    this.container.innerHTML = `
      <div class="friends-hub-home">
        <!-- Top Profile & Actions Header (WhatsApp Style) -->
        <header class="hub-header glass-card">
          <!-- Profile Pill (Tap to open Profile Editor) -->
          <div class="hub-user-pill" id="btn-open-my-profile" title="Edit Profile (Photo, Name, Bio)">
            <div class="hub-avatar-orb">
              ${this.myProfile.avatarUrl ? `
                <img src="${this.myProfile.avatarUrl}" alt="Avatar" class="hub-avatar-img" />
              ` : `
                ${(this.myProfile.name || 'U').charAt(0).toUpperCase()}
              `}
            </div>
            <div class="hub-user-meta">
              <span class="hub-user-name">${this.myProfile.name || this.session.userName}</span>
              <span class="hub-user-bio-preview">${this.myProfile.bio || 'Tap to set photo & bio...'}</span>
            </div>
          </div>

          <div class="hub-header-actions">
            <!-- Copy PIN Badge -->
            <span class="hub-pin-badge" id="btn-copy-pin" title="Tap to copy your PIN">
              PIN: <strong>${pin}</strong> <i data-lucide="copy" style="width: 10px; height: 10px;"></i>
            </span>

            ${!isNotifGranted ? `
              <button id="btn-enable-notif" class="btn-hub-icon notif-alert" title="Turn ON Background Push Notifications">
                <i data-lucide="bell-ring"></i>
              </button>
            ` : ''}
            
            <button id="btn-profile-gear" class="btn-hub-icon" title="Edit Profile">
              <i data-lucide="user"></i>
            </button>

            <button id="btn-open-add-friend" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.78rem; border-radius: var(--radius-full);">
              <i data-lucide="user-plus"></i> + Add Friend
            </button>
          </div>
        </header>

        <!-- Search Friends Bar -->
        <div class="hub-search-wrap">
          <div class="hub-search-box glass-card">
            <i data-lucide="search" style="width: 15px; height: 15px; color: var(--text-muted);"></i>
            <input type="text" id="input-search-friends" placeholder="Search friends by name or PIN..." value="${this.searchQuery}" class="hub-search-input" />
          </div>
        </div>

        <!-- Scrollable Body -->
        <div class="hub-body-scroll">
          <!-- Pending Incoming Requests Section -->
          ${this.pendingRequests.length > 0 ? `
            <div class="hub-section-title" style="color: var(--accent-amber);">
              <i data-lucide="mail" style="width: 14px; height: 14px;"></i>
              <span>Incoming Join Requests (${this.pendingRequests.length})</span>
            </div>
            <div class="hub-requests-list">
              ${this.pendingRequests.map(req => `
                <div class="request-card glass-card">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="request-avatar">
                      ${(req.fromUserName || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style="font-weight: 700; font-size: 0.88rem; color: #fff;">${req.fromUserName}</div>
                      <div style="font-size: 0.70rem; color: var(--accent-cyan); font-family: var(--font-mono);">PIN: ${req.fromPin}</div>
                    </div>
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn-req-action btn-accept-req" data-pin="${req.fromPin}" data-name="${req.fromUserName}" title="Accept">
                      <i data-lucide="check"></i> Accept
                    </button>
                    <button class="btn-req-action btn-decline-req" data-pin="${req.fromPin}" title="Decline">
                      <i data-lucide="x"></i>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- Friends List Header -->
          <div class="hub-section-title">
            <i data-lucide="users" style="width: 14px; height: 14px; color: var(--accent-rose);"></i>
            <span>All Friends & Connected Partners (${this.friends.length})</span>
          </div>

          <!-- Friends / Chats Cards List -->
          <div class="hub-friends-list">
            ${filteredFriends.length === 0 ? `
              <div class="hub-empty-state glass-card">
                <div style="font-size: 1.8rem; margin-bottom: 6px;">💑</div>
                <div style="font-weight: 700; font-size: 0.92rem; color: #fff;">No Friends Added Yet</div>
                <p style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
                  Upar <strong>"+ Add Friend"</strong> par tap karein aur apne partner ka Name & PIN daal kar request bhejein!
                </p>
              </div>
            ` : `
              ${filteredFriends.map(friend => `
                <div class="hub-friend-card glass-card" data-code="${friend.userCode || friend.pin}">
                  <!-- Friend Avatar & Online Dot -->
                  <div class="friend-avatar-wrap" data-code="${friend.userCode || friend.pin}">
                    <div class="friend-avatar-orb">
                      ${friend.avatarUrl ? `
                        <img src="${friend.avatarUrl}" alt="Avatar" class="hub-avatar-img" />
                      ` : `
                        ${(friend.userName || 'P').charAt(0).toUpperCase()}
                      `}
                    </div>
                    <span class="friend-presence-dot ${friend.isOnline ? 'online' : 'offline'}"></span>
                  </div>

                  <!-- Friend Details -->
                  <div class="friend-info" data-code="${friend.userCode || friend.pin}">
                    <div class="friend-info-top">
                      <span class="friend-name">${friend.userName || 'Partner'}</span>
                      <span class="friend-status-badge ${friend.isOnline ? 'online' : 'offline'}">
                        ${friend.isOnline ? '🟢 Online' : '🌙 Standby'}
                      </span>
                    </div>
                    <div class="friend-preview-text">
                      ${friend.bio || friend.lastMessage || 'Tap to open encrypted chat & calls...'}
                    </div>
                  </div>

                  <!-- Action Buttons on each Card (No WhatsApp summon button) -->
                  <div class="friend-actions-dock">
                    <button class="btn-card-dock btn-dock-chat" data-code="${friend.userCode || friend.pin}" title="Open Chat">
                      <i data-lucide="message-circle"></i>
                    </button>
                    
                    <button class="btn-card-dock btn-dock-ping" data-pin="${friend.pin || friend.userCode?.replace('PIN-', '')}" data-name="${friend.userName}" title="Wakeup Push Ring">
                      <i data-lucide="bell"></i>
                    </button>

                    <button class="btn-card-dock btn-dock-voice" data-code="${friend.userCode || friend.pin}" title="Voice Call">
                      <i data-lucide="phone"></i>
                    </button>

                    <button class="btn-card-dock btn-dock-video" data-code="${friend.userCode || friend.pin}" title="Video Call">
                      <i data-lucide="video"></i>
                    </button>

                    <button class="btn-card-dock btn-dock-delete" data-code="${friend.userCode || friend.pin}" title="Remove Friend">
                      <i data-lucide="trash-2"></i>
                    </button>
                  </div>
                </div>
              `).join('')}
            `}
          </div>
        </div>

        <!-- Add Friend / Send Request Modal -->
        <div id="add-friend-modal-container"></div>
      </div>
    `;

    renderIcons();
    this.attachEvents();
  }

  attachEvents() {
    // Open Profile Modal
    const openProfile = () => {
      const modal = new ProfileModal(this.session, (updatedProfile) => {
        this.myProfile = updatedProfile;
        const pin = this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '');
        notificationEngine.subscribeToPush(pin);
        this.render();
      });
      modal.show();
    };

    document.getElementById('btn-open-my-profile')?.addEventListener('click', openProfile);
    document.getElementById('btn-profile-gear')?.addEventListener('click', openProfile);

    // Copy PIN
    document.getElementById('btn-copy-pin')?.addEventListener('click', () => {
      const pin = this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '');
      navigator.clipboard.writeText(pin);
      notificationEngine.showToast('PIN Copied', `PIN ${pin} copied! Share with your partner.`, 'check');
    });

    // Permission Alert & Auto-Subscribe
    document.getElementById('btn-enable-notif')?.addEventListener('click', async () => {
      const pin = this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '');
      const granted = await notificationEngine.requestPermission(pin);
      if (granted) this.render();
    });

    // Search Input
    const searchInput = document.getElementById('input-search-friends');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
      });
    }

    // Open Add Friend Modal
    document.getElementById('btn-open-add-friend')?.addEventListener('click', () => {
      this.showAddFriendModal();
    });

    // Accept Request
    document.querySelectorAll('.btn-accept-req').forEach(btn => {
      btn.addEventListener('click', () => {
        const fromPin = btn.getAttribute('data-pin');
        const fromName = btn.getAttribute('data-name');

        ephemeralStorage.saveFriend({
          userName: fromName,
          userCode: `PIN-${fromPin}`,
          pin: fromPin,
          isOnline: true,
          lastMessage: 'Connected ❤️'
        });
        ephemeralStorage.removePendingRequest(fromPin);

        confetti({ particleCount: 80, spread: 70 });
        notificationEngine.showToast('Request Accepted', `${fromName} is now your connected partner!`, 'user-check');

        if (this.socket) {
          this.socket.emit('accept-friend-request', {
            toPin: fromPin,
            fromUserName: this.myProfile.name || this.session.userName,
            fromPin: this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '')
          });
        }

        this.friends = ephemeralStorage.getFriendsList();
        this.pendingRequests = ephemeralStorage.getPendingRequests();
        this.render();
      });
    });

    // Decline Request
    document.querySelectorAll('.btn-decline-req').forEach(btn => {
      btn.addEventListener('click', () => {
        const fromPin = btn.getAttribute('data-pin');
        ephemeralStorage.removePendingRequest(fromPin);
        this.pendingRequests = ephemeralStorage.getPendingRequests();
        this.render();
      });
    });

    // Card Actions: Open Chat
    document.querySelectorAll('.btn-dock-chat, .friend-info, .friend-avatar-wrap').forEach(el => {
      el.addEventListener('click', (e) => {
        const code = el.getAttribute('data-code');
        const friend = this.friends.find(f => (f.userCode === code || f.pin === code));
        if (this.onOpenChat) this.onOpenChat(friend || this.friends[0]);
      });
    });

    // Card Actions: Wakeup Push Ring / Bulana
    document.querySelectorAll('.btn-dock-ping').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetPin = btn.getAttribute('data-pin');
        const name = btn.getAttribute('data-name');
        
        notificationEngine.playPingRing();
        notificationEngine.showToast('🔔 Wakeup Push Sent', `${name} ke phone par background Push Ring bhej diya gaya!`, 'bell-ring');
        
        if (this.socket) {
          this.socket.emit('send-partner-ping', {
            targetPin,
            fromUserName: this.myProfile.name || this.session.userName
          });
        }
      });
    });

    // Card Actions: Voice Call
    document.querySelectorAll('.btn-dock-voice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onStartCall) this.onStartCall(false);
      });
    });

    // Card Actions: Video Call
    document.querySelectorAll('.btn-dock-video').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onStartCall) this.onStartCall(true);
      });
    });

    // Card Actions: Delete Friend
    document.querySelectorAll('.btn-dock-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-code');
        if (confirm('Kya aap is partner ko remove karna chahte hain?')) {
          ephemeralStorage.removeFriend(code);
          this.friends = ephemeralStorage.getFriendsList();
          this.render();
        }
      });
    });
  }

  showAddFriendModal() {
    const modalContainer = document.getElementById('add-friend-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="add-friend-backdrop">
        <div class="modal-dialog-card glass-card" style="max-width: 360px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-family: var(--font-display); font-size: 1.15rem; color: #fff;">Add Friend / Send Req</h3>
            <button id="btn-close-add-friend" class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.75rem;">
              <i data-lucide="x"></i>
            </button>
          </div>

          <form id="form-send-friend-request" style="display: flex; flex-direction: column; gap: 12px; margin-top: 6px;">
            <div>
              <label style="display: block; font-size: 0.74rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">
                Partner's Name
              </label>
              <input type="text" id="input-friend-name" required placeholder="e.g. Priya" class="chat-input-field" style="width: 100%; border-radius: var(--radius-md);" />
            </div>

            <div>
              <label style="display: block; font-size: 0.74rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase;">
                Partner's Secret PIN
              </label>
              <input type="text" id="input-friend-pin" required placeholder="e.g. 7890" class="chat-input-field" style="width: 100%; border-radius: var(--radius-md); font-family: var(--font-mono); color: var(--accent-cyan); text-align: center; font-size: 1.1rem; font-weight: 700;" />
            </div>

            <div style="background: rgba(0, 245, 212, 0.08); border: 1px dashed rgba(0, 245, 212, 0.3); padding: 8px 10px; border-radius: var(--radius-sm); font-size: 0.72rem; color: var(--text-secondary); line-height: 1.4;">
              ✨ Request bhejte hi partner ke phone par Push Alert chala jayega aur wo aapse connect ho jayenge!
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 10px; border-radius: var(--radius-md);">
              <i data-lucide="send"></i> Send Join Request
            </button>
          </form>
        </div>
      </div>
    `;

    renderIcons();

    document.getElementById('btn-close-add-friend')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('form-send-friend-request')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const friendName = document.getElementById('input-friend-name').value.trim();
      const friendPin = document.getElementById('input-friend-pin').value.trim().toUpperCase();

      if (!friendName || !friendPin) return;

      ephemeralStorage.saveFriend({
        userName: friendName,
        userCode: `PIN-${friendPin}`,
        pin: friendPin,
        isOnline: false,
        lastMessage: 'Join request sent...'
      });

      if (this.socket) {
        this.socket.emit('send-friend-request', {
          toPin: friendPin,
          fromUserName: this.myProfile.name || this.session.userName,
          fromPin: this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '')
        });
      }

      notificationEngine.showToast('Request Sent', `${friendName} (PIN: ${friendPin}) ko Push Join Request bhej di gayi!`, 'send');
      modalContainer.innerHTML = '';
      this.friends = ephemeralStorage.getFriendsList();
      this.render();
    });
  }
}
