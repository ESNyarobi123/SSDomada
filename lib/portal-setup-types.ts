/** Shared shape for JSON stored on `PortalSetupRequest.details` (no server imports). */
export type PortalSetupSnapshot = {
  portalUrl: string;
  brandSlug: string;
  companyName: string;
  resellerEmail: string;
  sites: Array<{
    siteId: string;
    siteName: string;
    omadaSiteId: string | null;
    devices: Array<{
      id: string;
      name: string;
      mac: string;
      model: string | null;
      status: string;
      omadaDeviceId: string | null;
    }>;
    ssids: Array<{
      id: string;
      ssidName: string;
      open: boolean;
      omadaSsidId: string | null;
      band: string;
    }>;
  }>;
};
