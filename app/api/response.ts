import type { APIERROR, APISUCCESS } from "@/app/models/api";

export type {
  APIERROR,
  APIRESULT,
  APISUCCESS,
  APIERROR as ApiError,
  APIRESULT as ApiResult,
  APISUCCESS as ApiSuccess,
} from "@/app/models/api";

export function apiSuccess<T>(message: string, results: T): APISUCCESS<T> {
  return { status: "success", message, results };
}

export function apiError(message: string): APIERROR {
  return { status: "error", message, results: null };
}
