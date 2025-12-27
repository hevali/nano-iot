import { Request } from 'express';

export function getAuthHeader(req: Request) {
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [user, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  return user && password ? { user, password } : null;
}
