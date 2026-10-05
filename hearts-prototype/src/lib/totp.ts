import { createHash, randomBytes } from 'node:crypto'
import { generateSecret, generateSync, generateURI, verifySync } from 'otplib'
import { decryptSecret, encryptSecret, hashToken } from './account-crypto'

export const BACKUP_COUNT = 10

export function newTotpSecret() {
  return generateSecret()
}

export function totpUri(email: string, secret: string, issuer = 'HEARTS') {
  return generateURI({ issuer, label: email, secret })
}

export function totpOk(code: string, secret: string) {
  const trimmed = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(trimmed)) return false
  try {
    return Boolean(verifySync({ secret, token: trimmed, epochTolerance: 30 }).valid)
  } catch {
    return false
  }
}

export function totpNow(secret: string) {
  return generateSync({ secret })
}

export function groupSecret(secret: string) {
  return secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
}

export function sealTotpSecret(secret: string) {
  return encryptSecret(secret)
}

export function openTotpSecret(blob: string) {
  return decryptSecret(blob)
}

export function makeBackupCodes() {
  const plain = Array.from({ length: BACKUP_COUNT }, () => randomBytes(4).toString('hex'))
  const hashed = plain.map((code) => hashToken(code.toLowerCase()))
  return { plain, hashed }
}

export function backupHash(code: string) {
  return hashToken(code.trim().toLowerCase())
}

export function takeBackupCode(hashed: string[], code: string) {
  const want = backupHash(code)
  const index = hashed.findIndex((row) => row === want)
  if (index < 0) return null
  return hashed.filter((_, i) => i !== index)
}

export function lookLikeBackup(code: string) {
  return /^[a-f0-9]{8}$/i.test(code.trim())
}

export function totpFingerprint(secret: string) {
  return createHash('sha256').update(secret).digest('hex').slice(0, 8)
}
