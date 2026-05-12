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
    poweredBy: "Powered by TP-Link Omada + Snippe Payments",
    h1: ["Sell WiFi", "With Less Effort,", "More Revenue"],
    sub: "Omada WiFi billing — captive portal, Snippe payments, and full control of your access points from one place.",
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
        desc: "Snippe settles straight to your wallet so you always know what you earned.",
      },
      {
        title: "Direct Omada control",
        desc: "Sync with Omada SDN Controller and manage APs, sites, and status from one dashboard.",
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
        desc: "FreeRADIUS-backed auth, HTTPS, and sensible defaults so subscriber data stays protected.",
      },
    ],
  },
  howItWorks: {
    badge: "How it works",
    title: "Four steps to",
    titleGrad: "paid WiFi",
    sub: "From signup to first payout in a single afternoon.",
    steps: [
      {
        num: "01",
        title: "Sign up as a reseller",
        desc: "Create your account for free, add your business profile, and you are ready to configure.",
      },
      {
        num: "02",
        title: "Connect your Omada stack",
        desc: "Link your Omada SDN Controller — access points and sites appear in SSDomada automatically.",
      },
      {
        num: "03",
        title: "Publish your packages",
        desc: "Define hourly, daily, weekly, or monthly plans with speeds, caps, and device limits.",
      },
      {
        num: "04",
        title: "Customers pay and go online",
        desc: "Guests pick a plan, pay with mobile money or card, and RADIUS provisions access instantly.",
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
        title: "Snippe payments",
        desc: "M-Pesa, Airtel Money, cards, and QR — webhooks mark sessions paid without manual checks.",
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
        desc: "Credentials and RADIUS sessions end on schedule — no spreadsheets or midnight logouts.",
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
    plans: [
      {
        name: "Starter",
        desc: "For new hotspots — try the full stack at zero platform cost.",
        cta: "Start free",
        features: [
          "1 site",
          "3 access points",
          "Basic captive portal",
          "Snippe payments",
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
          "Snippe payments + payouts",
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
          "Snippe + bank disbursements",
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
    footnote: "Illustrative captive portal — yours will use your brand, packages, and Snippe keys.",
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
        a: "Yes. Connect Omada SDN Controller (v5+) and we sync sites, SSIDs, and clients. Popular models include EAP653, EAP670, EAP773, and the outdoor line.",
      },
      {
        q: "What do I need to launch?",
        a: "An Omada SDN Controller (appliance, software, or cloud), compatible TP-Link APs, and a Snippe merchant account for collections. Our docs walk through each step.",
      },
      {
        q: "How fast do payouts hit my wallet?",
        a: "Snippe mobile-money collections typically confirm in seconds. Withdrawals are processed on a business schedule and tracked inside SSDomada.",
      },
      {
        q: "Can I fully brand the captive portal?",
        a: "Absolutely — upload your logo, set colors, edit welcome copy, and optionally inject custom CSS for pixel-perfect venues.",
      },
      {
        q: "Will the platform scale with heavy usage?",
        a: "The stack is built on PostgreSQL, FreeRADIUS, and Redis-backed caching so you can serve thousands of concurrent sessions.",
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
    blurb: "Omada WiFi billing — captive portal, Snippe payments, FreeRADIUS, and reseller tooling in one platform.",
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
    poweredBy: "Imetengenezwa kwa TP-Link Omada + Malipo ya Snippe",
    h1: ["Uza WiFi", "Kwa Urahisi,", "Mapato Zaidi"],
    sub: "Malipo ya WiFi kupitia Omada — captive portal, Snippe, na udhibiti wa access point zako mahali pamoja.",
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
        desc: "Snippe inalipa moja kwa moja kwenye wallet — daima unajua umepata kiasi gani.",
      },
      {
        title: "Udhibiti wa Omada",
        desc: "Unganisha Omada SDN Controller na usimamie AP na maeneo kutoka dashibodi moja.",
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
        desc: "FreeRADIUS, HTTPS, na mipangilio salama kwa data ya wateja.",
      },
    ],
  },
  howItWorks: {
    badge: "Jinsi inavyofanya",
    title: "Hatua 4 hadi",
    titleGrad: "WiFi ya kulipia",
    sub: "Kutoka usajili hadi malipo ya kwanza katika siku moja.",
    steps: [
      {
        num: "01",
        title: "Jisajili kama reseller",
        desc: "Fungua akaunti bure, jaza taarifa za biashara, na uanze kusanidi.",
      },
      {
        num: "02",
        title: "Unganisha Omada yako",
        desc: "Unganisha Omada SDN Controller — AP na maeneo yanaonekana moja kwa moja.",
      },
      {
        num: "03",
        title: "Weka vifurushi vyako",
        desc: "Saa, siku, wiki, mwezi — bei, kasi, kikomo cha data, na vifaa.",
      },
      {
        num: "04",
        title: "Wateja walipa na kuunganishwa",
        desc: "Mgeni achague kifurushi, alipe kwa simu au kadi, na RADIUS ipe idhini papo hapo.",
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
        title: "Malipo ya Snippe",
        desc: "M-Pesa, Airtel Money, kadi, QR — webhook zinakamilisha malipo.",
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
        desc: "Credential na session za RADIUS zinaisha kwa ratiba — bila hesabu za mkono.",
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
    plans: [
      {
        name: "Starter",
        desc: "Kwa anayeanza — jaribu mfumo mzima bure.",
        cta: "Anza bure",
        features: [
          "Eneo 1",
          "Access point 3",
          "Captive portal ya msingi",
          "Malipo ya Snippe",
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
          "Snippe + benki",
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
    footnote: "Mfano wa captive portal — wako utatumia chapa yako, vifurushi, na funguo za Snippe.",
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
        a: "Ndiyo. Unganisha Omada SDN Controller (v5+) na tunasawazisha maeneo na wateja. EAP653, EAP670, EAP773, na nje.",
      },
      {
        q: "Ninahitaji nini kuanza?",
        a: "Omada SDN Controller, access point za TP-Link, na akaunti ya Snippe. Tuna mwongozo kamili.",
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
        a: "Ndiyo. PostgreSQL, FreeRADIUS, na Redis kwa maelfu ya session kwa wakati mmoja.",
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
    blurb: "Malipo ya WiFi ya Omada — captive portal, Snippe, FreeRADIUS, na zana za reseller.",
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
