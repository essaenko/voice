import React, {useCallback, useEffect, useState} from 'react';
import {useParams} from "react-router";

import {PeerSignalingClient} from "../../lib/socket.lib";

import css from './remote.module.css';
import {Settings} from "../common/settings";

export const RemoteConnection = (): JSX.Element => {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<PeerSignalingClient>();
  const [devices, setDevices] = useState<MediaDeviceInfo[] | null>(null);
  const [muteState, setMuteState] = useState<[boolean, boolean]>([false, false]);
  const [audio, setAudio] = useState<string>('default');
  const [mic, setMic] = useState<string>('default');
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (stream) {
      const micTrack = stream.getTrackById(mic);
      const audioTrack = stream.getTrackById(audio);

      if (micTrack) micTrack.enabled = !muteState[0];
      if (audioTrack) audioTrack.enabled = !muteState[1];
    }
  }, [muteState, audio, mic, stream])

  useEffect(() => {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => setDevices(devices));
    }
  }, [])

  const onClick = useCallback(() => {
    if (params.id) {
      setClient(new PeerSignalingClient(params.id))
    }
  }, [params]);

  useEffect(() => {
    if (client) {
      client.registerClient();
      if (navigator.mediaDevices) {
        navigator
          .mediaDevices
          .getUserMedia({ audio: true }).then((stream) => {
          setStream(stream)
        }).catch((e) => {
          console.warn(`Can't set stream with error: `, e);
        });
      }
    }
  }, [client])

  return (
    <div className={css.root}>
      Your id: {params.id}
      <br/>
      <br/>
      <button onClick={onClick}>
        Join voice chat
      </button>
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