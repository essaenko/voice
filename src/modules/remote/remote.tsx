import React, {useEffect, useState} from 'react';
import {useParams} from "react-router";

import {PeerSignalingClient} from "../../lib/socket.lib";

import css from './remote.module.css';

export const RemoteConnection = (props: any): JSX.Element => {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<PeerSignalingClient>()

  useEffect(() => {
    if (params.id) {
      setClient(new PeerSignalingClient(params.id))
    }
  }, [params]);

  useEffect(() => {
    if (client) {
      client.registerClient();
    }
  }, [client])

  return (
    <div className={css.root}>
      Your id: {params.id}
    </div>
  )
}