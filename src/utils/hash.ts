import crypto from 'crypto';
import fs from 'fs';

export function hashBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function hashFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return hashBuffer(buf);
}

export function hashString(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
