const nodemailer = require("nodemailer");

const originalCreateTransport = nodemailer.createTransport.bind(nodemailer);

function normalizeRecipients(value) {
  if (Array.isArray(value)) return value.flatMap(normalizeRecipients).filter(Boolean);
  if (!value) return [];
  if (typeof value === "object" && value.address) return [String(value.address)];
  return String(value)
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

nodemailer.createTransport = function createTransportWithResendFallback(...args) {
  const transport = originalCreateTransport(...args);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return transport;

  transport.sendMail = async function sendMailViaResend(mail = {}) {
    const to = normalizeRecipients(mail.to);
    if (!to.length) throw new Error("Email recipient is required");

    const payload = {
      from: process.env.RESEND_FROM || mail.from || "AlRifai <onboarding@resend.dev>",
      to,
      subject: String(mail.subject || "الرفاعي للشحن الدولي")
    };

    if (mail.html) payload.html = String(mail.html);
    if (mail.text) payload.text = String(mail.text);
    if (!payload.html && !payload.text) payload.text = "الرفاعي للشحن الدولي";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.message || data.error || `Resend request failed with ${response.status}`;
      throw new Error(String(message));
    }

    return {
      accepted: to,
      rejected: [],
      messageId: data.id || null,
      response: "Resend accepted"
    };
  };

  return transport;
};
