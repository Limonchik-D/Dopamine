import { ErrorCodes, type ErrorCode } from "./errorCodes.js";

export type AppErrorStatus = 400 | 401 | 403 | 404 | 409;

export class AppError extends Error {
  constructor(
    public status: AppErrorStatus,
    message: string,
    public code: ErrorCode
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function badRequest(message: string, code: ErrorCode = ErrorCodes.BadRequest) {
  return new AppError(400, message, code);
}

export function unauthorized(message = "Unauthorized", code: ErrorCode = ErrorCodes.Unauthorized) {
  return new AppError(401, message, code);
}

export function forbidden(message = "Forbidden", code: ErrorCode = ErrorCodes.Forbidden) {
  return new AppError(403, message, code);
}

export function notFound(message = "Not found", code: ErrorCode = ErrorCodes.NotFound) {
  return new AppError(404, message, code);
}

export function conflict(message: string, code: ErrorCode = ErrorCodes.Conflict) {
  return new AppError(409, message, code);
}
