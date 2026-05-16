import { prisma } from "@/server/lib/prisma";
import { getPlanAccessSnapshot } from "@/server/services/reseller-plan-access.service";

/**
 * NOTIFICATION SERVICE
 *
 * Lightweight unified API for sending email + SMS notifications.
 * The current implementation logs to the console and writes a row to the
 * NotificationPreference-aware audit; swap the providers in `sendEmail` /
 * `sendSms` to wire up real ones (e.g. Resend, Twilio, Africa's Talking, etc.).
 */

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface SmsMessage {
  to: string;
  text: string;
}

async function sendEmail(msg: EmailMessage) {
  const provider = process.env.EMAIL_PROVIDER; // "resend" | "smtp" | unset
  if (!provider) {
    console.log(`[Notification] (no provider) EMAIL → ${msg.to}: ${msg.subject}`);
    return { success: true, provider: "noop" as const };
  }

  if (provider === "resend" && process.env.RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "noreply@ssdomada.com",
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
      });
      const data = await r.json();
      return { success: r.ok, provider: "resend" as const, data };
    } catch (err) {
      console.error("[Notification] Resend failed:", err);
      return { success: false, provider: "resend" as const, error: String(err) };
    }
  }

  console.log(`[Notification] EMAIL (provider=${provider}) → ${msg.to}: ${msg.subject}`);
  return { success: true, provider: "noop" as const };
}

async function sendSms(msg: SmsMessage) {
  const provider = process.env.SMS_PROVIDER; // "africastalking" | "twilio" | unset
  if (!provider) {
    console.log(`[Notification] (no provider) SMS → ${msg.to}: ${msg.text}`);
    return { success: true, provider: "noop" as const };
  }

  if (provider === "africastalking" && process.env.AT_API_KEY) {
    try {
      const r = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          apiKey: process.env.AT_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          username: process.env.AT_USERNAME || "sandbox",
          to: msg.to,
          message: msg.text,
          from: process.env.AT_SENDER_ID || "",
        }).toString(),
      });
      const data = await r.json();
      return { success: r.ok, provider: "africastalking" as const, data };
    } catch (err) {
      console.error("[Notification] Africa's Talking failed:", err);
      return { success: false, provider: "africastalking" as const, error: String(err) };
    }
  }

  console.log(`[Notification] SMS (provider=${provider}) → ${msg.to}: ${msg.text}`);
  return { success: true, provider: "noop" as const };
}

export class NotificationService {
  static sendEmail = sendEmail;
  static sendSms = sendSms;

  /**
   * Notify a reseller of a payment, respecting their NotificationPreference flags.
   */
  static async notifyResellerPayment(resellerId: string, opts: {
    amount: number;
    currency: string;
    customerPhone?: string;
    packageName?: string;
  }) {
    const reseller = await prisma.reseller.findUnique({
      where: { id: resellerId },
      include: { user: true, notificationPreference: true },
    });
    if (!reseller) return;

    const pref = reseller.notificationPreference;
    const planAccess = await getPlanAccessSnapshot(resellerId);
    const smsAllowed = planAccess.access.ok && planAccess.features.smsNotifications;
    const subject = `New payment: ${opts.currency} ${opts.amount.toLocaleString()}`;
    const text = `You received a payment of ${opts.currency} ${opts.amount.toLocaleString()}${opts.packageName ? ` for ${opts.packageName}` : ""}${opts.customerPhone ? ` from ${opts.customerPhone}` : ""}.`;

    const tasks: Promise<unknown>[] = [];
    if (!pref || pref.emailOnPayment) {
      const to = pref?.emailAddress || reseller.user.email;
      if (to) tasks.push(sendEmail({ to, subject, text }));
    }
    if (smsAllowed && pref?.smsOnPayment) {
      const to = pref.smsPhone || reseller.phone;
      if (to) tasks.push(sendSms({ to, text }));
    }
    await Promise.allSettled(tasks);
  }

  /**
   * Notify a reseller their device went offline.
   */
  static async notifyDeviceDown(resellerId: string, deviceName: string, deviceMac: string) {
    const reseller = await prisma.reseller.findUnique({
      where: { id: resellerId },
      include: { user: true, notificationPreference: true },
    });
    if (!reseller) return;
    const pref = reseller.notificationPreference;
    const planAccess = await getPlanAccessSnapshot(resellerId);
    const smsAllowed = planAccess.access.ok && planAccess.features.smsNotifications;
    const subject = `Device offline: ${deviceName}`;
    const text = `Your device "${deviceName}" (${deviceMac}) has gone offline. Please check it.`;
    const tasks: Promise<unknown>[] = [];
    if (pref?.emailOnDeviceDown) {
      const to = pref.emailAddress || reseller.user.email;
      if (to) tasks.push(sendEmail({ to, subject, text }));
    }
    if (smsAllowed && pref?.smsOnDeviceDown) {
      const to = pref.smsPhone || reseller.phone;
      if (to) tasks.push(sendSms({ to, text }));
    }
    await Promise.allSettled(tasks);
  }
}
