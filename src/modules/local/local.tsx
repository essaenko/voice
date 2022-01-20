import React, {MouseEvent, useCallback, useEffect, useState} from 'react';

import css from './local.module.css';
import {HostSignalingClient, SignalingClientEventList} from "../../lib/socket.lib";

export const LocalConnection = (): JSX.Element => {
  const [remoteId, setRemoteId] = useState<string>('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [client, setClient] = useState<HostSignalingClient | null>(null);
  const [clients, setClients] = useState<string[]>([]);

  useEffect(() => {
    setClient(new HostSignalingClient())
  }, [])

  const navigateToRemoteChannel = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    window.history.pushState(null, '', `/channel/${remoteId}`);
  }

  const connect = useCallback(async (event: MouseEvent) => {
    const onNewRtcPeer = () => {
      if (client) {
        setClients(client.peersNames)
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
            Start own channel
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

          {clients.length > 0 && clients.map((cl) => (
            <div>
              {cl}
            </div>
          ))}
        </>
      )}
    </div>
  )
}