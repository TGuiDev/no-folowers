import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractUsernames } from './src/lib/instagram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'files');
const PORT = process.env.PORT || 8000;
const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASS = process.env.AUTH_PASS;

fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '20mb' }));

if (AUTH_USER && AUTH_PASS) {
  const expected = 'Basic ' + Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64');
  app.use((req, res, next) => {
    if (req.headers.authorization === expected) return next();
    res.set('WWW-Authenticate', 'Basic realm="No Followers"');
    res.status(401).send('Autenticação necessária.');
  });
} else {
  console.warn('Aviso: AUTH_USER/AUTH_PASS não definidos — servindo sem autenticação.');
}

// `kind` -> onde persistimos o que o usuário já enviou pela própria página
// (nome diferente do export bruto do Instagram para não colidir com ele).
function statePath(kind) {
  return path.join(DATA_DIR, `${kind}.state.json`);
}

// Nomes dos exports brutos que o Instagram gera, caso o usuário prefira
// simplesmente colocar os arquivos originais na pasta de dados.
const RAW_EXPORT_FILE = {
  followers: 'followers_1.json',
  following: 'following.json',
};

function loadConnections(kind) {
  const persisted = statePath(kind);
  if (fs.existsSync(persisted)) {
    return JSON.parse(fs.readFileSync(persisted, 'utf-8'));
  }
  const raw = path.join(DATA_DIR, RAW_EXPORT_FILE[kind]);
  if (fs.existsSync(raw)) {
    return extractUsernames(JSON.parse(fs.readFileSync(raw, 'utf-8')));
  }
  return null;
}

function loadReviewed() {
  const reviewedPath = path.join(DATA_DIR, 'reviewed.json');
  if (fs.existsSync(reviewedPath)) {
    return JSON.parse(fs.readFileSync(reviewedPath, 'utf-8'));
  }
  return [];
}

app.get('/api/state', (req, res) => {
  res.json({
    followers: loadConnections('followers'),
    following: loadConnections('following'),
    reviewed: loadReviewed(),
  });
});

app.post('/api/state/:key', (req, res) => {
  const { key } = req.params;
  if (!['followers', 'following', 'reviewed'].includes(key)) return res.status(404).end();
  if (!Array.isArray(req.body)) return res.status(400).send('esperado um array');

  const target = key === 'reviewed' ? path.join(DATA_DIR, 'reviewed.json') : statePath(key);
  fs.writeFileSync(target, JSON.stringify(req.body, null, 2));
  res.status(204).end();
});

const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servindo em http://0.0.0.0:${PORT}`);
});
