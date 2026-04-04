export interface UserInfo {
  id: number;
  username: string;
}

export type PluginStatus = 'DRAFT' | 'PUBLISHED';
export type InstallationStatus = 'NOT_INSTALLED' | 'INSTALLED' | 'UPDATABLE';

export interface PluginVersionResponse {
  version: string;
  status: PluginStatus;
  download_count: number;
  created_at: string;
}

export interface Plugin {
  id: number;
  code: string;
  name: string;
  description: string | null;
  publisher: UserInfo;
  upvoteCount: number;
  downvoteCount: number;
  tags: string[];
  latestVersion: string | null;
  installationStatus: InstallationStatus;
  versions?: PluginVersionResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface PluginResponse {
  id: number;
  code: string;
  name: string;
  description: string | null;
  publisher: UserInfo;
  upvote_count: number;
  downvote_count: number;
  tags: string[];
  latest_version: string | null;
  installation_status: InstallationStatus;
  versions?: PluginVersionResponse[];
  created_at: string;
  updated_at: string;
}

export interface CreatePluginRequest {
  code: string;
  name: string;
  description?: string;
  version: string;
  tags?: string[];
}

export interface CreatePluginResponse {
  plugin_id: number;
}

export interface UploadPluginRequest {
  filename: string;
  file_size: number;
  version?: string;
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
