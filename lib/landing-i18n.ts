export type Locale = "en" | "sw";

/** Public paths — spaces encoded for Next/Image and browsers */
export const OMADA_HARDWARE_IMAGES = [
  encodeURI("/images/image copy 2.png"),
  encodeURI("/images/image copy 3.png"),
  encodeURI("/images/image copy.png"),
  encodeURI("/images/image.png"),
] as const;

export type LandingCopy = {
  languageSwitch: { enShort: string; swShort: string; aria: string };
  nav: {
    /** In-page anchors (same URL) */
    sectionLinks: { label: string; href: string }[];
    /** Full routes (e.g. /docs) — shown separately in the header */
    siteLinks: { label: string; href: string }[];
    sectionsLabel: string;
    siteLabel: string;
    tagline: string;
    signIn: string;
    signUp: string;
    getStarted: string;
  };
  hero: {
    poweredBy: string;
    h1: [string, string, string];
    sub: string;
    subHighlight: string;
    ctaPrimary: string;
    ctaSecondary: string;
    stats: { label: string }[];
    scroll: string;
  };
  hardware: {
    badge: string;
    title: string;
    titleGrad: string;
    subtitle: string;
    prev: string;
    next: string;
    dotLabel: (n: number) => string;
    slides: { title: string; desc: string }[];
  };
  benefits: {
    badge: string;
    title: string;
    titleGrad: string;
    sub: string;
    learnMore: string;
    items: { title: string; desc: string }[];
  };
  howItWorks: {
    badge: string;
    title: string;
    titleGrad: string;
    sub: string;
    steps: { num: string; title: string; desc: string }[];
  };
  features: {
    badge: string;
    title: string;
    titleGrad: string;
    sub: string;
    items: { title: string; desc: string; tag: string }[];
  };
  pricing: {
    badge: string;
    title: string;
    titleGrad: string;
    sub: string;
    mostPopular: string;
    ctaFree: string;
    ctaPaid: string;
    loadingPlans: string;
    plansLoadError: string;
    trialDays: string;
    plans: { name: string; desc: string; cta: string; features: string[] }[];
  };
  testimonials: {
    badge: string;
    title: string;
    titleGrad: string;
    items: { name: string; role: string; location: string; text: string; stars: number }[];
  };
  demo: {
    badge: string;
    title: string;
    titleGrad: string;
    sub: string;
    portalTitle: string;
    portalWelcome: string;
    payNote: string;
    footnote: string;
    packages: { name: string; price: string; featured?: boolean }[];
  };
  faq: {
    badge: string;
    title: string;
    titleGrad: string;
    items: { q: string; a: string }[];
  };
  cta: {
    title: string;
    titleLine2: string;
    sub: string;
    primary: string;
    secondary: string;
  };
  footer: {
    blurb: string;
    product: string;
    company: string;
    contact: string;
    productLinks: { label: string; href: string }[];
  };
};

