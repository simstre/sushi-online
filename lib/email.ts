import { Resend } from "resend";
import { formatMoney } from "@/lib/utils";
import { renderOrderModifiers } from "@/lib/order/modifiers";

const FROM_DEFAULT = process.env.EMAIL_FROM ?? "comfyBites <onboarding@resend.dev>";
const BRAND = "comfyBites";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type SendResult = { ok: true } | { ok: false; error: string };

async function send({ to, subject, html, text }: SendArgs): Promise<SendResult> {
  const resend = client();
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — would have sent "${subject}" to ${to}.\n${text}`,
    );
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const res = await resend.emails.send({ from: FROM_DEFAULT, to, subject, html, text });
  if (res.error) return { ok: false, error: res.error.message ?? "Resend error" };
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT_BODY =
  '"Nunito",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
const FONT_DISPLAY =
  '"Fraunces","Nunito",Georgia,"Times New Roman",serif';

/**
 * Wraps a raw body in the comfyBites email shell: outer letter-styled
 * card, brand header, content, branded footer. Inline styles only — most
 * email clients strip <style> blocks.
 */
function renderShell(args: { brandLabel?: string; bodyHtml: string }): string {
  const brandLabel = args.brandLabel ?? BRAND;
  return `
    <div style="background:#f4f1ec;padding:20px;font-family:${FONT_BODY};color:#222">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
        <div style="padding:24px 28px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #eee">
          <div style="width:42px;height:42px;border-radius:8px;background:#34503D;color:#F8F1E4;display:flex;align-items:center;justify-content:center;font-family:${FONT_DISPLAY};font-weight:800;font-size:18px;letter-spacing:-0.02em">cB</div>
          <div>
            <div style="font-family:${FONT_DISPLAY};font-weight:700;font-size:17px;color:#34503D;line-height:1.2;letter-spacing:-0.01em">${escapeHtml(brandLabel)}</div>
            <div style="font-size:11px;color:#888;margin-top:3px;letter-spacing:0.04em;text-transform:uppercase">comfyBites · hot · fresh · delivered</div>
          </div>
        </div>
        <div style="padding:28px;font-size:14px;line-height:1.6;color:#222">
          ${args.bodyHtml}
          <div style="margin-top:32px;padding-top:18px;border-top:1px solid #eee;font-size:11px;color:#888;line-height:1.5">
            comfyBites · online ordering for restaurants<br/>
            You're receiving this because someone created an account, requested access, or placed an order. If this wasn't you, you can ignore this email.
          </div>
        </div>
      </div>
    </div>
  `;
}

function ctaButton(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;padding:12px 22px;background:#34503D;color:#F8F1E4;text-decoration:none;border-radius:8px;font-family:${FONT_BODY};font-weight:600;font-size:14px">${label} →</a>`;
}

function fallbackLink(url: string): string {
  return `
    <p style="margin:0 0 14px;color:#666;font-size:13px">
      Or copy this link into your browser:<br/>
      <code style="color:#888;font-size:12px;word-break:break-all">${url}</code>
    </p>
  `;
}

function calloutBox(html: string, variant: "warn" | "info" = "info"): string {
  const palette =
    variant === "warn"
      ? { bg: "#fffbeb", border: "#fde68a", fg: "#854d0e" }
      : { bg: "#f0fdf4", border: "#bbf7d0", fg: "#15803d" };
  return `
    <div style="margin-top:18px;padding:12px 14px;background:${palette.bg};border:1px solid ${palette.border};border-radius:8px;font-size:12px;color:${palette.fg}">
      ${html}
    </div>
  `;
}

export async function sendInviteEmail(args: {
  to: string;
  inviteUrl: string;
  invitedAs: "platform admin" | "restaurant admin" | "restaurant staff";
  tenantName?: string;
}): Promise<SendResult> {
  const role =
    args.invitedAs === "platform admin"
      ? "platform admin"
      : args.tenantName
        ? `${args.invitedAs} for ${escapeHtml(args.tenantName)}`
        : args.invitedAs;
  const brandLabel = args.tenantName ? `${args.tenantName} · admin` : BRAND;
  const subject =
    args.invitedAs === "platform admin"
      ? `You've been invited to administer ${BRAND}`
      : args.tenantName
        ? `You've been invited to manage ${args.tenantName}`
        : `You've been invited to ${BRAND}`;

  const text =
    `You've been invited to ${BRAND} as a ${role}.\n\n` +
    `Create your password: ${args.inviteUrl}\n\n` +
    `This link expires in 7 days.`;

  const body = `
    <h1 style="margin:0 0 14px;font-family:${FONT_DISPLAY};font-weight:600;font-size:24px;color:#111;letter-spacing:-0.01em">You're invited to ${BRAND}</h1>
    <p style="margin:0 0 14px">
      You've been added as a <strong>${role}</strong>. Click below to create your password and get started.
    </p>
    <p style="margin:22px 0">${ctaButton("Create your password", args.inviteUrl)}</p>
    ${fallbackLink(args.inviteUrl)}
    <p style="margin:0 0 4px;color:#666;font-size:13px">This invite expires in <b>7 days</b>.</p>
  `;

  return send({ to: args.to, subject, html: renderShell({ brandLabel, bodyHtml: body }), text });
}

