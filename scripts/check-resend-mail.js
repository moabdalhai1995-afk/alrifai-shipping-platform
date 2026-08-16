process.env.RESEND_API_KEY = "test-key";
process.env.RESEND_FROM = "AlRifai <verified@example.com>";

let captured = null;
global.fetch = async (url, options) => {
  captured = { url, options };
  return {
    ok: true,
    status: 200,
    async json() { return { id: "email-test-id" }; }
  };
};

require("../resend-mail-preload.js");
const nodemailer = require("nodemailer");

(async () => {
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const result = await transport.sendMail({
    from: "ignored@example.com",
    to: "customer@example.com",
    subject: "اختبار",
    html: "<p>نجاح</p>"
  });

  if (!captured || captured.url !== "https://api.resend.com/emails") {
    throw new Error("Resend endpoint was not used");
  }
  const body = JSON.parse(captured.options.body);
  if (body.from !== process.env.RESEND_FROM) throw new Error("RESEND_FROM was not honored");
  if (body.to[0] !== "customer@example.com") throw new Error("Recipient was not preserved");
  if (result.messageId !== "email-test-id") throw new Error("Resend message id was not returned");

  console.log("Resend mail preload check passed.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
