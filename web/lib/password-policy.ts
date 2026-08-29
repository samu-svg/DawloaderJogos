export const PASSWORD_MAX_AGE_DAYS = 90;
export const PASSWORD_MIN_LENGTH = 12;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function passwordIsExpired(passwordChangedAt: Date): boolean {
  return Date.now() - passwordChangedAt.getTime() > PASSWORD_MAX_AGE_DAYS * MS_PER_DAY;
}
