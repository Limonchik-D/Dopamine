export function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("unique constraint failed") || message.includes("constraint failed");
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes("foreign key constraint failed");
}
