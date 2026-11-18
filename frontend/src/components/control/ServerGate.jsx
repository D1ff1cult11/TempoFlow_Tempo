import React, { useEffect } from 'react';
import { LogIn } from 'lucide-react';
import { useWorkspace } from '../../store/useWorkspace';
import { useServer, checkServer, signIn, signedInAs } from '../../lib/api';
import { AsyncButton, Result } from './ui';

/**
 * Renders children only when this deployment has the server features and the company is signed in.
 * Shows a one-click sign-in (sign a message; no password, no transaction) when needed. Renders nothing when the
 * deployment has no server/database, so the app still works from the chain alone.
 */
export function ServerGate({ what, children }) {
  const ws = useWorkspace();
  const server = useServer();
  const [result, setResult] = React.useState(null);
  useEffect(() => {
    if (!server.checked) checkServer();
  }, [server.checked]);

  if (!server.available || !ws.company) return null;
  if (signedInAs(server, ws.company)) return children;
  return (
    <div className="cp-note">
      <div className="cp-row" style={{ justifyContent: 'space-between' }}>
        <span>
          Sign in to use {what}. You sign a message with your company account: no password and no transaction.
        </span>
        <AsyncButton
          className="btn-primary btn-sm"
          onClick={async () => {
            await signIn(ws.company);
          }}
          onResult={setResult}
        >
          <LogIn size={14} /> Sign in
        </AsyncButton>
      </div>
      {result && !result.ok && <Result result={result} />}
    </div>
  );
}
