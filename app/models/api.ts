export type APISUCCESS<T> = {
  status: "success";
  message: string;
  results: T;
};

export type APIERROR = {
  status: "error";
  message: string;
  results: null;
};

export type APIRESULT<T> = APISUCCESS<T> | APIERROR;

export type SERVICERESULT<T> = {
  result: APIRESULT<T>;
  status: number;
};

export type NAMEPAYLOAD = { name?: unknown };
export type IDNAMEPAYLOAD = { id?: unknown; name?: unknown };

export type { APISUCCESS as ApiSuccess, APIERROR as ApiError, APIRESULT as ApiResult, SERVICERESULT as ServiceResult, NAMEPAYLOAD as NamePayload, IDNAMEPAYLOAD as IdNamePayload };
