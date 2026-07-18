import { useEffect, useState } from 'react';
import { apiUrlItem, patItem } from '../../lib/settings';

type Status =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

export function App() {
  const [apiUrl, setApiUrl] = useState('');
  const [pat, setPat] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    void (async () => {
      const [savedUrl, savedPat] = await Promise.all([
        apiUrlItem.getValue(),
        patItem.getValue(),
      ]);
      setApiUrl(savedUrl ?? '');
      setPat(savedPat ?? '');
    })();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedUrl = apiUrl.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setStatus({
        kind: 'error',
        message: 'URL must start with http:// or https://',
      });
      return;
    }
    if (!pat.trim()) {
      setStatus({ kind: 'error', message: 'Access token is required.' });
      return;
    }
    await Promise.all([
      apiUrlItem.setValue(trimmedUrl),
      patItem.setValue(pat.trim()),
    ]);
    setApiUrl(trimmedUrl);
    setStatus({ kind: 'saved' });
  }

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>Swish</h1>
      <p style={styles.intro}>
        Connect this extension to your Swish server. Issue an access token in
        the Swish web app under <strong>Settings → API tokens</strong>, then
        paste it below.
      </p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Swish URL
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://swish.example.com"
            style={styles.input}
            autoComplete="off"
          />
        </label>
        <label style={styles.label}>
          Access token
          <input
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="Personal access token"
            style={styles.input}
            autoComplete="off"
          />
        </label>
        <button type="submit" style={styles.button}>
          Save
        </button>
        {status.kind === 'saved' && (
          <span style={styles.saved}>Saved.</span>
        )}
        {status.kind === 'error' && (
          <span style={styles.error}>{status.message}</span>
        )}
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 420,
    margin: '2rem auto',
    padding: '0 1rem',
    color: '#111',
  },
  h1: { fontSize: '1.5rem', marginBottom: '0.25rem' },
  intro: { fontSize: '0.9rem', color: '#444', lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  input: {
    padding: '0.5rem',
    fontSize: '0.95rem',
    border: '1px solid #ccc',
    borderRadius: 6,
  },
  button: {
    padding: '0.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fff',
    background: '#111',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  saved: { color: '#16a34a', fontSize: '0.85rem' },
  error: { color: '#dc2626', fontSize: '0.85rem' },
};
