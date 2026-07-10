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

app.use((_req, res, next) => {
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

function createShortUrl(req: Request, url: string): { shortUrl: string; shortKey: string } | { error: string } {
  if (!url || typeof url !== 'string') {
    return { error: 'URL is required' };
  }

  let targetUrl = url.trim();

  try {
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    new URL(targetUrl);
  } catch {
    return { error: 'Invalid URL format' };
  }

  const shortKey = nanoid();

  try {
    const record = insertUrl(shortKey, targetUrl);
    const shortUrl = `${req.protocol}://${req.get('host')}/${record.short_key}`;
    return { shortUrl, shortKey: record.short_key };
  } catch (err) {
    console.error('Failed to create short URL:', err);
    return { error: 'Failed to create short URL' };
  }
}

app.post('/api/shorten', (req: Request, res: Response): void => {
  const result = createShortUrl(req, req.body.url);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ short_url: result.shortUrl, short_key: result.shortKey });
});

app.post('/shorten', (req: Request, res: Response): void => {
  const result = createShortUrl(req, req.body.url);
  if ('error' in result) {
    res.redirect(302, '/?error=' + encodeURIComponent(result.error));
    return;
  }
  res.redirect(302, '/?short=' + encodeURIComponent(result.shortUrl) + '&key=' + encodeURIComponent(result.shortKey));
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
