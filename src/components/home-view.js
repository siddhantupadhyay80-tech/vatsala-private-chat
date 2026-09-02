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

    // Auto-create default paired partner card for the current PIN space
    if (this.friends.length === 0) {
      this.friends = ephemeralStorage.saveFriend({
        userName: 'Partner',
        userCode: `PIN-${pin}`,
        pin: pin,
        isOnline: false,
        lastMessage: 'Tap to start encrypted chat & calls ❤️'
      });
    }

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

  getInviteLink() {
    const pin = this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '');
    const origin = window.location.origin;
    return `${origin}/?pin=${pin}`;
  }

  render() {
    if (!this.container) return;

    const pin = this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '');
    const inviteLink = this.getInviteLink();
    const isNotifGranted = 'Notification' in window && Notification.permission === 'granted';

    const filteredFriends = this.friends.filter(f => 
      !this.searchQuery || 
      (f.userName && f.userName.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
      (f.userCode && f.userCode.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
      (f.pin && f.pin.toLowerCase().includes(this.searchQuery.toLowerCase()))
    );

    this.container.innerHTML = `
      <div class="friends-hub-home">
        <!-- Top Profile & Actions Header -->
        <header class="hub-header glass-card">
          <div class="hub-user-pill" id="btn-open-my-profile" title="Edit Profile">
            <div class="hub-avatar-orb">
              ${this.myProfile.avatarUrl ? `
                <img src="${this.myProfile.avatarUrl}" alt="Avatar" class="hub-avatar-img" />
              ` : `
                ${(this.myProfile.name || 'U').charAt(0).toUpperCase()}
              `}
            </div>
            <div class="hub-user-meta">
              <span class="hub-user-name">${this.myProfile.name || this.session.userName}</span>
              <span class="hub-user-bio-preview">PIN: <strong>${pin}</strong></span>
            </div>
          </div>

          <div class="hub-header-actions">
            ${!isNotifGranted ? `
              <button id="btn-enable-notif" class="btn-hub-icon notif-alert" title="Turn ON Background Notifications">
                <i data-lucide="bell-ring"></i>
              </button>
            ` : ''}
            
            <button id="btn-profile-gear" class="btn-hub-icon" title="Edit Profile">
              <i data-lucide="user"></i>
            </button>
          </div>
        </header>

        <!-- 1-TAP INSTANT CONNECT BANNER (Simplest Way to Connect Partner) -->
        <div style="padding: 10px 10px 0 10px;">
          <div class="glass-card" style="padding: 12px; border-radius: var(--radius-md); background: linear-gradient(135deg, rgba(255, 51, 102, 0.15), rgba(138, 43, 226, 0.15)); border: 1px solid rgba(255, 51, 102, 0.35);">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div>
                <div style="font-weight: 700; font-size: 0.88rem; color: #fff; display: flex; align-items: center; gap: 6px;">
                  <span>🔗 Connect Partner (1-Tap Link)</span>
                </div>
                <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px;">
                  Ye link partner ko bhejein, wo 1 click me jud jayenge!
                </div>
              </div>
              <button id="btn-share-invite-link" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.78rem; border-radius: var(--radius-full); white-space: nowrap;">
                <i data-lucide="share-2"></i> Share Link
              </button>
            </div>
          </div>
        </div>

        <!-- Scrollable Body -->
        <div class="hub-body-scroll" style="padding-top: 10px;">
          <!-- Quick Inline Add Partner Box -->
          <div style="margin-bottom: 12px;">
            <form id="form-quick-add-partner" class="glass-card" style="padding: 10px; border-radius: var(--radius-md); display: flex; gap: 6px; align-items: center;">
              <input type="text" id="input-quick-partner-name" placeholder="Partner Name (e.g. Priya)" required class="chat-input-field" style="font-size: 0.82rem; padding: 6px 10px;" />
              <input type="text" id="input-quick-partner-pin" placeholder="PIN (e.g. ${pin})" value="${pin}" required class="chat-input-field" style="font-size: 0.82rem; width: 90px; text-align: center; font-family: var(--font-mono); color: var(--accent-cyan);" />
              <button type="submit" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.78rem; white-space: nowrap; border-radius: var(--radius-md);">
                <i data-lucide="user-plus"></i> Add
              </button>
            </form>
          </div>

          <!-- Pending Requests Section -->
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

          <!-- Connected Partners List -->
          <div class="hub-section-title">
            <i data-lucide="heart" style="width: 14px; height: 14px; color: var(--accent-rose);"></i>
            <span>Your Connected Space (${this.friends.length})</span>
          </div>

          <div class="hub-friends-list">
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

                <!-- Action Buttons on each Card -->
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
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    renderIcons();
    this.attachEvents();
  }

  attachEvents() {
    // 1-Tap Share Invite Link
    const btnShare = document.getElementById('btn-share-invite-link');
    if (btnShare) {
      btnShare.addEventListener('click', async () => {
        const inviteLink = this.getInviteLink();
        const shareText = `Hey! Join our private encrypted space on Vatsala:\n${inviteLink}`;

        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Vatsala Private Couple Space',
              text: shareText,
              url: inviteLink
            });
            return;
          } catch (e) {}
        }

        // Fallback to Clipboard
        navigator.clipboard.writeText(inviteLink);
        confetti({ particleCount: 50, spread: 60 });
        notificationEngine.showToast('Link Copied!', '1-Tap Connect Link clipboard par copy ho gaya! Partner ko WhatsApp/SMS par bhej dijiye.', 'check');
      });
    }

    // Quick Add Partner Form
    const formQuickAdd = document.getElementById('form-quick-add-partner');
    if (formQuickAdd) {
      formQuickAdd.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('input-quick-partner-name');
        const pinInput = document.getElementById('input-quick-partner-pin');

        const name = nameInput ? nameInput.value.trim() : '';
        const friendPin = pinInput ? pinInput.value.trim().toUpperCase() : '';

        if (!name || !friendPin) return;

        this.friends = ephemeralStorage.saveFriend({
          userName: name,
          userCode: `PIN-${friendPin}`,
          pin: friendPin,
          isOnline: false,
          lastMessage: 'Tap to start chat ❤️'
        });

        if (this.socket) {
          this.socket.emit('send-friend-request', {
            toPin: friendPin,
            fromUserName: this.myProfile.name || this.session.userName,
            fromPin: this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '')
          });
        }

        confetti({ particleCount: 60, spread: 60 });
        notificationEngine.showToast('Partner Added!', `${name} connect ho gaye! Chat open karein.`, 'user-check');

        if (nameInput) nameInput.value = '';
        this.render();
      });
    }

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

    // Permission Alert & Auto-Subscribe
    document.getElementById('btn-enable-notif')?.addEventListener('click', async () => {
      const pin = this.myProfile.pin || this.session.pin || this.session.spaceId.replace('PIN-', '');
      const granted = await notificationEngine.requestPermission(pin);
      if (granted) this.render();
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

    // Card Actions: Wakeup Push Ring
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
  }
}
