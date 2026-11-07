const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const db = new PrismaClient();

(async () => {
  const users = await db.user.findMany({
    select: { id: true, email: true, emailVerifiedAt: true, isActive: true },
  });
  const workspaces = await db.workspace.findMany({
    select: { id: true, slug: true, onboardingCompletedAt: true, name: true },
  });
  console.log("USERS", users.map((u) => `${u.email} verified=${Boolean(u.emailVerifiedAt)} active=${u.isActive}`));
  console.log("WORKSPACES", workspaces.map((w) => `${w.slug} onboarded=${Boolean(w.onboardingCompletedAt)}`));

  for (const email of ["admin@socialflow.test", "manager@socialflow.test", "exec@socialflow.test"]) {
    const user = users.find((u) => u.email === email);
    if (!user) {
      console.log("MISSING", email);
      continue;
    }
    const token = crypto.randomBytes(32).toString("hex");
    const refreshTokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await db.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    console.log("TOKEN", email, token);
  }

  await db.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
