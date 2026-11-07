"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileVideo, Image as ImageIcon, Pencil, Trash2, Upload } from "lucide-react";
import { deleteMediaAction, updateMediaAction, uploadMediaAction } from "@/lib/actions/media";
import { formatDate, parseJson } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export type MediaAssetView = {
  id: string;
  fileName: string;
  publicUrl: string | null;
  type: string;
  sizeBytes: number;
  altText: string | null;
  folder: string | null;
  tags: string;
  createdAt: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaManager({ slug, assets }: { slug: string; assets: MediaAssetView[] }) {
  const [uploadState, uploadAction] = useActionState(uploadMediaAction, null);
  const [editing, setEditing] = useState<MediaAssetView | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (uploadState?.ok) router.refresh();
  }, [uploadState, router]);

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="xl:sticky xl:top-20 xl:self-start">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" /> Upload asset
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={uploadAction} className="space-y-3">
            <input type="hidden" name="workspaceSlug" value={slug} />
            <FormMessage error={uploadState?.error} message={uploadState?.message} />
            <div className="space-y-1.5">
              <Label htmlFor="file">Image or video</Label>
              <Input id="file" name="file" type="file" accept="image/*,video/*" required />
              <p className="text-xs text-muted-foreground">Up to 10 MB. Stored locally in public/uploads.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="folder">Folder</Label>
              <Input id="folder" name="folder" placeholder="Campaigns / Spring" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="altText">Alt text</Label>
              <Input id="altText" name="altText" placeholder="Describe the image" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" name="tags" placeholder="product, lifestyle" />
            </div>
            <SubmitButton className="w-full" pendingText="Uploading…">
              Upload
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <div>
        {assets.length === 0 ? (
          <EmptyState icon={ImageIcon} title="No media yet" description="Upload your first asset to use it in posts." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => {
              const tags = parseJson<string[]>(asset.tags, []);
              return (
                <div key={asset.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="aspect-video bg-muted">
                    {asset.type === "video" ? (
                      <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                        <FileVideo className="h-8 w-8" />
                        <span className="text-xs">Video</span>
                      </div>
                    ) : asset.publicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.publicUrl} alt={asset.altText ?? asset.fileName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="truncate text-sm font-medium">{asset.fileName}</p>
                    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <span>{formatBytes(asset.sizeBytes)}</span>
                      <span>·</span>
                      <span>{formatDate(asset.createdAt)}</span>
                      {asset.folder ? (
                        <>
                          <span>·</span>
                          <Badge variant="outline">{asset.folder}</Badge>
                        </>
                      ) : null}
                    </div>
                    {tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 pt-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(asset)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <form action={deleteMediaAction}>
                        <input type="hidden" name="workspaceSlug" value={slug} />
                        <input type="hidden" name="mediaId" value={asset.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-red-600">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit asset</DialogTitle>
          </DialogHeader>
          {editing ? <EditAssetForm slug={slug} asset={editing} onDone={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditAssetForm({ slug, asset, onDone }: { slug: string; asset: MediaAssetView; onDone: () => void }) {
  const [state, formAction] = useActionState(updateMediaAction, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="workspaceSlug" value={slug} />
      <input type="hidden" name="mediaId" value={asset.id} />
      <FormMessage error={state?.error} message={state?.message} />
      <div className="space-y-1.5">
        <Label htmlFor="edit-alt">Alt text</Label>
        <Input id="edit-alt" name="altText" defaultValue={asset.altText ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-folder">Folder</Label>
        <Input id="edit-folder" name="folder" defaultValue={asset.folder ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-tags">Tags</Label>
        <Input id="edit-tags" name="tags" defaultValue={parseJson<string[]>(asset.tags, []).join(", ")} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
