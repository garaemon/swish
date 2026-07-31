/**
 * The extension's only settings surface. The background worker opens this page
 * automatically on the first save when either value is missing. Both values are
 * written to chrome.storage.local through lib/settings.ts; the validation rules
 * live there too, so they can be tested without a DOM.
 */
import { useEffect, useState } from 'react';
import { apiUrlItem, patItem, validateSettingsInput } from '../../lib/settings';

type Status =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }

/** Renders the Swish URL and access token form for the options page. */
export function App() {
  const [apiUrl, setApiUrl] = useState('');
  const [pat, setPat] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    async function loadSavedSettings() {
      const [savedUrl, savedPat] = await Promise.all([
        apiUrlItem.getValue(),
        patItem.getValue(),
      ]);
      setApiUrl(savedUrl ?? '');
      setPat(savedPat ?? '');
      // The worker reopens this page whenever the stored values stop passing
      // validation — an http:// URL kept from an older build, say. Without the
      // reason the user faces a filled-in form and no hint at what to change.
      if (savedUrl && savedPat) {
        const validation = validateSettingsInput(savedUrl, savedPat);
        if (!validation.ok) {
          setStatus({ kind: 'error', message: validation.message });
        }
      }
    }

    loadSavedSettings().catch((error: unknown) => {
      console.error('Swish: could not read stored settings', error);
      setStatus({
        kind: 'error',
        message: 'Could not read the stored settings.',
      });
    });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validateSettingsInput(apiUrl, pat);
    if (!validation.ok) {
      setStatus({ kind: 'error', message: validation.message });
      return;
    }
    const { settings } = validation;
    // React does not await this handler, so a rejected write would otherwise
    // leave the page showing neither "Saved." nor an error — indistinguishable
    // from the click never registering, with nothing actually persisted.
    try {
      await Promise.all([
        apiUrlItem.setValue(settings.apiUrl),
        patItem.setValue(settings.pat),
      ]);
    } catch (error) {
      console.error('Swish: could not store settings', error);
      setStatus({ kind: 'error', message: 'Could not save the settings.' });
      return;
    }
    // Echo both normalized values back so the form never shows something other
    // than what was stored. The token matters most: it is a password field, so
    // whitespace picked up from a paste is invisible.
    setApiUrl(settings.apiUrl);
    setPat(settings.pat);
    setStatus({ kind: 'saved' });
  }

  // Any edit invalidates the previous verdict: "Saved." must not sit above
  // unsaved input, and a corrected field must not keep showing its old error.
  function editField(setField: (value: string) => void, value: string) {
    setField(value);
    setStatus({ kind: 'idle' });
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
            onChange={(event) => editField(setApiUrl, event.target.value)}
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
            onChange={(event) => editField(setPat, event.target.value)}
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

// `satisfies` rather than an annotation: an index signature would let a typo
// like `styles.buttton` compile and silently render with no styles.
const styles = {
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
} satisfies Record<string, React.CSSProperties>;
