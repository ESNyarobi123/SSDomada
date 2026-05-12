// ============================================================
// Database models (matching Prisma schema)
// ============================================================

export type DeviceStatus = "ONLINE" | "OFFLINE" | "PENDING";
export type DeviceType = "AP" | "SWITCH" | "GATEWAY" | "OTHER";

export interface Site {
  id: string;
  resellerId: string;
  name: string;
  omadaSiteId: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSiteInput {
  resellerId: string;
  name: string;
  location?: string;
}

export interface Device {
  id: string;
  resellerId: string;
  siteId: string;
  name: string;
  mac: string;
  model: string | null;
  type: DeviceType;
  status: DeviceStatus;
  ip: string | null;
  omadaDeviceId: string | null;
  firmwareVersion: string | null;
  lastSeen: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeviceInput {
  resellerId: string;
  siteId: string;
  name: string;
  mac: string;
  model?: string;
  type?: DeviceType;
}

// ============================================================
// Omada API response types (from Omada Controller)
// ============================================================

export interface OmadaLoginResponse {
  errorCode: number;
  msg: string;
  result: {
    token: string;
  };
}

export interface OmadaSite {
  siteId: string;
  name: string;
  region: string;
  timeZone: string;
  scenario: string;
}

export interface OmadaDevice {
  mac: string;
  name: string;
  type: string;
  model: string;
  modelVersion: string;
  firmwareVersion: string;
  ip: string;
  status: number; // 0=disconnected, 1=connected
  statusCategory: number;
  site: string;
  uptimeLong: number;
  clients: number;
  cpuUtil: number;
  memUtil: number;
  txRate: number;
  rxRate: number;
}

export interface OmadaClient {
  mac: string;
  name: string;
  ip: string;
  deviceType: string;
  wireless: boolean;
  ssid: string;
  signalLevel: number;
  signalRank: number;
  rssi: number;
  trafficUp: number;
  trafficDown: number;
  uptime: number;
  activity: number;
  authStatus: number;
}

export interface OmadaApiResponse<T> {
  errorCode: number;
  msg: string;
  result: {
    totalRows?: number;
    currentPage?: number;
    currentSize?: number;
    data: T[];
  };
}
