// hasValidNorwegianChars moved to @flyt/lexicon/grammar (shared with the extension).
// Email/password validators stay app-side.
export { hasValidNorwegianChars } from '@flyt/lexicon/grammar';

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

export function getPasswordStrength(
  password: string,
): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) return 'weak';
  if (!isValidPassword(password)) return 'weak';
  if (password.length >= 12 && /[!@#$%^&*]/.test(password)) return 'strong';
  return 'medium';
}
