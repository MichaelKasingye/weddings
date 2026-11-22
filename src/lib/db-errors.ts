/**
 * Turns a MongoDB / connection failure into a plain explanation of what is wrong and how to fix it.
 * Used by /api/health, the error pages and the dashboard actions. Safe to show: it never includes
 * the connection string, the password or the raw driver message.
 */

export type DbErrorCode =
  | 'not_configured' // MONGODB_URI is missing
  | 'bad_uri' // MONGODB_URI is not a valid connection string
  | 'auth_failed' // wrong database username / password
  | 'ip_blocked' // Atlas Network Access doesn't allow this server
  | 'host_not_found' // the cluster address doesn't exist, or no internet
  | 'refused' // nothing is listening at that address (local mongod not running)
  | 'unreachable' // the database is down, paused or not answering
  | 'db_error'; // some other database error

export type DbErrorInfo = { code: DbErrorCode; title: string; message: string; fix: string };

const INFO: Record<DbErrorCode, Omit<DbErrorInfo, 'code'>> = {
  not_configured: {
    title: 'The app is not connected to a database',
    message: 'No database address is set, so the app cannot load or save anything.',
    fix: 'Set MONGODB_URI in .env.local (local) or in Vercel → Project → Settings → Environment Variables, then restart / redeploy.',
  },
  bad_uri: {
    title: 'The database address is invalid',
    message: 'MONGODB_URI is not a valid MongoDB connection string.',
    fix: 'It must start with mongodb:// or mongodb+srv://. Copy it again from Atlas → Connect → Drivers.',
  },
  auth_failed: {
    title: 'The database refused access',
    message: 'The database username or password in MONGODB_URI is wrong, or that user has no access.',
    fix: 'Check the user under Atlas → Database Access. Special characters in the password (@ : / # ?) must be URL-encoded.',
  },
  ip_blocked: {
    title: 'The database is blocking this server',
    message: 'MongoDB Atlas did not accept the connection from this server’s IP address.',
    fix: 'In Atlas → Network Access, add 0.0.0.0/0 (Vercel has no fixed IP) or this machine’s IP address.',
  },
  host_not_found: {
    title: 'The database could not be found',
    message: 'The database address does not exist, or this server has no internet connection.',
    fix: 'Check the cluster address in MONGODB_URI and the internet connection.',
  },
  refused: {
    title: 'The database is not running',
    message: 'Nothing answered at the database address (connection refused).',
    fix: 'If you use a local MongoDB, start it (e.g. sudo systemctl start mongod). Otherwise check the address in MONGODB_URI.',
  },
  unreachable: {
    title: 'The database is not responding',
    message: 'The app cannot reach the database. It may be down, paused or overloaded.',
    fix: 'Check the cluster in MongoDB Atlas (resume it if it is paused), then try again in a minute.',
  },
  db_error: {
    title: 'Database error',
    message: 'The database returned an error.',
    fix: 'Try again. If it keeps happening, check the server logs.',
  },
};

export function dbErrorInfo(code: DbErrorCode): DbErrorInfo {
  return { code, ...INFO[code] };
}

/** Every message in the error, its causes and (for server-selection errors) each server's own error. */
function allText(e: unknown, depth = 0): string {
  if (!e || typeof e !== 'object' || depth > 4) return typeof e === 'string' ? e : '';
  const err = e as { name?: string; message?: string; code?: unknown; codeName?: string; cause?: unknown; reason?: { servers?: Map<string, { error?: unknown }> } };
  const parts = [err.name, err.message, err.codeName, typeof err.code === 'string' ? err.code : ''];
  parts.push(allText(err.cause, depth + 1));
  const servers = err.reason?.servers;
  if (servers && typeof servers.forEach === 'function') servers.forEach((s) => parts.push(allText(s?.error, depth + 1)));
  return parts.filter(Boolean).join(' | ');
}

/** null when the error has nothing to do with the database. */
export function classifyDbError(e: unknown): DbErrorInfo | null {
  const text = allText(e);
  const name = e instanceof Error ? e.name : '';
  const num = (e as { code?: unknown } | null)?.code;

  if (/MONGODB_URI is not set/.test(text)) return dbErrorInfo('not_configured');
  if (name === 'MongoParseError' || /Invalid scheme|Invalid connection string|URI must include hostname|mongodb\+srv URI/i.test(text)) return dbErrorInfo('bad_uri');
  if (name === 'MongoAuthError' || num === 18 || num === 8000 || /bad auth|Authentication failed|auth.*fail/i.test(text)) return dbErrorInfo('auth_failed');
  if (/alert number 80|whitelist|IP address.*(not|isn't) (allowed|on)/i.test(text)) return dbErrorInfo('ip_blocked');
  if (/ENOTFOUND|EAI_AGAIN|querySrv|getaddrinfo/i.test(text)) return dbErrorInfo('host_not_found');
  if (/ECONNREFUSED/.test(text)) return dbErrorInfo('refused');
  if (/MongoServerSelectionError|MongoNetwork|MongoTopologyClosed|MongoNotConnected|ETIMEDOUT|ECONNRESET|timed out|did not answer within/i.test(text)) return dbErrorInfo('unreachable');
  if (/^Mongo/.test(name)) return dbErrorInfo('db_error');
  return null;
}
