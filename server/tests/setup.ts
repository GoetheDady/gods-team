import { beforeEach } from 'vitest';
import db from '../src/db';

beforeEach(() => {
  db.exec('DELETE FROM public_keys; DELETE FROM invite_codes; DELETE FROM users;');
});
