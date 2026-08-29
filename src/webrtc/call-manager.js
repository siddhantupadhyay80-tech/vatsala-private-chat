/**
 * AntiGravity Duo — WebRTC Encrypted Peer-to-Peer Call Manager
 * Direct DTLS-SRTP Audio & Video Calling
 */

export class CallManager {
  constructor(socket) {
    this.socket = socket;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isVideoCall = true;
    this.isAudioMuted = false;
    this.isVideoMuted = false;
    this.targetSocketId = null;
    this.callState = 'idle'; // 'idle', 'calling', 'incoming', 'connected'

    this.onLocalStream = null;
    this.onRemoteStream = null;
    this.onCallEnded = null;
    this.onCallStateChange = null;

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    this.initSocketListeners();
  }

  initSocketListeners() {
    if (!this.socket) return;

    this.socket.on('call-answered', async ({ responderSocketId, answer }) => {
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        this.setCallState('connected');
      }
    });

    this.socket.on('ice-candidate', async ({ candidate }) => {
      if (this.peerConnection && candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    });

    this.socket.on('call-ended', () => {
      this.endCall(false);
    });
  }

  setCallState(state) {
    this.callState = state;
    if (this.onCallStateChange) {
      this.onCallStateChange(state);
    }
  }

  async startCall(targetSocketId, isVideo = true, callerName = 'Partner') {
    this.isVideoCall = isVideo;
    this.targetSocketId = targetSocketId;
    this.setCallState('calling');

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      });

      if (this.onLocalStream) {
        this.onLocalStream(this.localStream, isVideo);
      }

      this.createPeerConnection();

      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socket.emit('call-offer', {
        targetSocketId,
        offer,
        isVideo,
        callerName
      });
    } catch (err) {
      console.error('Failed to start call:', err);
      this.endCall(true);
      alert('Camera / Microphone permission is needed for encrypted calls.');
    }
  }

  async answerCall(callerSocketId, offer, isVideo = true) {
    this.isVideoCall = isVideo;
    this.targetSocketId = callerSocketId;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      });

      if (this.onLocalStream) {
        this.onLocalStream(this.localStream, isVideo);
      }

      this.createPeerConnection();

      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.socket.emit('call-answer', {
        targetSocketId: callerSocketId,
        answer
      });

      this.setCallState('connected');
    } catch (err) {
      console.error('Failed to answer call:', err);
      this.endCall(true);
    }
  }

  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('ice-candidate', {
          targetSocketId: this.targetSocketId,
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream, this.isVideoCall);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection.connectionState === 'disconnected' || this.peerConnection.connectionState === 'failed') {
        this.endCall(false);
      }
    };
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isAudioMuted = !audioTrack.enabled;
        return this.isAudioMuted;
      }
    }
    return false;
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isVideoMuted = !videoTrack.enabled;
        return this.isVideoMuted;
      }
    }
    return false;
  }

  endCall(notifyRemote = true) {
    if (notifyRemote && this.socket) {
      this.socket.emit('end-call', { targetSocketId: this.targetSocketId });
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.setCallState('idle');

    if (this.onCallEnded) {
      this.onCallEnded();
    }
  }
}
