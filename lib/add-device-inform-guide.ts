/** Hostname resellers must set on the AP (System → Controller Settings → Inform URL). */
export const CONTROLLER_INFORM_HOST = "server.ssdomada.site";

export type AddDeviceGuideStep = {
  title: string;
  description: string;
  /** Path under /public */
  imagePath: string;
};

export const ADD_DEVICE_INFORM_GUIDE_STEPS: AddDeviceGuideStep[] = [
  {
    title: "Ingia kwenye ukurasa wa AP",
    description:
      "Unganisha kompyuta yako na WiFi au Ethernet ya AP, kisha fungua kivinjari na nenda tplinkeap.net (au IP ya AP). Ingia kwa username na password ya AP (kawaida admin / admin ikiwa hujabadilisha).",
    imagePath: "/images/AddDevice/Screenshot 2026-05-17 at 12.09.01.png",
  },
  {
    title: "Chagua AP Mode (ikiwa setup inaonekana)",
    description:
      "Ikiwa kiongozi cha kwanza (wizard) kinaonekana, chagua AP Mode — AP inaunganishwa na router kwa waya na kutoa WiFi. Bonyeza Next hadi umalize setup.",
    imagePath: "/images/AddDevice/Screenshot 2026-05-17 at 12.09.27.png",
  },
  {
    title: "Angalia MAC address ya AP",
    description:
      "Kwenye kichupo Status → Device, angalia MAC address (mfano 3C-78-95-15-A7-D9). Utaitumia unapoongeza device hapa SSDomada.",
    imagePath: "/images/AddDevice/Screenshot 2026-05-17 at 12.09.43.png",
  },
  {
    title: "Fungua System",
    description: "Juu ya ukurasa, bonyeza kichupo System (si Status wala Wireless).",
    imagePath: "/images/AddDevice/Screenshot 2026-05-17 at 12.09.52.png",
  },
  {
    title: "Fungua Controller Settings",
    description:
      "Chini ya System, bonyeza Controller Settings. Utaona sehemu ya Controller Inform URL.",
    imagePath: "/images/AddDevice/Screenshot 2026-05-17 at 12.09.59.png",
  },
  {
    title: `Weka Inform URL: ${CONTROLLER_INFORM_HOST}`,
    description: `Futa anwani ya zamani kwenye Inform URL/IP Address, andika ${CONTROLLER_INFORM_HOST} (hostname pekee — usiweke https://).`,
    imagePath: "/images/AddDevice/Screenshot 2026-05-17 at 12.10.24.png",
  },
  {
    title: "Bonyeza Save",
    description:
      `Hakikisha ${CONTROLLER_INFORM_HOST} imebaki kwenye sanduku, kisha bonyeza Save. Subiri sekunde 30–60 ili AP iwasiliane na controller, kisha rudi SSDomada uongeze device.`,
    imagePath: "/images/AddDevice/Screenshot 2026-05-17 at 12.18.36.png",
  },
];

export function guideImageSrc(publicPath: string): string {
  return encodeURI(publicPath);
}

export type OmadaAddDeviceFeedback = {
  siteLinked?: boolean;
  adoptAttempted?: boolean;
  adopted?: boolean;
  controllerDeviceListed?: boolean;
  message?: string;
  userMessage?: string;
};

/** Reseller-friendly copy — no raw API paths or error dumps. */
export function formatOmadaDeviceNotice(omada: OmadaAddDeviceFeedback | undefined | null): string | null {
  if (!omada) return null;

  if (omada.siteLinked === false) {
    return omada.userMessage || "Tovuti hii haijaunganishwa na Omada. Wasiliana na msaada au angalia Sites.";
  }

  if (omada.adoptAttempted && !omada.adopted) {
    if (omada.userMessage) return omada.userMessage;
    if (omada.controllerDeviceListed === false) {
      return (
        `Device imehifadhiwa hapa lakini bado iko Pending. Kwenye AP yako fungua System → Controller Settings, ` +
        `weka Inform URL: ${CONTROLLER_INFORM_HOST}, bonyeza Save, subiri dakika 1–2, kisha jaribu tena kuongeza device.`
      );
    }
    return (
      `Device imehifadhiwa lakini Omada haijai-adopt bado. Hakikisha Inform URL ni ${CONTROLLER_INFORM_HOST} na AP iko online, kisha jaribu tena.`
    );
  }

  return null;
}

export function buildInformUrlPendingUserMessage(): string {
  return (
    `Device imehifadhiwa hapa lakini bado iko Pending kwa sababu AP haijatumii controller yetu. ` +
    `Kwenye ukurasa wa AP (tplinkeap.net): System → Controller Settings → weka Inform URL: ${CONTROLLER_INFORM_HOST} → Save. ` +
    `Subiri dakika 1–2, kisha jaribu tena kuongeza device.`
  );
}
