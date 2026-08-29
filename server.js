import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import webpush from 'web-push';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// VAPID Web Push Setup (RFC 8292 Standard)
const VAPID_PUBLIC_KEY = 'BLMi8fkinYxnKvWAC5Q8P_IDu1IK-YSqypIm9Jzsg8YG2h6QFWjxo01hFFO_rjTHV_pFMrmC1jEVKDtHVRfRoXc';
const VAPID_PRIVATE_KEY = 'MmejFbjZRL8CfT1WA_ATffxd4SoQbHjuRalfITLXqYU';

webpush.setVapidDetails(
  'mailto:antigravity@duo.space',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 50 * 1024 * 1024
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// Persistent Push Subscriptions File Storage
const SUBSCRIPTIONS_FILE = path.join(__dirname, 'push_subscriptions_db.json');

function loadPersistentSubscriptions() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      const map = new Map();
      for (const [pin, subs] of Object.entries(parsed)) {
        const subMap = new Map();
        for (const [endpoint, subData] of Object.entries(subs)) {
          subMap.set(endpoint, subData);
        }
        map.set(pin, subMap);
      }
      return map;
    }
  } catch (e) {
    console.warn('[Storage] Could not load subscriptions file:', e.message);
  }
  return new Map();
}

function savePersistentSubscriptions() {
  try {
    const obj = {};
    for (const [pin, subMap] of pushSubscriptions.entries()) {
      obj[pin] = {};
      for (const [endpoint, subData] of subMap.entries()) {
        obj[pin][endpoint] = subData;
      }
    }
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Storage] Could not save subscriptions file:', e.message);
  }
}

// In-Memory & Persistent Registries
const registeredUsers = new Map();     // userId -> { socketId, userId, userName, pin, spaceId, online: true }
const pinDirectory = new Map();        // pin -> Set<socketId>
const activeSpaces = new Map();         // spaceId -> Map<socketId, user>
const missedSpaceAlerts = new Map();   // pin/spaceId -> Array<alerts>
const pendingPinRequests = new Map();  // pin -> Array<requests>
const pushSubscriptions = loadPersistentSubscriptions();   // pin -> Map<endpoint, subscriptionObject>

console.log(`[Web Push DB] Loaded subscriptions for ${pushSubscriptions.size} PINs from disk.`);

// API: Get VAPID Public Key
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// API: Save Push Subscription
app.post('/api/save-subscription', (req, res) => {
  const { pin, userId, subscription } = req.body;
  if (!pin || !subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing pin or subscription' });
  }

  const cleanPin = pin.toUpperCase().trim();
  if (!pushSubscriptions.has(cleanPin)) {
    pushSubscriptions.set(cleanPin, new Map());
  }

  pushSubscriptions.get(cleanPin).set(subscription.endpoint, {
    subscription,
    userId,
    updatedAt: Date.now()
  });

  savePersistentSubscriptions();

  console.log(`[Web Push] Registered persistent subscription for PIN: ${cleanPin} (Total: ${pushSubscriptions.get(cleanPin).size})`);
  res.json({ success: true, pin: cleanPin });
});

// Helper: Send Real Background Web Push via FCM/Apple/Mozilla
async function sendWebPushToPin(targetPin, payload) {
  if (!targetPin) return;
  const cleanPin = targetPin.toUpperCase().trim();
  const subMap = pushSubscriptions.get(cleanPin);
  
  if (!subMap || subMap.size === 0) {
    console.log(`[Web Push] No push subscription found for PIN: ${cleanPin}`);
    return;
  }

  const payloadString = JSON.stringify(payload);
  const deadEndpoints = [];

  console.log(`[Web Push] Dispatching push to ${subMap.size} device(s) for PIN ${cleanPin}...`);

  for (const [endpoint, data] of subMap.entries()) {
    try {
      await webpush.sendNotification(data.subscription, payloadString, {
        TTL: 86400,
        urgency: payload.isCall ? 'high' : 'high'
      });
      console.log(`[Web Push] ✅ Successfully delivered push to device for PIN ${cleanPin}`);
    } catch (err) {
      console.warn(`[Web Push] ⚠️ Push error for PIN ${cleanPin}:`, err.statusCode || err.message);
      if (err.statusCode === 404 || err.statusCode === 410) {
        deadEndpoints.push(endpoint);
      }
    }
  }

  // Cleanup expired subscriptions
  if (deadEndpoints.length > 0) {
    deadEndpoints.forEach(ep => subMap.delete(ep));
    savePersistentSubscriptions();
  }
}

