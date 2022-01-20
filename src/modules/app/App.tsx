import React from 'react';
import { Route, BrowserRouter } from 'react-router-dom'

import { LocalConnection } from "../local/local";
import {RemoteConnection} from "../remote/remote";

import css from './app.module.css';

function App() {
  return (
    <div className={css.App}>
      <BrowserRouter>
        <Route path={'/'} exact>
          <LocalConnection />
        </Route>
        <Route path={'/channel/:id'} exact>
          <RemoteConnection />
        </Route>
      </BrowserRouter>
    </div>
  );
}

export default App;