const en: LandingCopy = {
  languageSwitch: {
    enShort: "EN",
    swShort: "SW",
    aria: "Switch language",
  },
  nav: {
    sectionLinks: [
      { label: "Hardware", href: "#hardware" },
      { label: "Benefits", href: "#benefits" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
    siteLinks: [{ label: "Docs", href: "/docs" }],
    sectionsLabel: "Product",
    siteLabel: "Resources",
    tagline: "Omada WiFi billing",
    signIn: "Sign In",
    signUp: "Sign up",
    getStarted: "Get Started",
  },
  hero: {
    poweredBy: "Built for Omada Wi‑Fi hotspots",
    h1: ["Sell WiFi", "With Less Effort,", "More Revenue"],
    sub: "Branded captive portal, mobile-money payments, and full control of your access points — everything you need to run paid guest Wi‑Fi from one dashboard.",
    subHighlight: "Start earning from your hotspot today.",
    ctaPrimary: "Start free",
    ctaSecondary: "Watch demo",
    stats: [{ label: "Active resellers" }, { label: "WiFi users" }, { label: "Uptime" }],
    scroll: "Scroll",
  },
  hardware: {
    badge: "Omada hardware",
    title: "Built for",
    titleGrad: "real venues",
    subtitle: "From indoor ceiling APs to outdoor Wi-Fi 6 — SSDomada pairs with the Omada ecosystem your customers already trust.",
    prev: "Previous slide",
    next: "Next slide",
    dotLabel: (n) => `Go to slide ${n}`,
    slides: [
      {
        title: "Omada EAP245 — AC1750 ceiling AP",
        desc: "MU-MIMO gigabit ceiling mount — ideal for busy cafés, offices, and retail.",
      },
      {
        title: "Omada EAP610-Outdoor — AX1800 Wi-Fi 6",
        desc: "Indoor/outdoor Wi-Fi 6 with IP67 sealing for courtyards, pools, and campuses.",
      },
      {
        title: "Omada EAP225-Outdoor — AC1200",
        desc: "Dual-antenna outdoor AP with mesh-style coverage and centralized cloud control.",
      },
      {
        title: "Omada EAP110-Outdoor — 300 Mbps N",
        desc: "Cost-effective outdoor coverage with PoE, long range, and IP65 weather resistance.",
      },
    ],
  },
  benefits: {
    badge: "Why SSDomada",
    title: "Why operators",
    titleGrad: "choose us",
    sub: "We turn paid WiFi into a simple, secure, profitable line of business.",
    learnMore: "Learn more",
    items: [
      {
        title: "Less manual work",
        desc: "Stop selling vouchers by hand. Payments, sessions, and expiry run automatically end to end.",
      },
      {
        title: "Daily revenue visibility",
        desc: "See sales as they happen in your dashboard — no more guessing what you earned today.",
      },
      {
        title: "Direct Omada control",
        desc: "Connect your Omada controller and manage locations, access points, and live status from one dashboard.",
      },
      {
        title: "Branded captive portal",
        desc: "Your logo, colors, and welcome copy — customers see a polished, professional login page.",
      },
      {
        title: "Fast withdrawals",
        desc: "Request a payout to M-Pesa, Airtel Money, or bank — tracked from request to completion.",
      },
      {
        title: "Enterprise-grade security",
        desc: "Encrypted connections and automatic session control so guest access stays secure and predictable.",
      },
    ],
  },
  howItWorks: {
    badge: "How it works",
    title: "Five steps to",
    titleGrad: "paid WiFi",
    sub: "The full reseller journey — from registration and plan choice through Omada setup to your first customer payment.",
    steps: [
      {
        num: "01",
        title: "Sign up & choose your plan",
        desc: "Create your reseller account (name, email, password, company & brand), then pick Starter, Pro, or Enterprise — start with a free trial or pay online on the plan page.",
      },
      {
        num: "02",
        title: "Connect your Omada network",
        desc: "Add locations (sites), adopt access points on your controller, and set up the guest SSID in the dashboard so SSDomada knows your venue.",
      },
      {
        num: "03",
        title: "Packages & captive portal",
        desc: "Create WiFi packages (hourly, daily, weekly…) for guests and brand your captive portal — logo, colors, welcome text, and public portal URL.",
      },
      {
        num: "04",
        title: "Send setup details to our team",
        desc: "From Captive portal, send your location, devices, and notes to our team. We wire up the guest sign-in page on your Omada Wi‑Fi so customers can pay and go online.",
      },
      {
        num: "05",
        title: "Go live & get paid",
        desc: "Guests connect, pick a package, and pay with M‑Pesa or Airtel Money. Access turns on automatically — you track revenue and request withdrawals from your dashboard.",
      },
    ],
  },
  features: {
    badge: "Features",
    title: "Everything you need to",
    titleGrad: "monetize WiFi",
    sub: "Billing, branding, operations, and payouts in one product.",
    items: [
      {
        title: "Multi-site management",
        desc: "Operate many venues from one console — each site keeps its own APs and policies.",
        tag: "Omada",
      },
      {
        title: "Custom captive portal",
        desc: "Branded splash pages with templates or custom CSS so the experience matches your venue.",
        tag: "Branding",
      },
      {
        title: "Mobile money & cards",
        desc: "M‑Pesa, Airtel Money, cards, and QR — payments confirm automatically so you rarely chase receipts.",
        tag: "Payments",
      },
      {
        title: "Package designer",
        desc: "Duration, throughput caps, data limits, and concurrent devices — tuned per package.",
        tag: "Config",
      },
      {
        title: "Live monitoring",
        desc: "See who is online, how much data they used, and session quality in near real time.",
        tag: "Live",
      },
      {
        title: "Automatic expiry",
        desc: "When a package expires, guest access ends on schedule — no spreadsheets or midnight logouts.",
        tag: "Auto",
      },
      {
        title: "Analytics & exports",
        desc: "Revenue trends, subscriber growth, popular plans, and CSV exports for accounting.",
        tag: "Data",
      },
      {
        title: "Withdrawals",
        desc: "Request mobile-money or bank payouts with audit-friendly status for every transfer.",
        tag: "Payouts",
      },
    ],
  },
  pricing: {
    badge: "Pricing",
    title: "Plans that",
    titleGrad: "scale with you",
    sub: "Start free, upgrade when you grow. No surprise platform fees on the Starter tier.",
    mostPopular: "Most popular",
    ctaFree: "Start free",
    ctaPaid: "Get started",
    loadingPlans: "Loading plans…",
    plansLoadError: "Could not load plans. Please refresh the page.",
    trialDays: "{days}-day free trial",
    plans: [
      {
        name: "Starter",
        desc: "For new hotspots — try the full stack at zero platform cost.",
        cta: "Start free",
        features: [
          "1 site",
          "3 access points",
          "Basic captive portal",
          "Mobile-money payments",
          "Email support",
          "1 reseller seat",
        ],
      },
      {
        name: "Pro",
        desc: "Growing ISPs and venue chains that need branding and deeper analytics.",
        cta: "Choose Pro",
        features: [
          "5 sites",
          "Unlimited APs",
          "Custom portal branding",
          "Payments & withdrawals",
          "Priority support",
          "5 reseller seats",
          "Analytics dashboard",
          "Voucher codes",
        ],
      },
      {
        name: "Enterprise",
        desc: "National rollouts, SLAs, and bespoke integrations with dedicated success engineers.",
        cta: "Talk to sales",
        features: [
          "Unlimited sites",
          "Unlimited APs",
          "Full portal white-label",
          "Payments & bank payouts",
          "24/7 phone support",
          "Unlimited reseller seats",
          "Advanced analytics",
          "Custom integrations",
          "SLA-backed uptime",
        ],
      },
    ],
  },
  testimonials: {
    badge: "Testimonials",
    title: "What operators",
    titleGrad: "say",
    items: [
      {
        name: "James M.",
        role: "Hostel owner",
        location: "Dar es Salaam",
        text: "Since switching to SSDomada our WiFi revenue tripled. Guests love the branded portal and M-Pesa checkout is instant.",
        stars: 5,
      },
      {
        name: "Amina H.",
        role: "Café manager",
        location: "Arusha",
        text: "The captive portal makes us look like a serious venue. Hourly plans sell themselves and the platform runs on autopilot.",
        stars: 5,
      },
      {
        name: "Peter K.",
        role: "ISP operator",
        location: "Mwanza",
        text: "Multi-site management saves hours every week. Fifteen sites in one dashboard and withdrawals land in M-Pesa without drama.",
        stars: 5,
      },
    ],
  },
  demo: {
    badge: "Live demo",
    title: "See the",
    titleGrad: "guest experience",
    sub: "From splash page to payment to online — exactly what your customers see on their phones.",
    portalTitle: "FastNet WiFi",
    portalWelcome: "Welcome! Pick a plan and pay with M-Pesa or Airtel Money.",
    payNote: "Checkout via M-Pesa / Airtel Money",
    footnote: "Illustrative captive portal — yours will show your brand, your packages, and your payment options.",
    packages: [
      { name: "1 hour basic", price: "TZS 500" },
      { name: "Daily unlimited", price: "TZS 2,000", featured: true },
      { name: "Weekly standard", price: "TZS 10,000" },
      { name: "Monthly premium", price: "TZS 30,000" },
    ],
  },
  faq: {
    badge: "FAQ",
    title: "Common",
    titleGrad: "questions",
    items: [
      {
        q: "Does SSDomada work with every Omada EAP?",
        a: "Yes. Connect your Omada controller and we sync your locations, guest Wi‑Fi names, and connected devices. Popular access points include EAP653, EAP670, EAP773, and outdoor models.",
      },
      {
        q: "What do I need to launch?",
        a: "An Omada controller, compatible TP‑Link access points, and a guest Wi‑Fi network you want to monetize. Choose a plan in SSDomada, add your sites and devices, then send us a setup request — we help you go live.",
      },
      {
        q: "How fast do payouts hit my wallet?",
        a: "Guest payments by mobile money usually confirm in seconds. Your earnings appear in the dashboard; withdrawals are processed on a business schedule and tracked step by step.",
      },
      {
        q: "Can I fully brand the captive portal?",
        a: "Absolutely — upload your logo, set colors, edit welcome copy, and optionally inject custom CSS for pixel-perfect venues.",
      },
      {
        q: "Will the platform scale with heavy usage?",
        a: "Yes. SSDomada is built for busy venues — many guests online at once across multiple locations, with monitoring and exports when you need them.",
      },
      {
        q: "Can I export usage and billing data?",
        a: "Yes. Dashboards show live usage, and you can export subscriber and payment history for finance or regulators.",
      },
    ],
  },
  cta: {
    title: "Start earning from",
    titleLine2: "your WiFi today",
    sub: "Join hundreds of resellers who run paid WiFi on Omada without duct-taped spreadsheets. No credit card required to explore Starter.",
    primary: "Start free now",
    secondary: "Contact sales",
  },
  footer: {
    blurb: "Paid guest Wi‑Fi for Omada hotspots — captive portal, payments, multi‑site tools, and a reseller dashboard in one place.",
    product: "Product",
    company: "Company",
    contact: "Contact",
    productLinks: [
      { label: "Hardware", href: "#hardware" },
      { label: "Benefits", href: "#benefits" },
      { label: "Pricing", href: "#pricing" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Demo", href: "#demo" },
      { label: "API docs", href: "/docs" },
    ],
  },
};

const sw: LandingCopy = {
  languageSwitch: {
    enShort: "EN",
    swShort: "SW",
    aria: "Badili lugha",
  },
  nav: {
    sectionLinks: [
      { label: "Vifaa", href: "#hardware" },
      { label: "Faida", href: "#benefits" },
      { label: "Jinsi inavyofanya", href: "#how-it-works" },
      { label: "Vipengele", href: "#features" },
      { label: "Bei", href: "#pricing" },
      { label: "Maswali", href: "#faq" },
    ],
    siteLinks: [{ label: "Nyaraka", href: "/docs" }],
    sectionsLabel: "Bidhaa",
    siteLabel: "Rasilimali",
    tagline: "Malipo ya WiFi ya Omada",
    signIn: "Ingia",
    signUp: "Jisajili",
    getStarted: "Anza",
  },
  hero: {
    poweredBy: "Imeundwa kwa hotspot za Omada",
    h1: ["Uza WiFi", "Kwa Urahisi,", "Mapato Zaidi"],
    sub: "Captive portal yenye chapa yako, malipo ya simu, na udhibiti wa access point zako — kila kitu cha WiFi ya kulipia kwa wageni kutoka dashibodi moja.",
    subHighlight: "Anza kupata mapato leo kutoka hotspot yako.",
    ctaPrimary: "Anza bure",
    ctaSecondary: "Tazama demo",
    stats: [{ label: "Wauzaji hai" }, { label: "Watumiaji wa WiFi" }, { label: "Uptime" }],
    scroll: "Sogeza",
  },
  hardware: {
    badge: "Vifaa vya Omada",
    title: "Imeundwa kwa",
    titleGrad: "maeneo halisi",
    subtitle: "Kutoka AP za ndani hadi Wi-Fi 6 nje — SSDomada inafanya kazi na mfumo wa Omada ambao wateja wako wanauamini.",
    prev: "Picha iliyopita",
    next: "Picha inayofuata",
    dotLabel: (n) => `Nenda kwenye picha ${n}`,
    slides: [
      {
        title: "Omada EAP245 — AC1750 (ceiling)",
        desc: "MU-MIMO gigabit — bora kwa mikahawa, ofisi, na maduka yenye wateja wengi.",
      },
      {
        title: "Omada EAP610-Outdoor — AX1800 Wi-Fi 6",
        desc: "Wi-Fi 6 ya ndani/nje na IP67 — bustani, pool, na kampasi.",
      },
      {
        title: "Omada EAP225-Outdoor — AC1200",
        desc: "AP ya nje na antena mbili, mesh, na usimamizi wa wingu.",
      },
      {
        title: "Omada EAP110-Outdoor — 300 Mbps N",
        desc: "Gharama nafuu, masafa marefu, PoE, na IP65 dhidi ya mvua.",
      },
    ],
  },
  benefits: {
    badge: "Kwa nini SSDomada",
    title: "Kwa nini wachagua",
    titleGrad: "SSDomada",
    sub: "Tunafanya WiFi ya kulipia kuwa rahisi, salama, na yenye faida.",
    learnMore: "Jifunze zaidi",
    items: [
      {
        title: "Punguza kazi ya mkono",
        desc: "Acha kuuza voucher kwa mikono. Malipo, session, na muda wa mwisho hufanywa kiotomatiki.",
      },
      {
        title: "Mapato kila siku",
        desc: "Ona mauzo yanapofanyika kwenye dashibodi — bila kubahatisha umepata kiasi gani leo.",
      },
      {
        title: "Udhibiti wa Omada",
        desc: "Unganisha controller yako ya Omada na simamie maeneo, access point, na hali ya mtandao kutoka dashibodi moja.",
      },
      {
        title: "Captive portal ya chapa",
        desc: "Logo, rangi, na karibu — wateja wanaona ukurasa wa kitaalamu.",
      },
      {
        title: "Uondoaji wa haraka",
        desc: "Omba malipo ya M-Pesa, Airtel Money, au benki — kila hatua inafuatiliwa.",
      },
      {
        title: "Usalama thabiti",
        desc: "Muunganisho salama na muda wa mwisho wa kiotomatiki ili ufikiaji wa wageni uwe thabiti na salama.",
      },
    ],
  },
  howItWorks: {
    badge: "Jinsi inavyofanya",
    title: "Hatua 5 hadi",
    titleGrad: "WiFi ya kulipia",
    sub: "Safari kamili ya reseller — kutoka usajili na chaguo la plan hadi usanidi wa Omada na malipo ya kwanza ya mteja.",
    steps: [
      {
        num: "01",
        title: "Jisajili & chagua plan",
        desc: "Fungua akaunti ya reseller (jina, barua pepe, nenosiri, kampuni na brand), kisha chagua Starter, Pro au Enterprise — jaribio bure au lipa mtandaoni kwenye ukurasa wa plan.",
      },
      {
        num: "02",
        title: "Unganisha mtandao wa Omada",
        desc: "Ongeza maeneo (sites), adopt access points kwenye controller yako, na sanidi SSID ya wageni kwenye dashibodi.",
      },
      {
        num: "03",
        title: "Vifurushi & captive portal",
        desc: "Tengeneza vifurushi vya WiFi kwa wageni na weka chapa kwenye portal yako — nembo, rangi, ujumbe wa kukaribisha, na URL ya portal.",
      },
      {
        num: "04",
        title: "Tuma maelezo kwa timu yetu",
        desc: "Kwenye Captive portal, tuma eneo, vifaa, na maelezo kwa timu yetu. Tunasanidi ukurasa wa kuingia kwa wageni kwenye WiFi yako ya Omada ili waweze kulipa na kuunganishwa.",
      },
      {
        num: "05",
        title: "Anza kupata mapato",
        desc: "Wageni huunganishwa, huchagua kifurushi, na kulipa kwa M-Pesa au Airtel Money. Mtandao unawashwa kiotomatiki — unafuatilia mapato na kuomba malipo ya nje kwenye dashibodi.",
      },
    ],
  },
  features: {
    badge: "Vipengele",
    title: "Kila kitu unachohitaji",
    titleGrad: "kufanya mapato",
    sub: "Malipo, chapa, uendeshaji, na malipo ya nje katika mfumo mmoja.",
    items: [
      {
        title: "Usimamizi wa maeneo mengi",
        desc: "Simamia maeneo mengi kutoka konsoli moja — kila eneo lina AP na sera zake.",
        tag: "Omada",
      },
      {
        title: "Captive portal maalum",
        desc: "Ukurasa wa kuingia wenye chapa yako — templates au CSS maalum.",
        tag: "Branding",
      },
      {
        title: "Malipo ya simu & kadi",
        desc: "M-Pesa, Airtel Money, kadi, QR — malipo yanathibitishwa kiotomatiki bila kufuatilia risiti kwa mkono.",
        tag: "Payments",
      },
      {
        title: "Mbunifu wa vifurushi",
        desc: "Muda, kasi, kikomo cha data, na idadi ya vifaa — kwa kila kifurushi.",
        tag: "Config",
      },
      {
        title: "Ufuatiliaji wa moja kwa moja",
        desc: "Ona nani yuko mtandaoni na matumizi ya data karibu kwa wakati halisi.",
        tag: "Live",
      },
      {
        title: "Mwisho wa muda kiotomatiki",
        desc: "Kifurushi kinapomalizika, ufikiaji wa mgeni unaisha kwa ratiba — bila hesabu za mkono.",
        tag: "Auto",
      },
      {
        title: "Takwimu na hamisho",
        desc: "Mwelekeo wa mapato, ukuaji, vifurushi maarufu, na CSV.",
        tag: "Data",
      },
      {
        title: "Uondoaji wa fedha",
        desc: "Omba malipo ya simu au benki na hali ya kila uhamisho.",
        tag: "Payouts",
      },
    ],
  },
  pricing: {
    badge: "Bei",
    title: "Mipango inayokufaa",
    titleGrad: "unapokua",
    sub: "Anza bure, boresha unapohitaji. Hakuna ada za kujificha kwenye Starter.",
    mostPopular: "Maarufu zaidi",
    ctaFree: "Anza bure",
    ctaPaid: "Anza sasa",
    loadingPlans: "Inapakia mipango…",
    plansLoadError: "Mipango haijapakiwa. Onyesha upya ukurasa.",
    trialDays: "Jaribio la bure siku {days}",
    plans: [
      {
        name: "Starter",
        desc: "Kwa anayeanza — jaribu mfumo mzima bure.",
        cta: "Anza bure",
        features: [
          "Eneo 1",
          "Access point 3",
          "Captive portal ya msingi",
          "Malipo ya simu",
          "Msaada wa barua pepe",
          "Kiti 1 cha reseller",
        ],
      },
      {
        name: "Pro",
        desc: "Kwa biashara zinazokua — chapa na takwimu kina zaidi.",
        cta: "Chagua Pro",
        features: [
          "Maeneo 5",
          "AP bila kikomo",
          "Chapa ya portal maalum",
          "Malipo + malipo ya nje",
          "Msaada wa kipaumbele",
          "Vitio 5 vya reseller",
          "Dashibodi ya takwimu",
          "Mfumo wa voucher",
        ],
      },
      {
        name: "Enterprise",
        desc: "Kwa wanaotuma taifa, SLA, na muunganisho maalum.",
        cta: "Wasiliana nasi",
        features: [
          "Maeneo bila kikomo",
          "AP bila kikomo",
          "Portal nyeupe kabisa",
          "Malipo & benki",
          "Simu 24/7",
          "Vitio bila kikomo",
          "Takwimu za hali ya juu",
          "Muunganisho maalum",
          "SLA ya uptime",
        ],
      },
    ],
  },
  testimonials: {
    badge: "Shuhuda",
    title: "Wanasema",
    titleGrad: "nini",
    items: [
      {
        name: "James M.",
        role: "Mmiliki wa hostel",
        location: "Dar es Salaam",
        text: "Tangu SSDomada mapato ya WiFi yameongezeka mara tatu. Wageni wanapenda portal na M-Pesa ni papo hapo.",
        stars: 5,
      },
      {
        name: "Amina H.",
        role: "Meneja wa kahawa",
        location: "Arusha",
        text: "Captive portal inatuonyesha kitaalamu. Vifurushi vya saa vinauzika vyenyewe na mfumo hujisimamia.",
        stars: 5,
      },
      {
        name: "Peter K.",
        role: "Mtoa huduma wa intaneti",
        location: "Mwanza",
        text: "Maeneo 15 kwenye dashibodi moja. Uondoaji wa fedha unafika M-Pesa bila shida.",
        stars: 5,
      },
    ],
  },
  demo: {
    badge: "Demo",
    title: "Ona",
    titleGrad: "uhudumu wa mgeni",
    sub: "Kutoka ukurasa wa kuingia hadi malipo hadi mtandao — kile mteja anaona simuni.",
    portalTitle: "FastNet WiFi",
    portalWelcome: "Karibu! Chagua kifurushi na ulipe kwa M-Pesa au Airtel Money.",
    payNote: "Malipo kwa M-Pesa / Airtel Money",
    footnote: "Mfano wa captive portal — wako utaonyesha chapa yako, vifurushi vyako, na njia zako za malipo.",
    packages: [
      { name: "Saa 1 — msingi", price: "TZS 500" },
      { name: "Siku — bila kikomo", price: "TZS 2,000", featured: true },
      { name: "Wiki — wastani", price: "TZS 10,000" },
      { name: "Mwezi — premium", price: "TZS 30,000" },
    ],
  },
  faq: {
    badge: "Maswali",
    title: "Yanayoulizwa",
    titleGrad: "mara kwa mara",
    items: [
      {
        q: "SSDomada inafanya kazi na Omada EAP yoyote?",
        a: "Ndiyo. Unganisha controller yako ya Omada na tunasawazisha maeneo, majina ya WiFi ya wageni, na vifaa vilivyounganishwa. EAP653, EAP670, EAP773, na modeli za nje.",
      },
      {
        q: "Ninahitaji nini kuanza?",
        a: "Controller ya Omada, access point za TP-Link, na mtandao wa WiFi wa wageni unaotaka kulipisha. Chagua plan kwenye SSDomada, ongeza maeneo na vifaa, kisha tutusaidie kuanza.",
      },
      {
        q: "Malipo yanachukua muda gani?",
        a: "Malipo ya simu yanathibitishwa haraka. Uondoaji unafuatiliwa ndani ya SSDomada.",
      },
      {
        q: "Ninaweza kuweka chapa yangu?",
        a: "Ndio — logo, rangi, maandishi, na CSS maalum ikiwa unahitaji.",
      },
      {
        q: "Je, mfumo unastahimili mzigo mkubwa?",
        a: "Ndiyo. Imeundwa kwa maeneo yenye wageni wengi — wageni wengi mtandaoni kwa wakati mmoja katika maeneo mengi, na takwimu unazohitaji.",
      },
      {
        q: "Ninaweza kutoa data?",
        a: "Ndiyo. Takwimu za matumizi na malipo zinaweza kuhamishwa CSV.",
      },
    ],
  },
  cta: {
    title: "Anza kupata mapato",
    titleLine2: "kutoka WiFi yako leo",
    sub: "Jiunge na mamia ya reseller bila hesabu za mkono. Hakuna kadi ya mkopo kuanza Starter.",
    primary: "Anza bure sasa",
    secondary: "Wasiliana nasi",
  },
  footer: {
    blurb: "WiFi ya kulipia kwa wageni kwenye Omada — captive portal, malipo, zana za maeneo mengi, na dashibodi ya reseller.",
    product: "Bidhaa",
    company: "Kampuni",
    contact: "Mawasiliano",
    productLinks: [
      { label: "Vifaa", href: "#hardware" },
      { label: "Faida", href: "#benefits" },
      { label: "Bei", href: "#pricing" },
      { label: "Jinsi inavyofanya", href: "#how-it-works" },
      { label: "Demo", href: "#demo" },
      { label: "API docs", href: "/docs" },
    ],
  },
};

export function landingCopy(locale: Locale): LandingCopy {
  return locale === "sw" ? sw : en;
}
