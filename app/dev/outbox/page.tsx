import Link from "next/link";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OutboxPage() {
  const emails = await db.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Development outbox</h1>
          <p className="text-sm text-muted-foreground">
            Local email capture. Real SMTP is optional; this page is for development only.
          </p>
        </div>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
      {emails.length === 0 ? (
        <EmptyState icon={Mail} title="No emails yet" description="Verification and invitation emails will appear here." />
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <Card key={email.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{email.subject}</CardTitle>
                  <Badge variant="outline">{formatDateTime(email.createdAt)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">To: {email.to}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{email.body}</p>
                {email.link ? (
                  <a href={email.link} className="block break-all text-sm font-medium text-primary hover:underline">
                    {email.link}
                  </a>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
