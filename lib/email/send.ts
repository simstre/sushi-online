/**
 * Minimal email dispatcher. Dev mode: logs to server console. Production: wire
 * this to Resend/SendGrid/SES/etc. by replacing the body of `sendEmail`.
 */
type Email = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(email: Email): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.EMAIL_BACKEND !== "console") {
    // Production stub. When you wire a real service, uncomment one of these:
    //
    //   await resend.emails.send({ from, to, subject, text, html });
    //   await sgMail.send({ from, to, subject, text, html });
    //
    // For now, log a warning so missing delivery is visible.
    console.warn("[email] no delivery backend configured in production:", email.subject, "to", email.to);
    return;
  }

  // Dev: log to console so the link is recoverable without an inbox.
  console.log("\n============== EMAIL ==============");
  console.log(`To:      ${email.to}`);
  console.log(`Subject: ${email.subject}`);
  console.log("");
  console.log(email.text);
  console.log("===================================\n");
}
