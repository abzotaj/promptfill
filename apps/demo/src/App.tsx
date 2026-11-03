import { useState } from 'react';
import { fakerTransport } from '@promptfill/faker';
import { fakerForLocale } from '@promptfill/faker/locales';
import { usePromptFill } from './usePromptFill';
import { CheckoutForm } from './CheckoutForm';
import { IntakeForm } from './IntakeForm';

const ENDPOINT = import.meta.env.VITE_PROMPTFILL_ENDPOINT ?? 'http://localhost:8787';
const KEY = import.meta.env.VITE_PROMPTFILL_KEY ?? 'pk_demo';
// VITE_PROMPTFILL_OFFLINE=1 skips the server: Faker picks a generator per field from its id/name/label.
const OFFLINE = import.meta.env.VITE_PROMPTFILL_OFFLINE === '1';

type User = { name: string; role: 'developer' | 'customer'; token: string };

export function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('demo-user') ?? 'null');
    } catch {
      return null;
    }
  });
  const [tab, setTab] = useState<'checkout' | 'intake'>('checkout');

  // Only developers get the widget; customers never see it.
  usePromptFill(user?.role === 'developer', {
    transport: OFFLINE ? fakerTransport({ faker: fakerForLocale }) : undefined,
    endpoint: ENDPOINT,
    publishableKey: KEY,
    getAuthToken: () => user?.token,
    presets: [
      { label: 'Albanian customer', prompt: 'A customer from Tirana, Albania, with an Albanian name and +355 phone.', description: 'Local, realistic' },
      { label: 'US business buyer', prompt: 'A purchasing manager at a mid-size US company in Texas, buying for their team.', description: 'Company fields filled' },
      { label: 'Validation breaker', prompt: 'Plausible but invalid data that should fail validation: bad email, short phone, past dates.', description: 'Should show errors' },
    ],
  });

  const login = (role: User['role']) => {
    const u: User = { name: role === 'developer' ? 'Dev User' : 'Jane Customer', role, token: `demo-${role}-token` };
    localStorage.setItem('demo-user', JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem('demo-user');
    setUser(null);
  };

  if (!user) {
    return (
      <main className="login">
        <h1>PromptFill demo</h1>
        <p>Pick who to sign in as. The widget only appears for developers.</p>
        <div className="login-actions">
          <button className="primary" onClick={() => login('developer')}>Sign in as developer</button>
          <button onClick={() => login('customer')}>Sign in as customer</button>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="topbar">
        <strong>Acme Console</strong>
        <nav>
          <button className={tab === 'checkout' ? 'active' : ''} onClick={() => setTab('checkout')}>Checkout</button>
          <button className={tab === 'intake' ? 'active' : ''} onClick={() => setTab('intake')}>Patient intake</button>
        </nav>
        <span className="who">
          {user.name} · {user.role} <button className="link" onClick={logout}>Sign out</button>
        </span>
      </header>
      <main className="page">{tab === 'checkout' ? <CheckoutForm /> : <IntakeForm />}</main>
    </>
  );
}
