'use client';

import { useState } from 'react';

interface Stats {
  total: number;
  spam_dropped: number;
  last_24h: number;
  geo: Record<string, number>;
}

interface SubmissionRow {
  id: string;
  fields_json: Record<string, unknown>;
  geo_json: { country?: string } | null;
  is_spam: boolean;
  created_at: string;
}

interface SubmissionsResult {
  submissions: SubmissionRow[];
  total: number;
  page: number;
  pageSize: number;
}

const card: React.CSSProperties = {
  border: '1px solid #e2e2e2',
  borderRadius: 8,
  padding: '12px 16px',
  minWidth: 130,
};
const th: React.CSSProperties = {
  textAlign: 'left',
  borderBottom: '2px solid #e2e2e2',
  padding: '6px 8px',
  fontSize: 13,
};
const td: React.CSSProperties = {
  borderBottom: '1px solid #f0f0f0',
  padding: '6px 8px',
  fontSize: 13,
  verticalAlign: 'top',
};

export default function DashboardPage({ params }: { params: { id: string } }) {
  const widgetId = params.id;
  const [token, setToken] = useState('');
  const [includeSpam, setIncludeSpam] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [subs, setSubs] = useState<SubmissionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(spam: boolean) {
    if (!token) {
      setError('Paste a Supabase access token first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [sRes, subRes] = await Promise.all([
        fetch(`/api/widgets/${widgetId}/stats`, { headers }),
        fetch(`/api/widgets/${widgetId}/submissions?includeSpam=${spam}`, {
          headers,
        }),
      ]);
      if (!sRes.ok) throw new Error(`stats request failed (${sRes.status})`);
      if (!subRes.ok)
        throw new Error(`submissions request failed (${subRes.status})`);
      setStats(await sRes.json());
      setSubs(await subRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 900, lineHeight: 1.5 }}>
      <h1 style={{ marginBottom: 4 }}>Widget Dashboard</h1>
      <p style={{ color: '#666', marginTop: 0, fontSize: 14 }}>
        Widget <code>{widgetId}</code>
      </p>

      <div
        style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Supabase access token (Bearer)"
          style={{
            flex: 1,
            minWidth: 260,
            padding: 8,
            border: '1px solid #ccc',
            borderRadius: 4,
          }}
        />
        <button
          onClick={() => load(includeSpam)}
          disabled={loading}
          style={{
            padding: '8px 16px',
            border: 0,
            borderRadius: 4,
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {error && <p style={{ color: '#c00' }}>{error}</p>}

      {stats && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18 }}>Stats</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={card}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</div>
              <div style={{ color: '#666', fontSize: 13 }}>Total (real)</div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {stats.spam_dropped}
              </div>
              <div style={{ color: '#666', fontSize: 13 }}>Spam dropped</div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.last_24h}</div>
              <div style={{ color: '#666', fontSize: 13 }}>Last 24h</div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Geo</div>
              {Object.keys(stats.geo).length === 0 ? (
                <div style={{ color: '#999', fontSize: 13 }}>—</div>
              ) : (
                Object.entries(stats.geo).map(([c, n]) => (
                  <div key={c} style={{ fontSize: 13 }}>
                    {c}: {n}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {subs && (
        <section style={{ marginTop: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2 style={{ fontSize: 18 }}>
              Submissions{' '}
              <span style={{ color: '#666', fontWeight: 400 }}>
                ({subs.total})
              </span>
            </h2>
            <label style={{ fontSize: 14 }}>
              <input
                type="checkbox"
                checked={includeSpam}
                onChange={(e) => {
                  setIncludeSpam(e.target.checked);
                  load(e.target.checked);
                }}
              />{' '}
              include spam
            </label>
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>When</th>
                <th style={th}>Fields</th>
                <th style={th}>Country</th>
                <th style={th}>Spam</th>
              </tr>
            </thead>
            <tbody>
              {subs.submissions.length === 0 ? (
                <tr>
                  <td style={td} colSpan={4}>
                    No submissions yet.
                  </td>
                </tr>
              ) : (
                subs.submissions.map((s) => (
                  <tr key={s.id}>
                    <td style={td}>{new Date(s.created_at).toLocaleString()}</td>
                    <td style={td}>
                      <code style={{ fontSize: 12 }}>
                        {JSON.stringify(s.fields_json)}
                      </code>
                    </td>
                    <td style={td}>{s.geo_json?.country ?? '—'}</td>
                    <td style={td}>{s.is_spam ? 'yes' : ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
