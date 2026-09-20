export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const ok = <T>(data: T, message?: string, meta?: ApiResponse["meta"]): ApiResponse<T> => ({
  success: true,
  message,
  data,
  meta,
});

export const created = <T>(data: T, message = "Created successfully"): ApiResponse<T> => ({
  success: true,
  message,
  data,
});

export const fail = (message: string, data?: any): ApiResponse => ({
  success: false,
  message,
  data,
});
