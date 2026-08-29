/**
 * AntiGravity Duo — Main Application Orchestrator
 * Automatic Partner Pairing via Permanent PIN, Friends Hub, 3D WebGL Cosmos & Push Alerts
 */

import { renderIcons } from './utils/icons.js';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';

import { Cosmos3DScene } from './three/scene.js';
import { cryptoEngine } from './security/crypto.js';
import { antiLeakSuite } from './security/anti-leak.js';
import { ephemeralStorage } from './security/storage.js';
import { notificationEngine } from './utils/notifications.js';

import { AuthModal } from './components/auth-modal.js';
import { HomeView } from './components/home-view.js';
import { ChatView } from './components/chat-view.js';
import { CallView } from './components/call-view.js';
import { CallManager } from './webrtc/call-manager.js';

class AntiGravityDuoApp {
  constructor() {
    this.socket = null;
    this.session = null;
    this.cosmosScene = null;
    this.callManager = null;
    this.callView = null;
    this.homeView = null;
    this.chatView = null;
    this.activePartner = null;
    this.activePartnerSocketId = null;
    this.currentView = 'home';

    this.init();
  }

  async init() {
    renderIcons();

    // 1. Initialize 3D Cosmos Scene
    try {
      this.cosmosScene = new Cosmos3DScene('cosmos-canvas');
    } catch (err) {
      console.warn('3D Cosmos WebGL warning:', err);
    }

    // 2. Check for existing session
    const existingSession = ephemeralStorage.getSession();
    if (existingSession && existingSession.spaceId && existingSession.passphrase) {
      try {
        await cryptoEngine.deriveKey(existingSession.passphrase, existingSession.spaceId);
        this.session = existingSession;
        this.startApplication();
        return;
      } catch (err) {
        console.warn('Session restoration failed:', err);
      }
    }

    // 3. Show Simple 2-Field PIN Auth Modal
    const authModal = new AuthModal((sessionData) => {
      this.session = sessionData;
      this.startApplication();
    });
    authModal.show();
  }

  startApplication() {
    antiLeakSuite.setSpaceId(this.session.spaceId);

    // Initialize Socket.io Connection
    this.initSocket();

    // Initialize Call Manager & Call View
    this.callManager = new CallManager(this.socket);
    this.callView = new CallView(this.callManager);

    // Render Homepage by default
    this.showHomeView();

    renderIcons();
  }

  showHomeView() {
    this.currentView = 'home';
    this.homeView = new HomeView(
      this.socket,
      this.session,
      (partner) => this.showChatView(partner),
      (isVideo) => this.startCall(isVideo),
      (partnerName) => this.sendPing(partnerName),
      () => this.removePartner(),
      () => this.sendLovePulse()
    );
    renderIcons();
  }

  showChatView(partner) {
    this.currentView = 'chat';
    const currentPartner = partner || this.activePartner || {
      userName: 'Partner',
      userCode: this.session.spaceId,
      isOnline: Boolean(this.activePartnerSocketId)
    };

    this.chatView = new ChatView(
      this.socket,
      this.session,
      currentPartner,
      () => this.showHomeView(),
      () => this.sendLovePulse(),
      (isVideo) => this.startCall(isVideo)
    );
    renderIcons();
  }

  startCall(isVideo) {
    this.callView.renderActiveCall(isVideo);
    this.callManager.startCall(this.activePartnerSocketId, isVideo, this.session.userName);
  }

  sendPing(partnerName) {
    notificationEngine.playPingRing();
    notificationEngine.showToast('🔔 Wakeup Ring Sent', `Partner ke phone par sound & alert bhej diya gaya!`, 'send');
    if (this.socket) {
      this.socket.emit('send-partner-ping', { fromUserName: this.session.userName });
    }
  }

  removePartner() {
    localStorage.removeItem('agy_duo_friends_list');
    this.activePartner = null;
    this.activePartnerSocketId = null;
    if (this.cosmosScene) this.cosmosScene.setPartnerOnline(false);
    notificationEngine.showToast('Partner Removed', 'Friends list updated.', 'trash-2');
    this.showHomeView();
  }

