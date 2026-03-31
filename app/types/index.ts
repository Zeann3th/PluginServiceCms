export interface UserInfo {
  id: number;
  username: string;
}

export type PluginStatus = 'DRAFT' | 'PUBLISHED';

export interface Plugin {
  id: number;
  code: string;
  name: string;
  description: string | null;
  version: string;
  publisher: UserInfo;
  status: PluginStatus;
  downloadCount: number;
  upvoteCount: number;
  downvoteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PluginResponse {
  id: number;
  code: string;
  name: string;
  description: string | null;
  version: string;
  publisher: UserInfo;
  status: PluginStatus;
  download_count: number;
  upvote_count: number;
  downvote_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePluginRequest {
  code: string;
  name: string;
  description?: string;
  version: string;
}

export interface CreatePluginResponse {
  plugin_id: number;
}

export interface UploadPluginRequest {
  filename: string;
  file_size: number;
}

export interface UploadPluginResponse {
  upload_url: string;
}

export interface UpdatePluginRequest {
  name?: string;
  description?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface ApiResponse<T> {
  message: string;
  error_type: string;
  data: T | null;
}
