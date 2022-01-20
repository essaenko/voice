import {RTCLocalPeer, RTCRemotePeer} from "./rtc.lib";

export enum SignalingClientEventList {
  OnSocketOpened,
  OnSocketClosed,
  OnSocketError,
  OnSocketMessage,
  OnNewRtcPeer,
  OnRtcPeerDisconnected,
  OnChannelCreated
}

type SignalingClientEvent<T = any> = {
  type?: string,
  data?: T,
}

enum SignalingClientMessageTypeList {
  CreateChannel = 'CreateChannel',
  ChannelCreated = 'ChannelCreated',
  NewClient = 'NewClient',
  ClientAdded = 'ClientAdded',
  NewOffer = 'NewOffer',
  NewAnswer = 'NewAnswer',
  IceCandidate = 'IceCandidate',
}

type SignalingClientMessagePayload = {
  type: SignalingClientMessageTypeList,
  payload?: {
    id?: string,
    clientId?: string,
    offer?: string,
    answer?: string,
    iceCandidates?: RTCIceCandidateInit[],
  }
}

type SignalingClientEventHandler = (event: SignalingClientEvent) => void;

class SignalingClient {
  public connection: WebSocket;
  private handlers: Record<SignalingClientEventList, SignalingClientEventHandler[]> = {
    [SignalingClientEventList.OnSocketError]: [],
    [SignalingClientEventList.OnSocketOpened]: [],
    [SignalingClientEventList.OnSocketClosed]: [],
    [SignalingClientEventList.OnSocketMessage]: [],
    [SignalingClientEventList.OnNewRtcPeer]: [],
    [SignalingClientEventList.OnRtcPeerDisconnected]: [],
    [SignalingClientEventList.OnChannelCreated]: [],
  };

  constructor(signalingUri: string,) {
    this.connection = new WebSocket(signalingUri);

    //WebSocket init listeners
    console.info('WebSocket init listeners')
    this.connection.addEventListener('open', this.onOpen)
    this.connection.addEventListener('close', this.onClose)
    this.connection.addEventListener('error', this.onError)
    this.connection.addEventListener('message', this.onMessage)
  }

  public dispatch = (event: SignalingClientEventList, payload: SignalingClientEvent = {}) => {
    console.trace(`Dispatching event: `, SignalingClientEventList[event], payload);
    this.handlers[event].forEach((handler) => {
      handler(payload);
    })
  }

  private onOpen = () => {
    console.info('WebSocket opened')
    this.dispatch(SignalingClientEventList.OnSocketOpened);
  }

  private onClose = (event: CloseEvent) => {
    console.info(`Socket closed with event: ${event}`, event);
    this.dispatch(SignalingClientEventList.OnSocketClosed);
  }

  private onError = (event: Event) => {
    console.warn(`Socket connection fails with event: ${event}`)
    this.dispatch(SignalingClientEventList.OnSocketError, {
      type: event.type
    });
  }

  private onMessage = (event: MessageEvent) => {
    console.info('WebSocket incoming message')
    try {
      const payload = JSON.parse(event.data);
      console.info('Parsed message payload: ', payload)

      this.dispatch(SignalingClientEventList.OnSocketMessage, { data: payload });
    } catch (e) {
      console.warn(`Error while parsing message: `, e);
    }
  }

  public subscribe = (event: SignalingClientEventList, handler: SignalingClientEventHandler) => {
    console.info('Subscribe to SignalingServerClient event: ', event)
    this.handlers[event].push(handler);
  }

  public unsubscribe = (event: SignalingClientEventList, handler: () => void) => {
    console.info('Unsubscribe from SignalingServerClient event: ', event)
    this.handlers[event] = this.handlers[event].filter((h) => h !== handler);
  }

  public send = (payload: SignalingClientMessagePayload) => {
    try {
      console.log(`Trying send message: ${JSON.stringify(payload)}`);
      this.connection.send(JSON.stringify(payload));
    } catch (error) {
      console.warn(`Send call crush: ${error}`, error);
      throw new Error(`Can't send message to socket with error: ${error}`)
    }
  }
}

export class HostSignalingClient extends SignalingClient {
  private peers: RTCLocalPeer[] = [];
  private id: string | null = null;

  public get peersNames() {
    return this.peers.map((peer) => peer.id);
  }

  public get label() {
    return this.id;
  }

  constructor() {
    super(`ws://${window.location.hostname}:9000/ws`);
    this.initListeners()
  }

  private initListeners = () => {
    console.info('Init HostSignalingClient listeners')
    this.subscribe(SignalingClientEventList.OnSocketMessage, this.handleMessage)
  }

