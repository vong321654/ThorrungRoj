export type ApiSuccess<T> = {
  status: "success";
  message: string;
  results: T;
};

export type ApiError = {
  status: "error";
  message: string;
  results: null;
};

export type ApiResult<T> = ApiSuccess<T> | ApiError;

export function apiSuccess<T>(message: string, results: T): ApiSuccess<T> {
  return { status: "success", message, results };
}

export function apiError(message: string): ApiError {
  return { status: "error", message, results: null };
}
