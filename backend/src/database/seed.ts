import bcrypt from 'bcryptjs';
import { queryOne, query } from './index';
import { logger } from '../utils/logger';

export async function seedDatabase(): Promise<void> {
  const email = process.env.ADMIN_EMAIL || 'admin@shadowpanel.local';
  const pass  = process.env.ADMIN_PASSWORD || 'changeme123';
  const user  = process.env.ADMIN_USERNAME || 'admin';

  const exists = await queryOne(`SELECT id FROM users WHERE role='superadmin' LIMIT 1`);
  if (exists) return;

  const hash = await bcrypt.hash(pass, 12);
  await query(
    `INSERT INTO users(username,email,password_hash,role,email_verified,server_limit,ram_limit,cpu_limit,disk_limit)
     VALUES($1,$2,$3,'superadmin',TRUE,9999,999999,999999,999999)`,
    [user, email, hash]
  );
  logger.info('Superadmin seeded: ' + email);
}
