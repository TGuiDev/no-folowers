import { useEffect, useMemo, useRef, useState } from 'react';
import { extractUsernames } from './lib/instagram.js';

function FileBox({ label, hint, status, ok, onFile }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <label className="dropLabel">
      <span className="title">{label}</span>
      <div
        className={`filebox${ok ? ' ok' : ''}${dragOver ? ' drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
        }}
      >
        {status || hint}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files[0]) onFile(e.target.files[0]);
          e.target.value = '';
        }}
      />
    </label>
  );
}

export default function App() {
  const [followers, setFollowers] = useState(null);
  const [following, setFollowing] = useState(null);
  const [reviewed, setReviewed] = useState(new Set());
  const [notFollowingBack, setNotFollowingBack] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then((data) => {
        setFollowers(data.followers || null);
        setFollowing(data.following || null);
        setReviewed(new Set(data.reviewed || []));
        if (data.followers && data.following) {
          compare(data.followers, data.following);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingInitial(false));
  }, []);

  function compare(f, g) {
    const followerNames = new Set(f.map((u) => u.username.toLowerCase()));
    const map = new Map();
    for (const u of g) {
      if (!followerNames.has(u.username.toLowerCase())) map.set(u.username, u);
    }
    setNotFollowingBack([...map.values()].sort((a, b) => a.username.localeCompare(b.username)));
  }

  async function persist(key, value) {
    try {
      await fetch(`/api/state/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
    } catch {
      // servidor indisponível — os dados continuam só nesta sessão
    }
  }

  function handleFile(kind, file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        const list = extractUsernames(json);
        if (kind === 'followers') setFollowers(list);
        else setFollowing(list);
        persist(kind, list);
        setError('');
      } catch {
        setError(`Erro ao ler ${file.name}: arquivo JSON inválido.`);
      }
    };
    reader.readAsText(file);
  }

  function toggleReviewed(username) {
    setReviewed((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      persist('reviewed', [...next]);
      return next;
    });
  }

  const filtered = useMemo(() => {
    if (!notFollowingBack) return [];
    const term = search.trim().toLowerCase();
    return notFollowingBack.filter((u) => u.username.toLowerCase().includes(term));
  }, [notFollowingBack, search]);

  const remaining = notFollowingBack
    ? notFollowingBack.filter((u) => !reviewed.has(u.username)).length
    : 0;

  const canCompare = Boolean(followers && following);

  return (
    <div className="wrap">
      <h1>No Followers</h1>
      <p className="sub">
        Descubra quem você segue no Instagram e não te segue de volta — seus dados ficam só neste
        servidor.
      </p>

      <div className="card">
        <details className="help">
          <summary>Como conseguir os arquivos necessários</summary>
          <ol>
            <li>
              No app do Instagram: Perfil → Menu (☰) → <strong>Configurações e privacidade</strong> →{' '}
              <strong>Baixar suas informações</strong>.
            </li>
            <li>
              Escolha <strong>Baixar ou transferir informações</strong> → sua conta →{' '}
              <strong>Alguma informação selecionada</strong> → categoria <strong>Conexões</strong>{' '}
              (seguidores e seguindo) → formato <strong>JSON</strong>.
            </li>
            <li>O Instagram avisa por e-mail quando o arquivo estiver pronto para baixar.</li>
            <li>
              No .zip recebido, pegue os arquivos <code>followers_1.json</code> e{' '}
              <code>following.json</code> e envie abaixo. Depois do primeiro envio, eles ficam
              salvos no servidor e carregam sozinhos da próxima vez.
            </li>
          </ol>
        </details>
      </div>

      <div className="card">
        <div className="drop">
          <FileBox
            label="Seguidores (followers_1.json)"
            hint="Clique ou arraste o arquivo aqui"
            ok={Boolean(followers)}
            status={followers ? `✓ ${followers.length} contas` : ''}
            onFile={(f) => handleFile('followers', f)}
          />
          <FileBox
            label="Seguindo (following.json)"
            hint="Clique ou arraste o arquivo aqui"
            ok={Boolean(following)}
            status={following ? `✓ ${following.length} contas` : ''}
            onFile={(f) => handleFile('following', f)}
          />
        </div>
        <button id="run" disabled={!canCompare} onClick={() => compare(followers, following)}>
          Comparar
        </button>
        {error && <div className="error">{error}</div>}
      </div>

      {notFollowingBack && (
        <div className="card">
          <div className="toolbar">
            <input
              type="text"
              placeholder="Buscar usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="count">
              {remaining} de {notFollowingBack.length} não te seguem de volta
            </span>
          </div>

          <ul className="results">
            {filtered.length === 0 && <div className="empty">Nenhum resultado.</div>}
            {filtered.map((u) => (
              <li key={u.username} className={reviewed.has(u.username) ? 'dismissed' : ''}>
                <div className="avatar">{u.username.slice(0, 2).toUpperCase()}</div>
                <div className="uname">
                  <a href={u.href} target="_blank" rel="noopener noreferrer">
                    @{u.username}
                  </a>
                </div>
                <div className="actions">
                  <a className="visit" href={u.href} target="_blank" rel="noopener noreferrer">
                    Abrir perfil
                  </a>
                  <button onClick={() => toggleReviewed(u.username)}>
                    {reviewed.has(u.username) ? 'Desfazer' : 'Já revisei'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loadingInitial && !canCompare && !notFollowingBack && (
        <p className="sub">Envie os dois arquivos acima para começar.</p>
      )}
    </div>
  );
}
