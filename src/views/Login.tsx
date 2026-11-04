import { useState, type FormEvent } from 'react';

import { OWNER_EMAIL } from '../backend/config';
import { authError, type Session } from '../backend/store';
import { Logo } from './Logo';

/** Logowanie, pierwsze założenie konta i potwierdzenie e-maila. */
export function Login({ s }: { s: Session }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(''); setInfo('');
    try { await fn(); } catch (e) { setError(authError(e)); } finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'signup' && email.trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      setError('Konto może założyć tylko właściciel kalkulatora, na swój adres e-mail.'); return;
    }
    run(() => (mode === 'login' ? s.login(email, password) : s.signup(email, password)));
  };

  let body;
  if (s.user && !s.allowed) {
    body = (<>
      <h2>Brak dostępu</h2>
      <p className="hint">Konto {s.user.email} nie ma dostępu do kalkulatora.</p>
      <button className="btn" onClick={() => s.logout()}>Wyloguj się</button>
    </>);
  } else if (s.user && !s.verified) {
    body = (<>
      <h2>Potwierdź e-mail</h2>
      <p className="hint">Wysłaliśmy link na <b>{s.user.email}</b>. Kliknij go (sprawdź też spam), a potem wróć tutaj.</p>
      {error && <p className="form-error">{error}</p>}
      {info && <p className="form-info">{info}</p>}
      <button className="btn primary" disabled={busy} onClick={() => run(async () => {
        if (!(await s.checkVerified())) setError('Adres nie jest jeszcze potwierdzony. Kliknij link w e-mailu.');
      })}>Potwierdziłem, wchodzę</button>
      <div className="row-between">
        <button className="btn" onClick={() => run(async () => { await s.resendVerification(); setInfo('Wysłano ponownie.'); })}>Wyślij link jeszcze raz</button>
        <button className="btn" onClick={() => s.logout()}>Wyloguj</button>
      </div>
    </>);
  } else {
    body = (
      <form onSubmit={submit}>
        <div>
          <h2>{mode === 'login' ? 'Zaloguj się' : 'Załóż konto'}</h2>
          <p className="hint">{mode === 'login' ? 'Kalkulator doboru diety.' : `Tylko dla adresu ${OWNER_EMAIL}. Po założeniu potwierdzisz e-mail.`}</p>
        </div>
        <label>E-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Hasło{mode === 'signup' ? ' (min. 6 znaków)' : ''}
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <p className="form-error">{error}</p>}
        {info && <p className="form-info">{info}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Chwila…' : mode === 'login' ? 'Zaloguj się' : 'Załóż konto'}</button>
        <div className="row-between">
          <button type="button" className="linkbtn" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}>
            {mode === 'login' ? 'Pierwsze logowanie? Załóż konto' : 'Mam już konto'}
          </button>
          {mode === 'login' && <button type="button" className="linkbtn" onClick={() => {
            if (!email.trim()) { setError('Wpisz najpierw swój e-mail.'); return; }
            run(async () => { await s.resetPassword(email); setInfo('Wysłaliśmy link do zmiany hasła.'); });
          }}>Nie pamiętam hasła</button>}
        </div>
      </form>
    );
  }
  return <div className="login-wrap"><div className="login-card"><Logo width={150} />{body}</div></div>;
}