io.on('connection', (socket) => {
  let currentUserId = null;
  let currentUserName = null;
  let currentSpace = null;
  let currentPin = null;

  // 1. Join Couple Space via Permanent PIN
  socket.on('join-space', ({ spaceId, userId, userName, pin }) => {
    currentSpace = spaceId;
    currentUserId = userId;
    currentUserName = userName;
    currentPin = (pin || spaceId.replace('PIN-', '')).toUpperCase();

    socket.join(spaceId);
    socket.join(`PIN_ROOM_${currentPin}`);

    if (!pinDirectory.has(currentPin)) {
      pinDirectory.set(currentPin, new Set());
    }
    pinDirectory.get(currentPin).add(socket.id);

    if (!activeSpaces.has(spaceId)) {
      activeSpaces.set(spaceId, new Map());
    }

    const spaceUsers = activeSpaces.get(spaceId);
    const userData = {
      userId,
      userName,
      pin: currentPin,
      socketId: socket.id,
      joinedAt: Date.now(),
      online: true
    };

    spaceUsers.set(socket.id, userData);
    registeredUsers.set(userId, userData);

    const members = Array.from(spaceUsers.values());

    // Broadcast presence
    io.to(spaceId).emit('space-presence', {
      members,
      count: spaceUsers.size
    });

    // Notify other partner that user has joined / online
    socket.to(spaceId).emit('partner-joined', {
      userId,
      userName,
      pin: currentPin,
      socketId: socket.id,
      timestamp: Date.now()
    });

    // Deliver any pending Friend Requests for this PIN
    if (pendingPinRequests.has(currentPin)) {
      const reqs = pendingPinRequests.get(currentPin);
      reqs.forEach((r) => {
        socket.emit('receive-friend-request', r);
      });
      pendingPinRequests.delete(currentPin);
    }

    // Deliver any pending missed calls / alerts
    if (missedSpaceAlerts.has(spaceId) || missedSpaceAlerts.has(currentPin)) {
      const alerts = [
        ...(missedSpaceAlerts.get(spaceId) || []),
        ...(missedSpaceAlerts.get(currentPin) || [])
      ];
      const pendingForMe = alerts.filter(a => a.fromUserId !== userId);
      if (pendingForMe.length > 0) {
        socket.emit('pending-missed-alerts', { alerts: pendingForMe });
        missedSpaceAlerts.delete(spaceId);
        missedSpaceAlerts.delete(currentPin);
      }
    }
  });

  // 2. Send Friend / Join Request with Web Push
  socket.on('send-friend-request', ({ toPin, fromUserName, fromPin }) => {
    const targetPin = (toPin || '').toUpperCase().trim();
    const senderName = fromUserName || currentUserName || 'Partner';
    const payload = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      toPin: targetPin,
      fromUserName: senderName,
      fromPin: (fromPin || currentPin).toUpperCase(),
      fromUserId: currentUserId,
      timestamp: Date.now()
    };

    io.to(`PIN_ROOM_${targetPin}`).emit('receive-friend-request', payload);

    sendWebPushToPin(targetPin, {
      title: '💌 Friend Join Request',
      body: `${senderName} (PIN: ${payload.fromPin}) sent you a join request!`,
      isCall: false,
      tag: 'friend-req'
    });

    if (!pendingPinRequests.has(targetPin)) {
      pendingPinRequests.set(targetPin, []);
    }
    pendingPinRequests.get(targetPin).push(payload);

    socket.emit('friend-request-sent', { success: true, toPin: targetPin });
  });

  // 3. Accept Friend Request with Web Push
  socket.on('accept-friend-request', ({ toPin, fromUserName, fromPin }) => {
    const targetPin = (toPin || '').toUpperCase().trim();
    const senderName = fromUserName || currentUserName || 'Partner';

    io.to(`PIN_ROOM_${targetPin}`).emit('friend-request-accepted', {
      fromUserName: senderName,
      fromPin: (fromPin || currentPin).toUpperCase(),
      timestamp: Date.now()
    });

    sendWebPushToPin(targetPin, {
      title: '❤️ Friend Request Accepted!',
      body: `${senderName} accepted your connect request!`,
      isCall: false,
      tag: 'req-accepted'
    });
  });

  // 4. Wakeup Ring / Ping with Web Push
  socket.on('send-partner-ping', ({ targetPin, fromUserName }) => {
    const senderName = fromUserName || currentUserName || 'Partner';
    const destPin = (targetPin ? targetPin.toUpperCase() : currentPin);

    io.to(`PIN_ROOM_${destPin}`).emit('receive-partner-ping', {
      fromUserName: senderName,
      fromPin: currentPin,
      timestamp: Date.now()
    });

    if (currentSpace) {
      socket.to(currentSpace).emit('receive-partner-ping', {
        fromUserName: senderName,
        fromPin: currentPin,
        timestamp: Date.now()
      });
    }

    sendWebPushToPin(destPin, {
      title: '🔔 Wakeup Alert — Vatsala',
      body: `${senderName} is calling you into your private space!`,
      isCall: false,
      tag: 'duo-ping'
    });
  });

  // 5. Encrypted Message Relay with Web Push
  socket.on('send-encrypted-message', (payload) => {
    if (currentSpace) {
      socket.to(currentSpace).emit('receive-encrypted-message', payload);
      
      const destPin = currentSpace.replace('PIN-', '');
      sendWebPushToPin(destPin, {
        title: '💬 Private Message — Vatsala',
        body: `${payload.senderName || 'Partner'} sent you an encrypted message!`,
        isCall: false,
        tag: 'duo-msg'
      });
    }
  });

  // 6. WebRTC Calls with Web Push
  socket.on('call-offer', ({ targetSocketId, offer, isVideo, callerName }) => {
    const callerDisplayName = callerName || currentUserName || 'Partner';

    if (targetSocketId) {
      io.to(targetSocketId).emit('incoming-call', {
        callerSocketId: socket.id,
        callerId: currentUserId,
        callerName: callerDisplayName,
        offer,
        isVideo
      });
    } else if (currentSpace) {
      socket.to(currentSpace).emit('incoming-call', {
        callerSocketId: socket.id,
        callerId: currentUserId,
        callerName: callerDisplayName,
        offer,
        isVideo
      });
    }

    if (currentSpace) {
      const destPin = currentSpace.replace('PIN-', '');
      sendWebPushToPin(destPin, {
        title: isVideo ? '📹 Incoming Video Call — Vatsala' : '📞 Incoming Voice Call — Vatsala',
        body: `${callerDisplayName} is calling you right now! Tap to answer.`,
        isCall: true,
        tag: 'incoming-call'
      });
    }
  });

  socket.on('call-answer', ({ targetSocketId, answer }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-answered', {
        responderSocketId: socket.id,
        answer
      });
    }
  });

  socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    } else if (currentSpace) {
      socket.to(currentSpace).emit('ice-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    }
  });

  socket.on('end-call', ({ targetSocketId }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-ended');
    } else if (currentSpace) {
      socket.to(currentSpace).emit('call-ended');
    }
  });

  // 7. Disconnect
  socket.on('disconnect', () => {
    if (currentPin && pinDirectory.has(currentPin)) {
      pinDirectory.get(currentPin).delete(socket.id);
    }

    if (currentUserId && registeredUsers.has(currentUserId)) {
      const user = registeredUsers.get(currentUserId);
      user.online = false;
    }

    if (currentSpace && activeSpaces.has(currentSpace)) {
      const spaceUsers = activeSpaces.get(currentSpace);
      spaceUsers.delete(socket.id);

      if (spaceUsers.size === 0) {
        activeSpaces.delete(currentSpace);
      } else {
        io.to(currentSpace).emit('space-presence', {
          members: Array.from(spaceUsers.values()),
          count: spaceUsers.size
        });
        
        socket.to(currentSpace).emit('partner-left', {
          socketId: socket.id,
          userId: currentUserId,
          userName: currentUserName || 'Partner',
          timestamp: Date.now()
        });
      }
    }
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Vatsala] Server running on port ${PORT}`);
});
