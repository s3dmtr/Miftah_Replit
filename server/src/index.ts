import { app } from './app.js';
import { migrate } from './migrate.js';

const port = Number(process.env.PORT ?? 4000);
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET is not set; using an insecure development secret.');

migrate()
  .then(() => app.listen(port, () => console.log(`MIFTAH API listening on http://localhost:${port}/api`)))
  .catch((e) => { console.error('Failed to start:', e); process.exit(1); });
