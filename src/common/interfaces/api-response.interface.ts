export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string | string[];
  error?: string;
  data?: T;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
