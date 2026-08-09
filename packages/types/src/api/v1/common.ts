export interface Pagination {
  cursor: string | null;
  limit: number;
  hasMore: boolean;
}

export interface PageResult<T> {
  data: T[];
  pagination: Pagination;
}

export interface DataResponse<T> {
  data: T;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
