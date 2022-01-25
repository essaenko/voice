import React, {MouseEvent, useCallback, useEffect, useState} from 'react';

import css from './local.module.css';
import {HostSignalingClient, SignalingClientEventList} from "../../lib/socket.lib";
import {Settings} from "../common/settings";

export const LocalConnection = (): JSX.Element => {
  const [remoteId, setRemoteId] = useState<string>('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [client, setClient] = useState<HostSignalingClient | null>(null);
  const [clients, setClients] = useState<string[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[] | null>(null);
  const [muteState, setMuteState] = useState<[boolean, boolean]>([false, false]);
  const [audio, setAudio] = useState<string>('default');
  const [mic, setMic] = useState<string>('default');
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    setClient(new HostSignalingClient());
    if (navigator.mediaDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => setDevices(devices));
    }
  }, [])

  useEffect(() => {
    if (stream) {
      const micTrack = stream.getTrackById(mic);
      const audioTrack = stream.getTrackById(audio);

      if (micTrack) micTrack.enabled = !muteState[0];
      if (audioTrack) audioTrack.enabled = !muteState[1];
    }
  }, [muteState, audio, mic, stream])

  const navigateToRemoteChannel = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    window.history.pushState(null, '', `/channel/${remoteId}`);
  }

  const connect = useCallback(async () => {
    const onNewRtcPeer = async () => {
      if (client) {
        setClients(client.peersNames)
        setStream(await navigator.mediaDevices.getUserMedia({ audio: true }));
      }
    }
    const onChannelCreated = () => {
      setChannelId(client?.label ?? null);
    }
    if (client) {
      client.createRtcChannel();
      client.subscribe(SignalingClientEventList.OnNewRtcPeer, onNewRtcPeer)
      client.subscribe(SignalingClientEventList.OnRtcPeerDisconnected, onNewRtcPeer)
      client.subscribe(SignalingClientEventList.OnChannelCreated, onChannelCreated)
    }

    return () => {
      if (client) {
        client.subscribe(SignalingClientEventList.OnRtcPeerDisconnected, onNewRtcPeer)
        client.unsubscribe(SignalingClientEventList.OnNewRtcPeer, onNewRtcPeer)
        client.unsubscribe(SignalingClientEventList.OnChannelCreated, onChannelCreated)
      }
    }
  }, [client])


  return (
    <div className={css.root}>
      {!channelId ? (
        <>
          <h2>
            Create own channel
          </h2>
          <button onClick={connect}>
            Create own channel
          </button>
          <h2>
            Connect to existed one
          </h2>
          <input
            type="text"
            placeholder={'Enter channel id you wanna connect to'}
            value={remoteId}
            onChange={({ target: { value } }) => setRemoteId(value)}
          />
          <br />
          <button onClick={navigateToRemoteChannel}>
            Connect
          </button>
        </>
      ) : (
        <>
          <h2>
            Share this link with your party:
          </h2>
          <a href={`${window.location.href}channel/${channelId}`} target={'_blank'} rel="noreferrer">
            {window.location.href}channel/{channelId}
          </a>
          <h2>
            Clients
          </h2>
          {clients.length > 0 && clients.map((cl) => (
            <div>
              {cl}
            </div>
          ))}
        </>
      )}
      <Settings
        mic={mic}
        setMic={setMic}
        audio={audio}
        setAudio={setAudio}
        muteState={muteState}
        setMuteState={setMuteState}
        devices={devices}
      />
    </div>
  )
}