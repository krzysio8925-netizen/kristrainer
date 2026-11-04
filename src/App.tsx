import { useSession } from './backend/store';
import { Calculator } from './views/Calculator';
import { Login } from './views/Login';

export default function App() {
  const s = useSession();
  if (s.user === undefined) return <div className="login-wrap"><p className="hint">Ładowanie…</p></div>;
  if (!s.user || !s.allowed || !s.verified) return <div className="wrap"><Login s={s} /></div>;
  return <Calculator email={s.user.email ?? ''} onLogout={s.logout} />;
}
