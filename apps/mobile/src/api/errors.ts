export class ApiError extends Error {
  status: number;
  body: unknown;
  offline: boolean;

  constructor(message: string, status: number, body: unknown, offline = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.offline = offline;
  }
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong';
}
