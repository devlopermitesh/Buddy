import { db } from "./db";
import { isDev } from "./env";

type MailInput = {
  to: string;
  subject: string;
  body: string;
  link?: string;
};

/**
 * Local/dev delivery writes to the EmailOutbox table (visible at /dev/outbox).
 * When SMTP_URL is configured this is where a real transport would be wired.
 */
export async function sendMail({ to, subject, body, link }: MailInput) {
  await db.emailOutbox.create({
    data: { to, subject, body, link },
  });

  if (isDev) {
    console.log(`\n[SocialFlow email] To: ${to}\nSubject: ${subject}\n${body}\n${link ?? ""}\n`);
  }
}
