import React from "react";

type PropsType = {
  mic: string;
  setMic: (state: string) => void;
  audio: string;
  setAudio: (state: string) => void;
  devices: MediaDeviceInfo[] | null;
  muteState: [boolean, boolean];
  setMuteState: (state: [boolean, boolean]) => void;
}

export const Settings = ({ mic, setMic, audio, setAudio, devices, muteState, setMuteState }: PropsType): JSX.Element => {
  return (
    <>
      <h2>Settings</h2>
      <h3>Audio device (Input)</h3>
      <select
        value={mic}
        onChange={(event) => setMic(event.target.value)}
      >
        {devices?.filter((device) => device.kind === 'audioinput').map((device) => (
          <option value={device.deviceId} key={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      <a
        onClick={(event) => {
          event.preventDefault();
          setMuteState([!muteState[0], muteState[1]])
        }}
        href={'/#'}
      >
        {muteState[0] ? 'Unmute' : 'Mute'}
      </a>
      <h3>Audio device (Output)</h3>
      <select
        value={audio}
        onChange={(event) => setAudio(event.target.value)}
      >
        {devices?.filter((device) => device.kind === 'audiooutput').map((device) => (
          <option value={device.deviceId} key={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      <a
        onClick={(event) => {
          event.preventDefault();
          setMuteState([muteState[0], !muteState[1]])
        }}
        href={'/#'}
      >
        {muteState[1] ? 'Unmute' : 'Mute'}
      </a>
    </>
  )
}