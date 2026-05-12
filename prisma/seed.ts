import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ============================================================
  // 1. SUPER ADMIN
  // ============================================================
  const adminPassword = await bcrypt.hash("Admin@2026", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@ssdomada.com" },
    update: {},
    create: {
      email: "admin@ssdomada.com",
      name: "Super Admin",
      phone: "+255700000000",
      role: "SUPER_ADMIN",
      password: adminPassword,
      emailVerified: new Date(),
    },
  });
  console.log(`✅ Super Admin: ${admin.email} (password: Admin@2026)`);

  // ============================================================
  // 2. TEST RESELLER USER
  // ============================================================
  const resellerPassword = await bcrypt.hash("Reseller@2026", 12);

  const resellerUser = await prisma.user.upsert({
    where: { email: "reseller@ssdomada.com" },
    update: {},
    create: {
      email: "reseller@ssdomada.com",
      name: "John Mwamba",
      phone: "+255712345678",
      role: "RESELLER",
      password: resellerPassword,
      emailVerified: new Date(),
    },
  });
  console.log(`✅ Reseller User: ${resellerUser.email} (password: Reseller@2026)`);

  // ============================================================
  // 3. RESELLER PROFILE
  // ============================================================
  const reseller = await prisma.reseller.upsert({
    where: { userId: resellerUser.id },
    update: {},
    create: {
      userId: resellerUser.id,
      companyName: "FastNet WiFi",
      brandSlug: "fastnet",
      phone: "+255712345678",
      address: "Dar es Salaam, Tanzania",
      commissionRate: 0.15, // 15% platform fee
      currency: "TZS",
      isActive: true,
      walletBalance: 0,
      totalEarnings: 0,
    },
  });
  console.log(`✅ Reseller Profile: ${reseller.companyName} (slug: ${reseller.brandSlug})`);

  // ============================================================
  // 4. SITE (linked to Omada)
  // ============================================================
  const site = await prisma.site.upsert({
    where: { id: "seed-site-1" },
    update: {},
    create: {
      id: "seed-site-1",
      resellerId: reseller.id,
      name: "FastNet - Main Branch",
      omadaSiteId: "6a023987b18cb07f8caf931e", // Real Omada site ID
      location: "Dar es Salaam CBD",
    },
  });
  console.log(`✅ Site: ${site.name} (omadaSiteId: ${site.omadaSiteId})`);

  // ============================================================
  // 5. WIFI PACKAGES
  // ============================================================
  const packages = [
    {
      name: "1 Hour Basic",
      description: "1 hour internet access - basic speed",
      price: 500,
      duration: "HOUR_1" as const,
      durationMinutes: 60,
      speedLimitDown: 5000, // 5 Mbps
      speedLimitUp: 2000,   // 2 Mbps
      dataLimitMb: 500,     // 500 MB
      maxDevices: 1,
      sortOrder: 1,
      isFeatured: false,
    },
    {
      name: "Daily Unlimited",
      description: "24 hours unlimited internet - fast speed",
      price: 2000,
      duration: "HOURS_24" as const,
      durationMinutes: 1440,
      speedLimitDown: 10000, // 10 Mbps
      speedLimitUp: 5000,    // 5 Mbps
      dataLimitMb: null,
      maxDevices: 2,
      sortOrder: 2,
      isFeatured: true,
    },
    {
      name: "Weekly Standard",
      description: "7 days internet access with good speed",
      price: 10000,
      duration: "DAYS_7" as const,
      durationMinutes: 10080,
      speedLimitDown: 15000, // 15 Mbps
      speedLimitUp: 7000,    // 7 Mbps
      dataLimitMb: null,
      maxDevices: 3,
      sortOrder: 3,
      isFeatured: true,
    },
    {
      name: "Monthly Premium",
      description: "30 days premium internet - fastest speed",
      price: 30000,
      duration: "DAYS_30" as const,
      durationMinutes: 43200,
      speedLimitDown: 25000, // 25 Mbps
      speedLimitUp: 10000,   // 10 Mbps
      dataLimitMb: null,
      maxDevices: 5,
      sortOrder: 4,
      isFeatured: false,
    },
  ];

  for (const pkg of packages) {
    await prisma.package.upsert({
      where: {
        id: `seed-pkg-${pkg.sortOrder}`,
      },
      update: {},
      create: {
        id: `seed-pkg-${pkg.sortOrder}`,
        resellerId: reseller.id,
        name: pkg.name,
        description: pkg.description,
        price: pkg.price,
        currency: "TZS",
        duration: pkg.duration,
        durationMinutes: pkg.durationMinutes,
        speedLimitDown: pkg.speedLimitDown,
        speedLimitUp: pkg.speedLimitUp,
        dataLimitMb: pkg.dataLimitMb,
        maxDevices: pkg.maxDevices,
        sortOrder: pkg.sortOrder,
        isFeatured: pkg.isFeatured,
        isActive: true,
      },
    });
    console.log(`✅ Package: ${pkg.name} — TZS ${pkg.price.toLocaleString()}`);
  }

  // ============================================================
  // 6. CAPTIVE PORTAL CONFIG
  // ============================================================
  await prisma.captivePortalConfig.upsert({
    where: { resellerId: reseller.id },
    update: {},
    create: {
      resellerId: reseller.id,
      companyName: "FastNet WiFi",
      bgColor: "#1a1a2e",
      primaryColor: "#0f3460",
      accentColor: "#e94560",
      welcomeText: "Karibu FastNet WiFi! Chagua package na ulipe kwa M-Pesa au Airtel Money.",
      termsUrl: "https://fastnet.ssdomada.com/terms",
    },
  });
  console.log(`✅ Captive Portal Config for ${reseller.companyName}`);

  // ============================================================
  // 7. SYSTEM SETTINGS
  // ============================================================
  const settings = [
    { key: "platform_name", value: "SSDomada" },
    { key: "platform_currency", value: "TZS" },
    { key: "default_commission_rate", value: "0.15" },
    { key: "min_withdrawal_amount", value: "5000" },
    { key: "max_withdrawal_amount", value: "5000000" },
    { key: "support_email", value: "support@ssdomada.com" },
    { key: "support_phone", value: "+255700000000" },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }
  console.log(`✅ System Settings: ${settings.length} entries`);

  // ============================================================
  // 8. RESELLER PLANS (SSDomada pricing tiers)
  // ============================================================
  const plans = [
    {
      slug: "starter",
      name: "Starter",
      description: "Perfect for new resellers — get started in minutes.",
      price: 0,
      interval: "MONTHLY" as const,
      trialDays: 14,
      maxSites: 1,
      maxDevices: 3,
      maxActiveClients: 50,
      maxStaff: 1,
      customBranding: false,
      sortOrder: 1,
      isFeatured: false,
    },
    {
      slug: "growth",
      name: "Growth",
      description: "Best value — for established hotspot businesses.",
      price: 25000,
      interval: "MONTHLY" as const,
      trialDays: 7,
      maxSites: 5,
      maxDevices: 20,
      maxActiveClients: 500,
      maxStaff: 3,
      customBranding: true,
      smsNotifications: true,
      sortOrder: 2,
      isFeatured: true,
    },
    {
      slug: "enterprise",
      name: "Enterprise",
      description: "Unlimited scale, priority support, full API access.",
      price: 100000,
      interval: "MONTHLY" as const,
      trialDays: 0,
      maxSites: null,
      maxDevices: null,
      maxActiveClients: null,
      maxStaff: null,
      customBranding: true,
      customDomain: true,
      smsNotifications: true,
      prioritySupport: true,
      apiAccess: true,
      sortOrder: 3,
      isFeatured: false,
    },
  ];

  let starterPlanId = "";
  for (const p of plans) {
    const row = await prisma.resellerPlan.upsert({
      where: { slug: p.slug },
      update: { ...p, isActive: true },
      create: { ...p, isActive: true },
    });
    if (p.slug === "starter") starterPlanId = row.id;
    console.log(`✅ Reseller Plan: ${row.name} — TZS ${row.price.toLocaleString()}/${row.interval.toLowerCase()}`);
  }

  // Give test reseller a trial subscription on Starter
  if (starterPlanId) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await prisma.resellerPlanSubscription.upsert({
      where: { resellerId: reseller.id },
      update: {},
      create: {
        resellerId: reseller.id,
        planId: starterPlanId,
        status: "TRIAL",
        currentPeriodEnd: trialEnd,
        trialEndsAt: trialEnd,
      },
    });
    console.log(`✅ Reseller Plan Subscription: ${reseller.companyName} → Starter (TRIAL)`);
  }

  // ============================================================
  // 9. SAMPLE END USER (WiFi customer)
  // ============================================================
  const endUserPassword = await bcrypt.hash("User@2026", 12);

  const endUser = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      name: "Amina Hassan",
      phone: "+255787654321",
      role: "END_USER",
      password: endUserPassword,
      emailVerified: new Date(),
    },
  });
  console.log(`✅ End User: ${endUser.email} (password: User@2026)`);

  console.log("\n🎉 Seed completed successfully!\n");
  console.log("=== Login Credentials ===");
  console.log("Super Admin:  admin@ssdomada.com / Admin@2026");
  console.log("Reseller:     reseller@ssdomada.com / Reseller@2026");
  console.log("End User:     customer@example.com / User@2026");
  console.log("\nCaptive Portal URL: http://localhost:3000/api/portal/fastnet");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
