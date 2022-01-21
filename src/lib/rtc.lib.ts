import {HostSignalingClient, PeerSignalingClient} from "./socket.lib";

enum RTCPeerTypeList {
  Local,
  Remote,
}

class RtcLib {
  public connection: RTCPeerConnection;
  public channels: RTCDataChannel[] = [];
  public signaling: HostSignalingClient | PeerSignalingClient;
  public id: string;

  public readonly peerType: RTCPeerTypeList;

  constructor(type: RTCPeerTypeList = RTCPeerTypeList.Local, id: string, signaling: HostSignalingClient | PeerSignalingClient) {
    this.peerType = type;
    this.signaling = signaling;
    this.id = id;

    this.connection = new RTCPeerConnection({
      iceServers: [{
        urls: [
          "stun1.l.google.com:19302",
          "stun2.l.google.com:19302",
          "stun3.l.google.com:19302",
          "stun4.l.google.com:19302",
        ]
      }]
    });

    this.initConnectionEventHandlers()
  }

  private initConnectionEventHandlers = () => {
    this.connection.addEventListener('datachannel', this.onDataChannel);
    this.connection.addEventListener('icecandidate', this.onIceCandidate);
  }

  private onIceCandidate = async (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      this.signaling.sendRtcIceCandidate(this.id, event.candidate);
    }
  }

  public createChannel = (name: string = 'default'): RTCDataChannel => {
    if (this.channels.find((channel) => channel.label === name)) {
      throw new Error(`Channel with label ${name} already exists`)
    }
    const channel = this.connection.createDataChannel(name);
    this.channels.push(channel);

    return channel;
  }

  public onDataChannel = (event: RTCDataChannelEvent) => {
    if (this.peerType === RTCPeerTypeList.Remote) {
      this.channels.push(event.channel);
    }
  }

  public addTrackToConnection = (track: MediaStreamTrack, stream: MediaStream) => {
    this.connection.addTrack(track, stream);
  }

  public createOffer = async (): Promise<RTCSessionDescription | null> => {
    const offer: RTCSessionDescriptionInit = await this.connection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.connection.setLocalDescription(offer);

    return this.connection.localDescription;
  }

  public setRemoteDescription = async (type: 'offer' | 'answer',desc: string): Promise<void> => {
    await this.connection.setRemoteDescription({
      type,
      sdp: desc
    });
  }

  public createAnswer = async (): Promise<RTCSessionDescription | null> => {
    await this.connection.setLocalDescription(await this.connection.createAnswer())
    return this.connection.localDescription;
  }

  public addLocalTracksToConnection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      stream.getTracks().forEach((track) => {
        this.addTrackToConnection(track, stream);
      })
    } catch (e) {
      console.warn(`Can't add tracks to connection with error: ${e}`)
    }
  }
}

export class RTCLocalPeer extends RtcLib {
  public onDestroy: ((id: string) => void) | null = null;
  public onRemoteTrack: ((id: string, stream: MediaStream) => void) | null = null;

  constructor(id: string, signaling: HostSignalingClient) {
    super(RTCPeerTypeList.Local, id, signaling);

    this.initEventHandlers()
  }

  private initEventHandlers = () => {
    this.connection.addEventListener('negotiationneeded', this.onNegotiationNeeded)
    this.connection.addEventListener('connectionstatechange', this.onConnectionStateChange)
    this.connection.addEventListener('track', this.onTrack)

    this.onInit()
  }

  private onInit = () => {
    this.connection.dispatchEvent(new Event('negotiationneeded'));
  }

  private onTrack = (event: RTCTrackEvent) => {
    const audio = new Audio();
    audio.srcObject = event.streams[0];
    audio.play();

    if (this.onRemoteTrack) {
      this.onRemoteTrack(this.id, event.streams[0]);
    }
  }

  private onConnectionStateChange = () => {
    switch (this.connection.connectionState) {
      case "connected":
        this.onConnect();
        break;
      case "disconnected":
      case "failed":
        this.connection.close();
        if (this.onDestroy) {
          this.onDestroy(this.id);
        }
        break;
      case "closed":
      case "connecting":
      case "new":
    }
  }

  private onConnect = () => {
    this.connection.removeEventListener('negotiationneeded', this.onNegotiationNeeded)
  }

  private onNegotiationNeeded = async () => {
    const offer = await this.createOffer();

    if (offer !== null) {
      if (this.signaling instanceof HostSignalingClient) {
        this.signaling.sendRtcOffer(this.id, offer)
      }
    }
  }

  public addIceCandidate = async (candidate: RTCIceCandidateInit) => {
    await this.connection.addIceCandidate(candidate);
  }

  public handleIncomingAnswer = async (answer: string) => {
    await this.setRemoteDescription('answer', answer);
    await this.addLocalTracksToConnection()
  }
}

export class RTCRemotePeer extends RtcLib {
  constructor(id: string, signaling: PeerSignalingClient) {
    super(RTCPeerTypeList.Remote, id, signaling);

    this.initEventHandlers();
  }

  private initEventHandlers = () => {
    this.connection.addEventListener('track', this.onTrack)
    this.connection.addEventListener('connectionstatechange', this.onConnectionStateChange)
  }

  private onConnectionStateChange = () => {
    switch (this.connection.connectionState) {
      case "closed":
      case "disconnected":
      case "failed":
        this.connection.close();

        window.alert('RTC Connection was closed, trying to reconnect by reloading page')
        window.location.reload()
        break;
    }
  }

  private onTrack = (event: RTCTrackEvent) => {
    const audio = new Audio();
    audio.srcObject = event.streams[0];
    audio.play()
  }

  public addIceCandidate = async (candidate: RTCIceCandidateInit) => {
    await this.connection.addIceCandidate(candidate);
  }

  public handleIncomingOffer = async (offer: string): Promise<RTCSessionDescription | null> => {
    await this.setRemoteDescription('offer', offer)
    const session = await this.createAnswer();
    await this.addLocalTracksToConnection();

    return session;
  }
}