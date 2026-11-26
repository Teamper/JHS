export type SessionSite = 'javdb' | 'one115' | 'pan123';

export type SessionRequest = {
  requestId: string;
  session: SessionSite;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  limit: number;
  timeout: number;
  binary: boolean;
};

export type SessionNative = {
  available(): Promise<boolean>;
  setPrivacy(enabled: boolean): Promise<void>;
  openLogin(site: SessionSite, url?: string | null): Promise<{ completed: boolean; token?: string | null }>;
  request(options: SessionRequest): Promise<{ status: number; url: string; headers: string; body: string }>;
  cancel(requestId: string): Promise<void>;
  clearSession(site: SessionSite): Promise<void>;
};
