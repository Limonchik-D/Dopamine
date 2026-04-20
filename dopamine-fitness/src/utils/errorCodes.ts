export const ErrorCodes = {
  BadRequest: "BAD_REQUEST",
  ValidationError: "VALIDATION_ERROR",
  Unauthorized: "UNAUTHORIZED",
  InvalidToken: "INVALID_TOKEN",
  TokenRevoked: "TOKEN_REVOKED",
  Forbidden: "FORBIDDEN",
  NotFound: "NOT_FOUND",
  Conflict: "CONFLICT",
  RateLimited: "RATE_LIMITED",
  AuthRateLimited: "AUTH_RATE_LIMITED",
  InternalError: "INTERNAL_ERROR",

  SetDuplicate: "SET_DUPLICATE",
  FavoriteDuplicate: "FAVORITE_DUPLICATE",
  FavoriteInvalidReference: "FAVORITE_INVALID_REFERENCE",
  FavoriteNotFound: "FAVORITE_NOT_FOUND",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
