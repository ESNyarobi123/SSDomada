export type SetupGuideStepId =
  | "site"
  | "device"
  | "ssid"
  | "package"
  | "portal"
  | "admin_push";

export type SetupGuideStep = {
  id: SetupGuideStepId;
  number: number;
  titleEn: string;
  titleSw: string;
  descEn: string;
  descSw: string;
  href: string;
  actionEn: string;
  actionSw: string;
};

export const SETUP_GUIDE_STEPS: SetupGuideStep[] = [
  {
    id: "site",
    number: 1,
    titleEn: "Site ready",
    titleSw: "Eneo tayari",
    descEn:
      "When you registered, we created your first Omada site from your business name. Open Sites to review the name and location.",
    descSw:
      "Ulipojisajili, tulitengeneza eneo lako la kwanza la Omada kutoka jina la biashara. Fungua Maeneo kuangalia jina na mahali.",
    href: "/reseller/sites",
    actionEn: "Review site",
    actionSw: "Angalia eneo",
  },
  {
    id: "device",
    number: 2,
    titleEn: "Add your access point",
    titleSw: "Ongeza access point",
    descEn: "Register at least one Omada AP or gateway so guests can connect to your network.",
    descSw: "Sajili angalau AP au gateway moja ya Omada ili wageni waunganike kwenye mtandao wako.",
    href: "/reseller/devices",
    actionEn: "Add device",
    actionSw: "Ongeza kifaa",
  },
  {
    id: "ssid",
    number: 3,
    titleEn: "Create guest Wi‑Fi (SSID)",
    titleSw: "Tengeneza Wi‑Fi ya wageni (SSID)",
    descEn: "Create the Wi‑Fi name guests will see and link it to your site.",
    descSw: "Tengeneza jina la Wi‑Fi wageni wataona na liunganishe na eneo lako.",
    href: "/reseller/ssids",
    actionEn: "Create SSID",
    actionSw: "Tengeneza SSID",
  },
  {
    id: "package",
    number: 4,
    titleEn: "Create packages",
    titleSw: "Tengeneza vifurushi",
    descEn: "Set prices and durations (hourly, daily, weekly) that guests pay before getting online.",
    descSw: "Weka bei na muda (saa, siku, wiki) wageni watalipia kabla ya kupata internet.",
    href: "/reseller/packages",
    actionEn: "Create package",
    actionSw: "Tengeneza kifurushi",
  },
  {
    id: "portal",
    number: 5,
    titleEn: "Customize captive portal",
    titleSw: "Badilisha captive portal",
    descEn: "Add your logo, colors, and welcome message — this is the page guests see when they connect.",
    descSw: "Ongeza nembo, rangi, na ujumbe wa kukaribisha — ukurasa wageni wanaoona wanapounganisha.",
    href: "/reseller/captive-portal",
    actionEn: "Customize portal",
    actionSw: "Badilisha portal",
  },
  {
    id: "admin_push",
    number: 6,
    titleEn: "Controller setup — send to admin",
    titleSw: "Usanidi wa controller — tuma kwa admin",
    descEn:
      "We configure Omada external portal and pre‑auth for you. Send your snapshot to the SSDomada team when steps 1–5 are done.",
    descSw:
      "Tunasimamia external portal na pre‑auth kwenye Omada. Tuma maelezo kwa timu ya SSDomada ukimaliza hatua 1–5.",
    href: "/reseller/captive-portal#controller-setup",
    actionEn: "Send to admin",
    actionSw: "Tuma kwa admin",
  },
];
