import { Login } from "./components/Login";
import { useSession } from "./session";
import { Shell } from "./Shell";

function Splash() {
  return (
    <div className="gate" role="status" aria-label="Loading">
      <div className="splash">
        <div className="skeleton splash-mark" />
        <div className="skeleton splash-line" />
        <div className="skeleton splash-line splash-short" />
      </div>
    </div>
  );
}

export function App() {
  const session = useSession();
  if (session.locked) return <Login />;
  if (session.loading) return <Splash />;
  return <Shell me={session.me} onSignOut={session.me?.auth ? session.signOut : null} />;
}