  initSocket() {
    this.socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      this.socket.emit('join-space', {
        spaceId: this.session.spaceId,
        userId: this.session.userId,
        userName: this.session.userName,
        pin: this.session.pin || this.session.spaceId.replace('PIN-', '')
      });
    });

    // Space presence updates
    this.socket.on('space-presence', ({ members, count }) => {
      const partner = members.find((m) => m.userId !== this.session.userId);

      if (partner) {
        this.activePartner = {
          userId: partner.userId,
          userName: partner.userName,
          userCode: `PIN-${partner.pin || this.session.pin}`,
          pin: partner.pin,
          isOnline: true
        };
        this.activePartnerSocketId = partner.socketId;

        ephemeralStorage.saveFriend({
          userId: partner.userId,
          userName: partner.userName,
          userCode: `PIN-${partner.pin || this.session.pin}`,
          pin: partner.pin,
          isOnline: true,
          lastMessage: 'Connected in Space ❤️'
        });

        if (this.homeView && this.currentView === 'home') {
          this.homeView.setFriends(ephemeralStorage.getFriendsList());
        }

        this.updatePresenceStatus(partner, count);
      } else {
        this.activePartnerSocketId = null;
        this.updatePresenceStatus(null, 1);
      }
    });

    // Partner Came Online Event
    this.socket.on('partner-joined', ({ userId, userName, pin, socketId }) => {
      this.activePartnerSocketId = socketId;
      this.activePartner = {
        userId,
        userName,
        userCode: `PIN-${pin || this.session.pin}`,
        pin,
        isOnline: true
      };

      ephemeralStorage.saveFriend({
        userId,
        userName,
        userCode: `PIN-${pin || this.session.pin}`,
        pin,
        isOnline: true,
        lastMessage: 'Online in Space'
      });

      if (this.homeView && this.currentView === 'home') {
        this.homeView.setFriends(ephemeralStorage.getFriendsList());
      }

      confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
      notificationEngine.showToast('🟢 Partner Online', `${userName} is now Online!`, 'user-check', () => {
        this.showChatView(this.activePartner);
      });

      this.updatePresenceStatus({ userId, userName, socketId }, 2);
    });

    // Partner Went Offline Event
    this.socket.on('partner-left', ({ userName }) => {
      this.activePartnerSocketId = null;
      const partnerName = userName || (this.activePartner ? this.activePartner.userName : 'Partner');
      
      if (this.activePartner) {
        this.activePartner.isOnline = false;
      }
      
      this.updatePresenceStatus(null, 1);
      
      if (this.homeView && this.currentView === 'home') {
        this.homeView.setFriends(ephemeralStorage.getFriendsList().map(f => ({ ...f, isOnline: false })));
      }

      notificationEngine.showToast('🌙 Partner Offline', `${partnerName} is now in standby/offline.`, 'moon');
    });

    // Receive Friend Join Request
    this.socket.on('receive-friend-request', (req) => {
      ephemeralStorage.savePendingRequest(req);
      notificationEngine.playPingRing();
      notificationEngine.vibrate([400, 200, 400, 200, 600]);
      notificationEngine.showToast(
        '💌 Friend Join Request',
        `${req.fromUserName} (PIN: ${req.fromPin}) wants to connect with you!`,
        'mail',
        () => {
          if (this.currentView === 'home' && this.homeView) {
            this.homeView.setPendingRequests(ephemeralStorage.getPendingRequests());
          } else {
            this.showHomeView();
          }
        }
      );

      if (this.currentView === 'home' && this.homeView) {
        this.homeView.setPendingRequests(ephemeralStorage.getPendingRequests());
      }
    });

    // Friend Request Accepted Event
    this.socket.on('friend-request-accepted', ({ fromUserName, fromPin }) => {
      ephemeralStorage.saveFriend({
        userName: fromUserName,
        userCode: `PIN-${fromPin}`,
        pin: fromPin,
        isOnline: true,
        lastMessage: 'Request Accepted ❤️'
      });

      confetti({ particleCount: 100, spread: 80 });
      notificationEngine.showToast('❤️ Request Accepted!', `${fromUserName} accepted your join request!`, 'user-check', () => {
        this.showChatView({ userName: fromUserName, userCode: `PIN-${fromPin}`, isOnline: true });
      });

      if (this.currentView === 'home' && this.homeView) {
        this.homeView.setFriends(ephemeralStorage.getFriendsList());
      }
    });

    // Delivery of Missed Calls & Alerts
    this.socket.on('pending-missed-alerts', ({ alerts }) => {
      alerts.forEach((alert) => {
        if (alert.type === 'call') {
          notificationEngine.showToast(
            '📞 Missed Call',
            `You missed a ${alert.isVideo ? 'Video' : 'Voice'} Call from ${alert.fromUserName}!`,
            'phone-missed'
          );
        } else if (alert.type === 'ping') {
          notificationEngine.showToast(
            '🔔 Wakeup Alert',
            `${alert.fromUserName} pinged you while you were away!`,
            'bell-ring'
          );
        }
      });
    });

    // Call Offline Notice
    this.socket.on('call-offline-notice', ({ message }) => {
      notificationEngine.showToast('Standby Alert', message, 'info');
    });

    // Handle Partner Wakeup Ping Alert
    this.socket.on('receive-partner-ping', ({ fromUserName }) => {
      notificationEngine.playPingRing();
      notificationEngine.vibrate([300, 150, 300, 150, 400]);
      notificationEngine.showToast('🔔 Partner Calling!', `${fromUserName} is calling you into your private space!`, 'bell-ring', () => {
        this.showChatView(this.activePartner || { userName: fromUserName, isOnline: true });
      });
    });

    // Receive love pulse
    this.socket.on('receive-love-pulse', (payload) => {
      this.onReceiveLovePulse(payload);
    });

    // Incoming Call listener
    this.socket.on('incoming-call', ({ callerSocketId, callerName, offer, isVideo }) => {
      this.activePartnerSocketId = callerSocketId;
      notificationEngine.startIncomingCallRingtone();
      this.callView.showIncomingCall(
        callerName,
        isVideo,
        () => {
          this.callManager.answerCall(callerSocketId, offer, isVideo);
        },
        () => {
          this.callManager.endCall(true);
        }
      );
    });
  }

  updatePresenceStatus(partner, memberCount) {
    if (partner) {
      this.activePartnerSocketId = partner.socketId;
      if (this.cosmosScene) this.cosmosScene.setPartnerOnline(true);
      if (this.chatView && this.currentView === 'chat') {
        this.chatView.setPartnerStatus(true);
      }
    } else {
      this.activePartnerSocketId = null;
      if (this.cosmosScene) this.cosmosScene.setPartnerOnline(false);
      if (this.chatView && this.currentView === 'chat') {
        this.chatView.setPartnerStatus(false);
      }
    }
  }

  sendLovePulse() {
    if (this.cosmosScene) {
      this.cosmosScene.triggerHeartPulse();
    }
    notificationEngine.playChimeTone();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.5 },
      colors: ['#ff3366', '#ff758c', '#8a2be2', '#00f5d4']
    });
    if (this.socket) {
      this.socket.emit('send-love-pulse', {
        senderId: this.session.userId,
        senderName: this.session.userName
      });
    }
  }

  onReceiveLovePulse(payload) {
    if (this.cosmosScene) {
      this.cosmosScene.triggerHeartPulse();
    }
    notificationEngine.playChimeTone();
    confetti({
      particleCount: 100,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#ff3366', '#ff758c', '#8a2be2', '#00f5d4']
    });
    notificationEngine.showToast('❤️ Love Pulse!', `${payload.senderName || 'Partner'} sent you a 3D celestial heart explosion!`, 'heart');
  }
}

function launch() {
  window.renderIcons = renderIcons;
  new AntiGravityDuoApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', launch);
} else {
  launch();
}
