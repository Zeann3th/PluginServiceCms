export enum PluginType {
  JS = 'JS',
  PLAYWRIGHT = 'PLAYWRIGHT',
  PYTHON = 'PYTHON',
  OTHER = 'OTHER'
}

export interface Plugin {
  id: number;
  name: string;
  version: string;
  description: string;
  type: PluginType;
  storageKey: string;
  ownerSub: string;
  tags: string[];
  createdAt: string;
}

export interface PluginRequest {
  name: string;
  version: string;
  description: string;
  type: PluginType;
  filename: string;
  tags: string[];
}

export interface PluginUpdate {
  name?: string;
  version?: string;
  description?: string;
  type?: PluginType;
  tags?: string[];
}
