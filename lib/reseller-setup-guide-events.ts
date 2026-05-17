/** Tell the setup guide to refetch and show the next-step modal (e.g. after saving a device). */
export const SETUP_GUIDE_REFRESH_EVENT = "ssdomada-setup-guide-refresh";

export function notifySetupGuideRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SETUP_GUIDE_REFRESH_EVENT));
  }
}
