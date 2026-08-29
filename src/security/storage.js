/**
 * AntiGravity Duo — Ephemeral Memory & Safe Storage Manager
 * Handles local session, paired friends list, pending requests and in-RAM Blob URL lifecycle.
 */

class EphemeralStorageManager {
  constructor() {
    this.managedBlobUrls = new Set();
    this.initCleanupListeners();
  }

  initCleanupListeners() {
    window.addEventListener('beforeunload', () => {
      this.purgeAllBlobUrls();
    });
  }

  saveSession(spaceId, userId, userName, passphrase) {
    const session = {
      spaceId,
      userId,
      userName,
      pin: passphrase,
      passphrase,
      createdAt: Date.now()
    };
    try {
      sessionStorage.setItem('agy_duo_session', JSON.stringify(session));
      localStorage.setItem('agy_duo_user_profile', JSON.stringify({ userId, userName, userCode: spaceId, pin: passphrase }));
    } catch (e) {
      console.warn('Storage warning:', e);
    }
  }

  getSession() {
    try {
      const raw = sessionStorage.getItem('agy_duo_session');
      if (raw) return JSON.parse(raw);
      const persistent = localStorage.getItem('agy_duo_user_profile');
      if (persistent) {
        const parsed = JSON.parse(persistent);
        return {
          spaceId: parsed.userCode,
          userId: parsed.userId,
          userName: parsed.userName,
          pin: parsed.pin || parsed.userCode.replace('PIN-', ''),
          passphrase: parsed.pin || parsed.userCode.replace('PIN-', '')
        };
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  getUserProfile() {
    try {
      const raw = localStorage.getItem('agy_duo_user_profile');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      return null;
    }
    return null;
  }

  getFriendsList() {
    try {
      const raw = localStorage.getItem('agy_duo_friends_list');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      return [];
    }
    return [];
  }

  saveFriend(friend) {
    const list = this.getFriendsList();
    const existingIndex = list.findIndex(f => (friend.userCode && f.userCode === friend.userCode) || (friend.userId && f.userId === friend.userId));
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...friend };
    } else {
      list.unshift(friend);
    }
    try {
      localStorage.setItem('agy_duo_friends_list', JSON.stringify(list));
    } catch (e) {}
    return list;
  }

  removeFriend(codeOrId) {
    let list = this.getFriendsList();
    list = list.filter(f => f.userCode !== codeOrId && f.userId !== codeOrId);
    try {
      localStorage.setItem('agy_duo_friends_list', JSON.stringify(list));
    } catch (e) {}
    return list;
  }

  getPendingRequests() {
    try {
      const raw = localStorage.getItem('agy_duo_pending_requests');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      return [];
    }
    return [];
  }

  savePendingRequest(req) {
    const list = this.getPendingRequests();
    const existing = list.find(r => r.fromPin === req.fromPin || r.id === req.id);
    if (!existing) {
      list.unshift(req);
      try {
        localStorage.setItem('agy_duo_pending_requests', JSON.stringify(list));
      } catch (e) {}
    }
    return list;
  }

  removePendingRequest(idOrPin) {
    let list = this.getPendingRequests();
    list = list.filter(r => r.fromPin !== idOrPin && r.id !== idOrPin);
    try {
      localStorage.setItem('agy_duo_pending_requests', JSON.stringify(list));
    } catch (e) {}
    return list;
  }

  clearSession() {
    try {
      sessionStorage.removeItem('agy_duo_session');
    } catch (e) {}
  }

  createManagedBlobUrl(blob) {
    const url = URL.createObjectURL(blob);
    this.managedBlobUrls.add(url);
    return url;
  }

  revokeBlobUrl(url) {
    if (this.managedBlobUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.managedBlobUrls.delete(url);
    }
  }

  purgeAllBlobUrls() {
    this.managedBlobUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    });
    this.managedBlobUrls.clear();
  }
}

export const ephemeralStorage = new EphemeralStorageManager();
