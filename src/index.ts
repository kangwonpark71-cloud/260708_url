import express, { Request, Response } from 'express';
import path from 'path';
import { customAlphabet } from 'nanoid';
import { insertUrl, getByKey, incrementClickCount } from './db';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

const nanoid = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  7
);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} host=${req.get('host')} proto=${req.protocol}`);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: 0, etag: false }));

app.get('/favicon.ico', (_req: Request, res: Response): void => {
  res.status(204).end();
});

app.post('/api/shorten', (req: Request, res: Response): void => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  let targetUrl = url.trim();

  try {
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    new URL(targetUrl);
  } catch {
    res.status(400).json({ error: 'Invalid URL format' });
    return;
  }

  const shortKey = nanoid();

  try {
    const record = insertUrl(shortKey, targetUrl);
    const shortUrl = `${req.protocol}://${req.get('host')}/${record.short_key}`;
    res.json({ short_url: shortUrl, short_key: record.short_key });
  } catch (err) {
    console.error('Failed to create short URL:', err);
    res.status(500).json({ error: 'Failed to create short URL' });
  }
});

app.get('/:shortKey', (req: Request, res: Response): void => {
  const shortKey = String(req.params.shortKey);

  if (shortKey.includes('.')) {
    res.status(404).send('Not found');
    return;
  }

  const record = getByKey(shortKey);

  if (!record) {
    res.status(404).send(`
      <html>
        <head><title>URL Not Found</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 4rem;">
          <h1>404</h1>
          <p>Short URL not found.</p>
          <a href="/">Create a new short URL</a>
        </body>
      </html>
    `);
    return;
  }

  try {
    incrementClickCount(shortKey);
  } catch {
    // click tracking failure is non-critical
  }

  res.redirect(302, record.original_url);
});

app.listen(PORT, (err?: Error) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`🔗 URL Shortener running at http://localhost:${PORT}`);
});
