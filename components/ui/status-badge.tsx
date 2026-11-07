import { Badge } from "./badge";
import { statusTone, titleCase } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusTone(status)} className={className}>
      {titleCase(status)}
    </Badge>
  );
}
