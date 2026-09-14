import 'server-only';
import { isAdmin } from './admin-auth';
import { DataError } from './cloud-validation';

export async function requireAdmin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new DataError('Недопустимый источник запроса.', 403);
  if (!await isAdmin()) throw new DataError('Сессия завершена. Войдите в админку снова.', 401);
}

export async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new DataError('Ожидается JSON.');
  const body = await request.text();
  if (body.length > 256000) throw new DataError('Запрос слишком большой.', 413);
  try { return JSON.parse(body); } catch { throw new DataError('Некорректный запрос.'); }
}

export function apiError(error: unknown) {
  if (error instanceof DataError) return Response.json({ error: error.message }, { status: error.status });
  // Never return database diagnostics or credentials to a browser.
  return Response.json({ error: 'Не удалось выполнить запрос к Supabase. Проверьте подключение и схему базы.' }, { status: 503 });
}