export async function sendPasswordResetEmail(args: {
  to: string;
  resetUrl: string;
  name?: string | null;
  expiresInMinutes?: number;
}): Promise<SendResult> {
  const minutes = args.expiresInMinutes ?? 60;
  const greeting = args.name ? `Hi ${escapeHtml(args.name)},` : "Hi,";
  const subject = `Reset your ${BRAND} password`;
  const expiresPhrase = minutes === 60 ? "1 hour" : `${minutes} minutes`;

  const text =
    `${args.name ? `Hi ${args.name},` : "Hi,"}\n\n` +
    `Click the link below within the next ${expiresPhrase} to choose a new password:\n\n` +
    `${args.resetUrl}\n\n` +
    `If you didn't request this, you can ignore this email — your password won't change.`;

  const body = `
    <h1 style="margin:0 0 14px;font-family:${FONT_DISPLAY};font-weight:600;font-size:24px;color:#111;letter-spacing:-0.01em">Reset your password</h1>
    <p style="margin:0 0 14px">${greeting}</p>
    <p style="margin:0 0 14px">
      We got a request to reset the password for your ${BRAND} account
      (<b>${escapeHtml(args.to)}</b>). Click the button below to choose a new one.
    </p>
    <p style="margin:22px 0">${ctaButton("Reset password", args.resetUrl)}</p>
    ${fallbackLink(args.resetUrl)}
    ${calloutBox(
      `<b>Heads up:</b> this link expires in <b>${expiresPhrase}</b>. If you didn't request a password reset, you can safely ignore this email — your password won't change.`,
      "warn",
    )}
  `;

  return send({ to: args.to, subject, html: renderShell({ bodyHtml: body }), text });
}

export type ReceiptLineItem = {
  name: string;
  quantity: number;
  unitPrice: number; // cents
  modifiers?: unknown; // OrderItem.modifiers JSON
};

export async function sendOrderReceiptEmail(args: {
  to: string;
  customerName: string;
  restaurantName: string;
  orderId: string;
  currency: string;
  totalAmount: number;
  items: ReceiptLineItem[];
  orderUrl?: string;
}): Promise<SendResult> {
  const subject = `Your ${args.restaurantName} order · #${args.orderId.slice(-6)}`;
  const shortId = args.orderId.slice(-8);

  const textLines = args.items.map((it) => {
    const mods = renderOrderModifiers(it.modifiers);
    const lineTotal = formatMoney(it.unitPrice * it.quantity, args.currency);
    return `  ${it.quantity}× ${it.name}${mods ? ` (${mods})` : ""}  —  ${lineTotal}`;
  });
  const text =
    `Hi ${args.customerName},\n\n` +
    `Thanks for your order at ${args.restaurantName}.\n\n` +
    `Order #${shortId}\n` +
    `${textLines.join("\n")}\n\n` +
    `Total: ${formatMoney(args.totalAmount, args.currency)}\n` +
    (args.orderUrl ? `\nView order: ${args.orderUrl}\n` : "");

  const itemsHtml = args.items
    .map((it, idx) => {
      const mods = renderOrderModifiers(it.modifiers);
      const lineTotal = formatMoney(it.unitPrice * it.quantity, args.currency);
      return `
        <div style="display:flex;justify-content:space-between;gap:10px;padding:12px 0;${idx === 0 ? "" : "border-top:1px solid #eee"}">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;color:#222">
              <span style="color:#888;font-variant-numeric:tabular-nums">${it.quantity}×</span>
              <b>${escapeHtml(it.name)}</b>
            </div>
            ${mods ? `<div style="font-size:12px;color:#888;margin-top:2px">${escapeHtml(mods)}</div>` : ""}
          </div>
          <div style="font-size:14px;color:#222;font-variant-numeric:tabular-nums;white-space:nowrap">${lineTotal}</div>
        </div>
      `;
    })
    .join("");

  const body = `
    <h1 style="margin:0 0 6px;font-family:${FONT_DISPLAY};font-weight:600;font-size:24px;color:#111;letter-spacing:-0.01em">Thanks, ${escapeHtml(args.customerName)} — your order is in</h1>
    <p style="margin:0 0 18px;color:#666;font-size:13px">
      Order <b>#${shortId}</b> · ${escapeHtml(args.restaurantName)}
    </p>

    ${calloutBox(
      `<div style="display:flex;align-items:center;gap:10px"><div style="width:24px;height:24px;border-radius:999px;background:#15803d;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">✓</div><div style="font-size:13px;color:#15803d"><b>Confirmed.</b> Your payment has been received.</div></div>`,
      "info",
    )}

    <div style="margin-top:22px">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#888;margin-bottom:6px">Order summary</div>
      ${itemsHtml}
    </div>

    <div style="border-top:2px solid #222;padding-top:14px;margin-top:14px;display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#111">
      <span>Total</span>
      <span style="font-variant-numeric:tabular-nums">${formatMoney(args.totalAmount, args.currency)}</span>
    </div>

    ${args.orderUrl ? `<p style="margin:24px 0 0">${ctaButton("View order", args.orderUrl)}</p>` : ""}
    <p style="margin-top:18px;color:#666;font-size:13px">
      Questions about your order? Reply to this email or contact ${escapeHtml(args.restaurantName)} directly.
    </p>
  `;

  return send({
    to: args.to,
    subject,
    html: renderShell({ brandLabel: args.restaurantName, bodyHtml: body }),
    text,
  });
}
