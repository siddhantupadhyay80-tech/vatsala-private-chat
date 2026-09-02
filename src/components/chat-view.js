import { cryptoEngine } from '../security/crypto.js';
import { ephemeralStorage } from '../security/storage.js';
import { renderIcons } from '../utils/icons.js';
import { notificationEngine } from '../utils/notifications.js';
import confetti from 'canvas-confetti';

export class ChatView {
  constructor(socket, userSession, activePartner, onBackToHome, onSendHeart, onStartCall) {
    this.socket = socket;
    this.session = userSession;
    this.partner = activePartner || { userName: 'Partner', userCode: userSession.spaceId, isOnline: true };
    this.onBackToHome = onBackToHome;
    this.onSendHeart = onSendHeart;
    this.onStartCall = onStartCall;

    this.container = document.getElementById('chat-component-mount');
    this.disappearingTimer = '0';
    this.renderedMessageIds = new Set();
    this.activeMenuMessageId = null;

    // Voice recording state
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;

    // Media preview dialog state
    this.pendingFile = null;
    this.isPendingViewOnce = false;

    this.cleanupSocketListeners();
    this.render();
    this.loadChatHistory();
    this.initSocketListeners();
  }

  cleanupSocketListeners() {
    if (this.socket) {
      this.socket.off('receive-encrypted-message');
      this.socket.off('partner-typing');
      this.socket.off('message-deleted');
      this.socket.off('chat-cleared');
    }
  }