  private handleMessage = ({ data }: SignalingClientEvent<SignalingClientMessagePayload>) => {
    console.info('Handle HostSignalingClient incoming message', data)
    if (data !== void 0) {
      switch (data.type) {
        case SignalingClientMessageTypeList.ChannelCreated:
          if (data.payload?.id !== void 0) {
            this.id = data.payload.id;

            this.dispatch(SignalingClientEventList.OnChannelCreated);
          }
          break;
        case SignalingClientMessageTypeList.ClientAdded:
          const peer: RTCLocalPeer = new RTCLocalPeer(data.payload!.clientId!, this);
          peer.onDestroy = this.onPeerDestroyed;
          peer.onRemoteTrack = this.onPeerTrack;
          this.peers.push(peer);

          this.dispatch(SignalingClientEventList.OnNewRtcPeer);

          break;
        case SignalingClientMessageTypeList.NewAnswer:
          if (data.payload?.answer) {
            this.peers.find((peer) => data.payload?.clientId === peer.id)?.handleIncomingAnswer(data.payload.answer)
          }
          break;
        case SignalingClientMessageTypeList.IceCandidate:
          const client = this.peers.find((peer) => data.payload?.clientId === peer.id);
          if (client !== undefined) {
            data.payload?.iceCandidates?.forEach((candidate) => {
              client.addIceCandidate(candidate);
            })
          }
          break;
      }
    }
  }

  private onPeerTrack = (peerId: string, stream: MediaStream) => {
    console.info('Handle new peer track event', peerId, stream)
    this.peers.forEach((peer) => {
      if (peer.id !== peerId) {
        stream.getTracks().forEach((track) => {
          peer.addTrackToConnection(track, stream);
        });
      }
    });
  }

  private onPeerDestroyed = (peerId: string) => {
    this.peers = this.peers.filter((peer) => peer.id !== peerId);
    this.dispatch(SignalingClientEventList.OnRtcPeerDisconnected);
    console.info('Handle HostSignalingClient peer destroy', this.peers)
  }

  public sendRtcIceCandidate = (clientId: string, candidate: RTCIceCandidate) => {
    console.info('Trying to send ICE candidate to signaling server: ', clientId, candidate);
    this.send({
      type: SignalingClientMessageTypeList.IceCandidate,
      payload: {
        id: this.id!,
        clientId,
        iceCandidates: [candidate.toJSON()],
      }
    })
  }

  public sendRtcOffer = (clientId: string, offer: RTCSessionDescription) => {
    console.info('Trying to send RTC offer: ', clientId, offer, this.id);
    if (this.id) {
      this.send({
        type: SignalingClientMessageTypeList.NewOffer,
        payload: {
          id: this.id,
          clientId,
          offer: offer.sdp,
        }
      })
    }
  }

  public createRtcChannel = () => {
    console.info('Trying to create RTC channel: ');
    this.send({
      type: SignalingClientMessageTypeList.CreateChannel,
    })
  }
}

export class PeerSignalingClient extends SignalingClient {
  private readonly id: string;
  private peerId: string | null = null;
  private peer: RTCRemotePeer | null = null;

  constructor(id: string) {
    super(`ws://${window.location.hostname}:9000/ws`);
    this.id = id;

    this.initListeners();
  }

  private initListeners = () => {
    console.info('Init PeerSignalingClient event listeners')
    this.subscribe(SignalingClientEventList.OnSocketMessage, this.handleMessage)
  }

  private handleMessage = async ({ data }: SignalingClientEvent<SignalingClientMessagePayload>) => {
    console.info('Handle PeerSignalingClient incoming message: ', data);
    if (data !== void 0) {
      switch (data.type) {
        case SignalingClientMessageTypeList.ClientAdded:
          if (data.payload?.clientId) {
            this.peerId = data.payload.clientId
            this.peer = new RTCRemotePeer(this.id, this)
          }
          break;
        case SignalingClientMessageTypeList.NewOffer:
          const answer = await this.peer?.handleIncomingOffer(data.payload!.offer!);

          if (answer) {
            this.sendRtcAnswer(answer)
          }
          break;
        case SignalingClientMessageTypeList.IceCandidate:
          if (data.payload?.iceCandidates) {
            data.payload.iceCandidates.forEach((candidate) => {
              this.peer?.addIceCandidate(candidate);
            })
          }
          break;
      }
    }
  }

  private sendRtcAnswer = (answer: RTCSessionDescription) => {
    this.send({
      type: SignalingClientMessageTypeList.NewAnswer,
      payload: {
        id: this.id,
        clientId: this.peerId!,
        answer: answer.sdp,
      }
    })
  }

  public sendRtcIceCandidate = (clientId: string, candidate: RTCIceCandidate) => {
    console.info('Trying to sand ICE Candidate to signaling server: ', clientId, candidate);
    this.send({
      type: SignalingClientMessageTypeList.IceCandidate,
      payload: {
        id: this.id,
        iceCandidates: [candidate.toJSON()]
      }
    })
  }

  public registerClient = () => {
    console.info('Trying to register peer client');
    if (this.connection.readyState !== 1) {
      this.subscribe(SignalingClientEventList.OnSocketOpened, () => {
        this.send({
          type: SignalingClientMessageTypeList.NewClient,
          payload: {
            id: this.id,
          }
        })
      })
    } else {
      this.send({
        type: SignalingClientMessageTypeList.NewClient,
        payload: {
          id: this.id,
        }
      })
    }
  }
}