  setPartnerStatus(isOnline) {
    this.partner.isOnline = isOnline;
    const dot = document.getElementById('chat-partner-dot');
    const statusText = document.getElementById('chat-partner-status-text');
    if (dot) dot.className = `presence-dot ${isOnline ? 'online' : 'offline'}`;
    if (statusText) statusText.textContent = isOnline ? 'Online' : 'Offline';
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="chat-container glass-card">
        <!-- WhatsApp-Style Top Header -->
        <div class="chat-header-bar">
          <div style="display: flex; align-items: center; gap: 8px;">
            <!-- Back Button -->
            <button id="btn-back-home" class="btn-chat-back" title="Back to Homepage">
              <i data-lucide="arrow-left"></i>
            </button>

            <!-- Partner Avatar & Status -->
            <div class="chat-partner-head">
              <div class="chat-partner-avatar">
                ${(this.partner.userName || 'P').charAt(0).toUpperCase()}
              </div>
              <div style="display: flex; flex-direction: column;">
                <span class="chat-partner-title">${this.partner.userName || 'Partner'}</span>
                <div class="chat-partner-presence">
                  <span class="presence-dot ${this.partner.isOnline ? 'online' : 'offline'}" id="chat-partner-dot"></span>
                  <span id="chat-partner-status-text" style="font-size: 0.66rem; color: var(--text-muted);">${this.partner.isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Actions -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <button id="btn-chat-voice-call" class="btn-icon-action btn-call" title="Voice Call">
              <i data-lucide="phone"></i>
            </button>
            <button id="btn-chat-video-call" class="btn-icon-action btn-video" title="Video Call">
              <i data-lucide="video"></i>
            </button>
            <button id="btn-chat-ping" class="btn-icon-action" title="Wakeup Ring">
              <i data-lucide="bell" style="color: var(--accent-cyan);"></i>
            </button>

            <!-- Chat Options 3-Dot Menu -->
            <div class="chat-header-dropdown-wrap" style="position: relative;">
              <button id="btn-chat-options" class="btn-icon-action" title="Chat Options">
                <i data-lucide="more-vertical"></i>
              </button>
              <div id="chat-options-menu" class="chat-options-dropdown hidden glass-card">
                <button id="btn-opt-clear-chat" class="chat-dropdown-item text-danger">
                  <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Clear All Chat
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Messages Feed (Scrollable WhatsApp Style) -->
        <div class="chat-messages-feed" id="chat-messages-feed">
          <div class="system-notice">
            <i data-lucide="lock" style="width: 13px; height: 13px; color: var(--accent-cyan);"></i>
            <span>Messages are end-to-end encrypted. Tap any message to Resend, Copy, or Delete.</span>
          </div>
        </div>

        <!-- Typing Indicator -->
        <div id="typing-indicator" class="typing-indicator hidden">
          Partner is typing...
        </div>

        <!-- WhatsApp-Style Chat Input Bar -->
        <div class="chat-input-bar">
          <!-- Attachment Button -->
          <label for="chat-file-input" class="btn-input-action" title="Send Photo or Video">
            <i data-lucide="paperclip"></i>
          </label>
          <input type="file" id="chat-file-input" accept="image/*,video/*" style="display: none;" />

          <!-- Voice Note Button -->
          <button id="btn-voice-record" class="btn-input-action" title="Hold/Tap to Record Voice Note">
            <i data-lucide="mic" id="icon-mic"></i>
          </button>
          
          <!-- Text Input -->
          <input type="text" id="chat-text-input" class="chat-input-field" placeholder="Type a message..." autocomplete="off" />

          <!-- Send Heart Impulse -->
          <button id="btn-chat-send-heart" class="btn-input-action btn-heart-chat" title="Send Love Explosion">
            <i data-lucide="heart"></i>
          </button>

          <!-- Send Message Button -->
          <button id="btn-chat-send" class="chat-btn-send" title="Send">
            <i data-lucide="send" style="width: 15px; height: 15px;"></i>
          </button>
        </div>
      </div>

      <!-- WhatsApp Media Preview Modal -->
      <div id="media-send-modal-container"></div>
    `;

    renderIcons();
    this.attachEvents();
  }

  async loadChatHistory() {
    const spaceId = this.session.spaceId;
    const history = ephemeralStorage.getChatHistory(spaceId);

    for (const item of history) {
      if (item.type === 'text') {
        this.appendMessage(item, item.text || '', item.senderId === this.session.userId, false);
      } else if (item.type === 'voice') {
        this.appendVoiceMessage(item, item.mediaBase64 || '', item.senderId === this.session.userId, false);
      } else if (item.type === 'image' || item.type === 'video') {
        this.appendMediaMessage(item, item.mediaBase64 || '', item.senderId === this.session.userId, false);
      }
    }
  }

  attachEvents() {
    const textInput = document.getElementById('chat-text-input');
    const btnSend = document.getElementById('btn-chat-send');
    const btnVoice = document.getElementById('btn-voice-record');
    const btnHeart = document.getElementById('btn-chat-send-heart');
    const fileInput = document.getElementById('chat-file-input');
    const btnBack = document.getElementById('btn-back-home');
    const btnVoiceCall = document.getElementById('btn-chat-voice-call');
    const btnVideoCall = document.getElementById('btn-chat-video-call');
    const btnPing = document.getElementById('btn-chat-ping');
    const btnOptions = document.getElementById('btn-chat-options');
    const optionsMenu = document.getElementById('chat-options-menu');
    const btnClearChat = document.getElementById('btn-opt-clear-chat');

    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this.cleanupSocketListeners();
        if (this.onBackToHome) this.onBackToHome();
      });
    }

    if (btnOptions && optionsMenu) {
      btnOptions.addEventListener('click', (e) => {
        e.stopPropagation();
        optionsMenu.classList.toggle('hidden');
      });
      document.addEventListener('click', () => {
        optionsMenu.classList.add('hidden');
        this.closeAllMessageMenus();
      });
    }

    if (btnClearChat) {
      btnClearChat.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all chat messages?')) {
          ephemeralStorage.clearChatHistory(this.session.spaceId);
          const feed = document.getElementById('chat-messages-feed');
          if (feed) {
            feed.innerHTML = `
              <div class="system-notice">
                <i data-lucide="lock" style="width: 13px; height: 13px; color: var(--accent-cyan);"></i>
                <span>Chat cleared. Messages are end-to-end encrypted.</span>
              </div>
            `;
            renderIcons();
          }
          this.renderedMessageIds.clear();
          if (this.socket) {
            this.socket.emit('clear-chat', { spaceId: this.session.spaceId });
          }
        }
      });
    }

    if (btnVoiceCall) {
      btnVoiceCall.addEventListener('click', () => {
        if (this.onStartCall) this.onStartCall(false);
      });
    }

    if (btnVideoCall) {
      btnVideoCall.addEventListener('click', () => {
        if (this.onStartCall) this.onStartCall(true);
      });
    }

    if (btnPing) {
      btnPing.addEventListener('click', () => {
        notificationEngine.playPingRing();
        notificationEngine.showToast('🔔 Wakeup Ring Sent', `Partner ke phone par sound & alert bhej diya gaya!`, 'send');
        if (this.socket) {
          this.socket.emit('send-partner-ping', { fromUserName: this.session.userName });
        }
      });
    }

    if (btnSend && textInput) {
      btnSend.addEventListener('click', () => this.handleSendMessage());
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleSendMessage();
        } else {
          this.notifyTyping();
        }
      });
    }

    if (btnHeart) {
      btnHeart.addEventListener('click', () => {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.85 },
          colors: ['#ff3366', '#ff758c', '#8a2be2', '#00f5d4']
        });
        if (this.onSendHeart) this.onSendHeart();
      });
    }

    if (btnVoice) {
      btnVoice.addEventListener('click', () => this.toggleVoiceRecording());
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        this.showMediaSendPreview(file);
        fileInput.value = '';
      });
    }
  }

  showMediaSendPreview(file) {
    const modalContainer = document.getElementById('media-send-modal-container');
    if (!modalContainer) return;

    this.pendingFile = file;
    this.isPendingViewOnce = false;

    const previewUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video');

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="send-preview-backdrop">
        <div class="media-send-dialog glass-card">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px;">
            <span style="font-size: 0.85rem; font-weight: 600; color: #fff;">Send Encrypted Media</span>
            <button id="btn-cancel-media-send" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.78rem;">
              <i data-lucide="x"></i> Cancel
            </button>
          </div>

          <div class="media-send-preview-box">
            ${isVideo ? `
              <video src="${previewUrl}" controls class="media-send-preview-img"></video>
            ` : `
              <img src="${previewUrl}" alt="Preview" class="media-send-preview-img" />
            `}
          </div>

          <div class="media-send-controls">
            <input type="text" id="input-media-caption" class="chat-input-field" placeholder="Add a caption..." autocomplete="off" />
            
            <button type="button" id="btn-toggle-view-once" class="btn-view-once-toggle" title="View Once (Auto-destructs)">
              <span class="view-once-badge-num">1</span>
            </button>

            <button type="button" id="btn-confirm-send-media" class="chat-btn-send" title="Send">
              <i data-lucide="send" style="width: 16px; height: 16px;"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    renderIcons();

    const btnCancel = document.getElementById('btn-cancel-media-send');
    const btnConfirm = document.getElementById('btn-confirm-send-media');
    const btnToggleViewOnce = document.getElementById('btn-toggle-view-once');
    const captionInput = document.getElementById('input-media-caption');

    if (btnToggleViewOnce) {
      btnToggleViewOnce.addEventListener('click', () => {
        this.isPendingViewOnce = !this.isPendingViewOnce;
        btnToggleViewOnce.classList.toggle('active', this.isPendingViewOnce);
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        modalContainer.innerHTML = '';
        URL.revokeObjectURL(previewUrl);
        this.pendingFile = null;
      });
    }

    if (btnConfirm) {
      btnConfirm.addEventListener('click', async () => {
        const caption = captionInput ? captionInput.value.trim() : '';
        modalContainer.innerHTML = '';
        await this.handleSendEncryptedMedia(file, this.isPendingViewOnce, caption);
        URL.revokeObjectURL(previewUrl);
        this.pendingFile = null;
      });
    }
  }

  notifyTyping() {
    if (this.socket) {
      this.socket.emit('typing-status', {
        userId: this.session.userId,
        userName: this.session.userName
      });
    }
  }

  async handleSendMessage(resendText = null) {
    let text = resendText;
    if (!text) {
      const input = document.getElementById('chat-text-input');
      if (!input) return;
      text = input.value.trim();
      if (!text) return;
      input.value = '';
    }

    try {
      const encrypted = await cryptoEngine.encryptText(text);

      const messagePayload = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'text',
        text,
        encryptedPayload: encrypted,
        senderId: this.session.userId,
        senderName: this.session.userName,
        timestamp: Date.now()
      };

      // Save to persistent storage
      ephemeralStorage.saveChatMessage(this.session.spaceId, messagePayload);

      // Append locally
      this.appendMessage(messagePayload, text, true, true);

      ephemeralStorage.saveFriend({
        userCode: this.partner.userCode || this.session.spaceId,
        userName: this.partner.userName,
        lastMessage: text
      });

      if (this.socket) {
        this.socket.emit('send-encrypted-message', messagePayload);
      }
    } catch (err) {
      console.error('Failed to encrypt message:', err);
    }
  }

  async handleSendEncryptedMedia(file, isViewOnce = false, caption = '') {
    try {
      const encrypted = await cryptoEngine.encryptBinary(file);

      // Convert file to base64 for persistent storage if not view-once
      let mediaBase64 = null;
      if (!isViewOnce) {
        mediaBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      }

      const mediaPayload = {
        id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: file.type.startsWith('video') ? 'video' : 'image',
        isViewOnce,
        caption,
        title: file.name,
        encryptedPayload: encrypted,
        mediaBase64,
        senderId: this.session.userId,
        senderName: this.session.userName,
        timestamp: Date.now(),
        viewed: false
      };

      if (!isViewOnce) {
        ephemeralStorage.saveChatMessage(this.session.spaceId, mediaPayload);
      }

      this.appendMediaMessage(mediaPayload, mediaBase64, true, true);

      ephemeralStorage.saveFriend({
        userCode: this.partner.userCode || this.session.spaceId,
        userName: this.partner.userName,
        lastMessage: isViewOnce ? '🔥 View-Once Photo' : (mediaPayload.type === 'video' ? '🎥 Video' : '📷 Photo')
      });

      if (this.socket) {
        this.socket.emit('send-encrypted-message', {
          id: mediaPayload.id,
          type: mediaPayload.type,
          isViewOnce: mediaPayload.isViewOnce,
          caption: mediaPayload.caption,
          title: mediaPayload.title,
          encryptedPayload: encrypted,
          senderId: mediaPayload.senderId,
          senderName: mediaPayload.senderName,
          timestamp: mediaPayload.timestamp
        });
      }
    } catch (err) {
      console.error('Failed to encrypt media:', err);
      alert('Photo/Video encryption failed.');
    }
  }

  async toggleVoiceRecording() {
    const btnVoice = document.getElementById('btn-voice-record');

    if (!this.isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.audioChunks.push(e.data);
        };

        this.mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          await this.sendEncryptedVoiceNote(audioBlob);
          stream.getTracks().forEach((t) => t.stop());
        };

        this.mediaRecorder.start();
        this.isRecording = true;
        btnVoice.style.background = 'var(--accent-red)';
        btnVoice.style.color = '#fff';
      } catch (err) {
        alert('Microphone permission required for voice notes.');
      }
    } else {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.isRecording = false;
      btnVoice.style.background = '';
      btnVoice.style.color = '';
    }
  }

  async sendEncryptedVoiceNote(audioBlob) {
    try {
      const encrypted = await cryptoEngine.encryptBinary(audioBlob);

      const audioBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(audioBlob);
      });

      const messagePayload = {
        id: `voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'voice',
        encryptedPayload: encrypted,
        mediaBase64: audioBase64,
        senderId: this.session.userId,
        senderName: this.session.userName,
        timestamp: Date.now()
      };

      ephemeralStorage.saveChatMessage(this.session.spaceId, messagePayload);

      this.appendVoiceMessage(messagePayload, audioBase64, true, true);

      if (this.socket) {
        this.socket.emit('send-encrypted-message', messagePayload);
      }
    } catch (err) {
      console.error('Failed to encrypt voice note:', err);
    }
  }

  initSocketListeners() {
    if (!this.socket) return;

    this.socket.on('receive-encrypted-message', async (payload) => {
      if (this.renderedMessageIds.has(payload.id)) return;

      try {
        notificationEngine.playChimeTone();

        if (payload.type === 'text') {
          const plainText = await cryptoEngine.decryptText(payload.encryptedPayload);
          payload.text = plainText;
          ephemeralStorage.saveChatMessage(this.session.spaceId, payload);
          this.appendMessage(payload, plainText, false, true);
        } else if (payload.type === 'voice') {
          const decryptedBlob = await cryptoEngine.decryptBinary(payload.encryptedPayload);
          const audioBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(decryptedBlob);
          });
          payload.mediaBase64 = audioBase64;
          ephemeralStorage.saveChatMessage(this.session.spaceId, payload);
          this.appendVoiceMessage(payload, audioBase64, false, true);
        } else if (payload.type === 'image' || payload.type === 'video') {
          if (!payload.isViewOnce) {
            const decryptedBlob = await cryptoEngine.decryptBinary(payload.encryptedPayload);
            const mediaBase64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(decryptedBlob);
            });
            payload.mediaBase64 = mediaBase64;
            ephemeralStorage.saveChatMessage(this.session.spaceId, payload);
            this.appendMediaMessage(payload, mediaBase64, false, true);
          } else {
            this.appendMediaMessage(payload, null, false, true);
          }
        }
      } catch (err) {
        console.error('Failed to decrypt incoming payload:', err);
      }
    });

    this.socket.on('message-deleted', ({ messageId, forEveryone }) => {
      if (forEveryone) {
        ephemeralStorage.deleteChatMessage(this.session.spaceId, messageId, true);
        const row = document.getElementById(messageId);
        if (row) {
          const bubble = row.querySelector('.message-bubble');
          if (bubble) {
            bubble.innerHTML = `
              <div style="color: var(--text-muted); font-style: italic; font-size: 0.80rem; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="ban" style="width: 13px; height: 13px;"></i> This message was deleted
              </div>
            `;
            renderIcons();
          }
        }
      }
    });

    this.socket.on('chat-cleared', () => {
      ephemeralStorage.clearChatHistory(this.session.spaceId);
      const feed = document.getElementById('chat-messages-feed');
      if (feed) {
        feed.innerHTML = `
          <div class="system-notice">
            <i data-lucide="lock" style="width: 13px; height: 13px; color: var(--accent-cyan);"></i>
            <span>Partner cleared the chat history.</span>
          </div>
        `;
        renderIcons();
      }
      this.renderedMessageIds.clear();
    });

    let typingTimeout = null;
    this.socket.on('partner-typing', () => {
      const indicator = document.getElementById('typing-indicator');
      if (indicator) {
        indicator.classList.remove('hidden');
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          indicator.classList.add('hidden');
        }, 2000);
      }
    });
  }

  appendMessage(payload, text, isSelf, shouldScroll = true) {
    if (this.renderedMessageIds.has(payload.id)) return;
    this.renderedMessageIds.add(payload.id);

    const feed = document.getElementById('chat-messages-feed');
    if (!feed) return;

    const row = document.createElement('div');
    row.className = `message-bubble-row ${isSelf ? 'sent' : 'received'}`;
    row.id = payload.id;

    const timeStr = new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isDeleted = Boolean(payload.deletedForEveryone);

    row.innerHTML = `
      <div class="message-author-tag">${isSelf ? 'You' : payload.senderName}</div>
      <div class="message-bubble-wrapper">
        <div class="message-bubble ${isDeleted ? 'message-deleted-bubble' : ''}">
          ${isDeleted ? `
            <div style="color: var(--text-muted); font-style: italic; font-size: 0.80rem; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="ban" style="width: 13px; height: 13px;"></i> This message was deleted
            </div>
          ` : `
            <div class="message-text-content">${this.escapeHtml(text)}</div>
          `}
          <div class="message-meta">
            <span>${timeStr}</span>
            ${isSelf ? '<i data-lucide="check-check" style="width: 11px; height: 11px; color: var(--accent-cyan);"></i>' : ''}
          </div>
        </div>

        ${!isDeleted ? `
          <!-- WhatsApp-Style Message Actions Trigger -->
          <button class="btn-msg-action-trigger" data-id="${payload.id}" title="Message options">
            <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
          </button>
        ` : ''}
      </div>

      <!-- Action Context Popover -->
      <div class="msg-context-menu hidden glass-card" id="menu-${payload.id}">
        <button class="msg-menu-item btn-msg-copy" data-text="${this.escapeHtml(text)}">
          <i data-lucide="copy" style="width: 13px; height: 13px;"></i> Copy
        </button>
        <button class="msg-menu-item btn-msg-resend" data-text="${this.escapeHtml(text)}">
          <i data-lucide="rotate-cw" style="width: 13px; height: 13px;"></i> Resend
        </button>
        <button class="msg-menu-item btn-msg-del-me" data-id="${payload.id}">
          <i data-lucide="trash" style="width: 13px; height: 13px;"></i> Delete for me
        </button>
        ${isSelf ? `
          <button class="msg-menu-item text-danger btn-msg-del-all" data-id="${payload.id}">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete for everyone
          </button>
        ` : ''}
      </div>
    `;

    feed.appendChild(row);
    if (shouldScroll) feed.scrollTop = feed.scrollHeight;

    renderIcons();
    this.attachMessageActionEvents(row, payload);
  }

  appendMediaMessage(payload, mediaUrl, isSelf, shouldScroll = true) {
    if (this.renderedMessageIds.has(payload.id)) return;
    this.renderedMessageIds.add(payload.id);

    const feed = document.getElementById('chat-messages-feed');
    if (!feed) return;

    const row = document.createElement('div');
    row.className = `message-bubble-row ${isSelf ? 'sent' : 'received'}`;
    row.id = payload.id;

    const timeStr = new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isDeleted = Boolean(payload.deletedForEveryone);

    let mediaContent = '';
    if (isDeleted) {
      mediaContent = `
        <div style="color: var(--text-muted); font-style: italic; font-size: 0.80rem; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="ban" style="width: 13px; height: 13px;"></i> This media was deleted
        </div>
      `;
    } else if (payload.isViewOnce && !mediaUrl) {
      mediaContent = `
        <div class="whatsapp-view-once-card" id="btn-open-${payload.id}">
          <div class="view-once-icon-ring">
            <span>1</span>
          </div>
          <div style="flex:1;">
            <div style="font-weight: 600; font-size: 0.85rem; color: #fff;">${payload.type === 'video' ? 'Video' : 'Photo'}</div>
            <div style="font-size: 0.70rem; color: var(--text-muted);">Tap to view once (10s)</div>
          </div>
        </div>
      `;
    } else if (mediaUrl) {
      if (payload.type === 'video') {
        mediaContent = `
          <div class="whatsapp-media-card">
            <video src="${mediaUrl}" class="whatsapp-inline-media" controls></video>
            ${payload.caption ? `<div class="whatsapp-media-caption">${this.escapeHtml(payload.caption)}</div>` : ''}
          </div>
        `;
      } else {
        mediaContent = `
          <div class="whatsapp-media-card">
            <img src="${mediaUrl}" alt="Photo" class="whatsapp-inline-media" id="img-${payload.id}" />
            ${payload.caption ? `<div class="whatsapp-media-caption">${this.escapeHtml(payload.caption)}</div>` : ''}
          </div>
        `;
      }
    }

    row.innerHTML = `
      <div class="message-author-tag">${isSelf ? 'You' : payload.senderName}</div>
      <div class="message-bubble-wrapper">
        <div class="message-bubble whatsapp-bubble ${isDeleted ? 'message-deleted-bubble' : ''}">
          ${mediaContent}
          <div class="message-meta">
            ${payload.isViewOnce ? '<span style="color: var(--accent-amber); font-size: 0.65rem; margin-right: 2px;">① View Once</span>' : ''}
            <span>${timeStr}</span>
            ${isSelf ? '<i data-lucide="check-check" style="width: 11px; height: 11px; color: var(--accent-cyan);"></i>' : ''}
          </div>
        </div>

        ${!isDeleted ? `
          <button class="btn-msg-action-trigger" data-id="${payload.id}" title="Options">
            <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
          </button>
        ` : ''}
      </div>

      <!-- Action Context Popover -->
      <div class="msg-context-menu hidden glass-card" id="menu-${payload.id}">
        <button class="msg-menu-item btn-msg-del-me" data-id="${payload.id}">
          <i data-lucide="trash" style="width: 13px; height: 13px;"></i> Delete for me
        </button>
        ${isSelf ? `
          <button class="msg-menu-item text-danger btn-msg-del-all" data-id="${payload.id}">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete for everyone
          </button>
        ` : ''}
      </div>
    `;

    feed.appendChild(row);
    if (shouldScroll) feed.scrollTop = feed.scrollHeight;

    renderIcons();

    const openCard = document.getElementById(`btn-open-${payload.id}`);
    if (openCard) {
      openCard.addEventListener('click', async () => {
        try {
          const decryptedBlob = await cryptoEngine.decryptBinary(payload.encryptedPayload);
          const activeUrl = ephemeralStorage.createManagedBlobUrl(decryptedBlob);
          this.openFullScreenViewer(payload, activeUrl, row);
        } catch (err) {
          alert('Decryption failed.');
        }
      });
    }

    const imgPreview = document.getElementById(`img-${payload.id}`);
    if (imgPreview && mediaUrl) {
      imgPreview.addEventListener('click', () => {
        this.openFullScreenViewer(payload, mediaUrl, row);
      });
    }

    this.attachMessageActionEvents(row, payload);
  }

  appendVoiceMessage(payload, audioUrl, isSelf, shouldScroll = true) {
    if (this.renderedMessageIds.has(payload.id)) return;
    this.renderedMessageIds.add(payload.id);

    const feed = document.getElementById('chat-messages-feed');
    if (!feed) return;

    const row = document.createElement('div');
    row.className = `message-bubble-row ${isSelf ? 'sent' : 'received'}`;
    row.id = payload.id;

    const timeStr = new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isDeleted = Boolean(payload.deletedForEveryone);

    row.innerHTML = `
      <div class="message-author-tag">${isSelf ? 'You' : payload.senderName}</div>
      <div class="message-bubble-wrapper">
        <div class="message-bubble ${isDeleted ? 'message-deleted-bubble' : ''}">
          ${isDeleted ? `
            <div style="color: var(--text-muted); font-style: italic; font-size: 0.80rem; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="ban" style="width: 13px; height: 13px;"></i> This audio was deleted
            </div>
          ` : `
            <div class="voice-bubble">
              <button class="voice-play-btn" id="btn-play-${payload.id}">
                <i data-lucide="play" style="width: 15px; height: 15px;"></i>
              </button>
              <div style="flex:1; font-size:0.78rem; color: #fff;">
                🎵 Voice Note
              </div>
              <audio id="audio-${payload.id}" src="${audioUrl}"></audio>
            </div>
          `}
          <div class="message-meta">
            <span>${timeStr}</span>
            ${isSelf ? '<i data-lucide="check-check" style="width: 11px; height: 11px; color: var(--accent-cyan);"></i>' : ''}
          </div>
        </div>

        ${!isDeleted ? `
          <button class="btn-msg-action-trigger" data-id="${payload.id}" title="Options">
            <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
          </button>
        ` : ''}
      </div>

      <!-- Action Context Popover -->
      <div class="msg-context-menu hidden glass-card" id="menu-${payload.id}">
        <button class="msg-menu-item btn-msg-del-me" data-id="${payload.id}">
          <i data-lucide="trash" style="width: 13px; height: 13px;"></i> Delete for me
        </button>
        ${isSelf ? `
          <button class="msg-menu-item text-danger btn-msg-del-all" data-id="${payload.id}">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Delete for everyone
          </button>
        ` : ''}
      </div>
    `;

    feed.appendChild(row);
    if (shouldScroll) feed.scrollTop = feed.scrollHeight;

    renderIcons();

    const playBtn = document.getElementById(`btn-play-${payload.id}`);
    const audioEl = document.getElementById(`audio-${payload.id}`);

    if (playBtn && audioEl) {
      playBtn.addEventListener('click', () => {
        if (audioEl.paused) {
          audioEl.play();
          playBtn.innerHTML = '<i data-lucide="pause" style="width: 15px; height: 15px;"></i>';
        } else {
          audioEl.pause();
          playBtn.innerHTML = '<i data-lucide="play" style="width: 15px; height: 15px;"></i>';
        }
        renderIcons();
      });

      audioEl.addEventListener('ended', () => {
        playBtn.innerHTML = '<i data-lucide="play" style="width: 15px; height: 15px;"></i>';
        renderIcons();
      });
    }

    this.attachMessageActionEvents(row, payload);
  }

  attachMessageActionEvents(row, payload) {
    const trigger = row.querySelector('.btn-msg-action-trigger');
    const menu = row.querySelector(`#menu-${payload.id}`);

    if (trigger && menu) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeAllMessageMenus(payload.id);
        menu.classList.toggle('hidden');
      });
    }

    // Copy action
    const btnCopy = row.querySelector('.btn-msg-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', (e) => {
        e.stopPropagation();
        const textToCopy = btnCopy.getAttribute('data-text');
        navigator.clipboard.writeText(textToCopy);
        notificationEngine.showToast('Copied', 'Message copied to clipboard!', 'check');
        menu.classList.add('hidden');
      });
    }

    // Resend action
    const btnResend = row.querySelector('.btn-msg-resend');
    if (btnResend) {
      btnResend.addEventListener('click', (e) => {
        e.stopPropagation();
        const textToResend = btnResend.getAttribute('data-text');
        menu.classList.add('hidden');
        this.handleSendMessage(textToResend);
        notificationEngine.showToast('Resent', 'Message resent to partner!', 'send');
      });
    }

    // Delete for me
    const btnDelMe = row.querySelector('.btn-msg-del-me');
    if (btnDelMe) {
      btnDelMe.addEventListener('click', (e) => {
        e.stopPropagation();
        ephemeralStorage.deleteChatMessage(this.session.spaceId, payload.id, false);
        row.remove();
        this.renderedMessageIds.delete(payload.id);
      });
    }

    // Delete for everyone
    const btnDelAll = row.querySelector('.btn-msg-del-all');
    if (btnDelAll) {
      btnDelAll.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this message for everyone?')) {
          ephemeralStorage.deleteChatMessage(this.session.spaceId, payload.id, true);
          const bubble = row.querySelector('.message-bubble');
          if (bubble) {
            bubble.className = 'message-bubble message-deleted-bubble';
            bubble.innerHTML = `
              <div style="color: var(--text-muted); font-style: italic; font-size: 0.80rem; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="ban" style="width: 13px; height: 13px;"></i> You deleted this message
              </div>
            `;
            renderIcons();
          }
          if (trigger) trigger.remove();
          if (menu) menu.remove();

          if (this.socket) {
            this.socket.emit('delete-message', {
              messageId: payload.id,
              spaceId: this.session.spaceId,
              forEveryone: true
            });
          }
        }
      });
    }
  }

  closeAllMessageMenus(exceptId = null) {
    document.querySelectorAll('.msg-context-menu').forEach(m => {
      if (!exceptId || m.id !== `menu-${exceptId}`) {
        m.classList.add('hidden');
      }
    });
  }

  openFullScreenViewer(item, activeUrl, rowElement) {
    const viewerContainer = document.getElementById('media-viewer-container');
    if (!viewerContainer) return;

    let countdownSeconds = 10;
    let timerInterval = null;

    viewerContainer.innerHTML = `
      <div class="modal-backdrop" id="viewer-backdrop" style="background: rgba(4, 5, 8, 0.98);">
        <div style="position: relative; max-width: 96vw; max-height: 92dvh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          
          <div style="position: absolute; top: -42px; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; color: #fff;">
            <div style="font-size: 0.78rem; color: var(--accent-cyan);">
              🔒 ${item.title || 'Encrypted Media'}
            </div>
            ${item.isViewOnce ? `
              <div style="background: var(--accent-amber); color: #000; font-weight: bold; font-family: var(--font-mono); padding: 2px 10px; border-radius: var(--radius-full); font-size: 0.78rem;" id="view-once-countdown">
                ① Auto-destruct in ${countdownSeconds}s
              </div>
            ` : ''}
            <button id="btn-close-viewer" class="btn btn-secondary" style="padding: 3px 10px; font-size: 0.78rem;">
              <i data-lucide="x"></i> Close
            </button>
          </div>

          <div style="border-radius: var(--radius-md); overflow: hidden; max-height: 80dvh; max-width: 92vw; box-shadow: 0 0 40px rgba(0,0,0,0.9); border: 1px solid rgba(255,255,255,0.15);">
            ${item.type === 'video' ? `
              <video src="${activeUrl}" controls autoplay style="max-height: 75dvh; max-width: 92vw; display: block;"></video>
            ` : `
              <img src="${activeUrl}" alt="Media" style="max-height: 75dvh; max-width: 92vw; object-fit: contain; display: block;" />
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
        ephemeralStorage.revokeBlobUrl(activeUrl);
        if (rowElement) {
          rowElement.innerHTML = `
            <div class="message-author-tag">${item.senderName}</div>
            <div class="message-bubble" style="background: rgba(30,30,30,0.8); color: var(--text-muted); font-size: 0.75rem; font-style: italic; display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--text-muted); font-weight: bold;">①</span> Opened
            </div>
          `;
          renderIcons();
        }
      }
    };

    document.getElementById('btn-close-viewer')?.addEventListener('click', closeViewer);

    if (item.isViewOnce) {
      const countdownEl = document.getElementById('view-once-countdown');
      timerInterval = setInterval(() => {
        countdownSeconds--;
        if (countdownEl) countdownEl.textContent = `① Auto-destruct in ${countdownSeconds}s`;
        if (countdownSeconds <= 0) {
          clearInterval(timerInterval);
          closeViewer();
        }
      }, 1000);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
