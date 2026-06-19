import Link from "next/link";
import { MediaUploader } from "@/components/shared/MediaUploader";
import { Suspense } from "react";

export default function UploadPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <Link className="text-sm font-semibold text-primary" href="/">
              Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">Upload workspace</h1>
          </div>
          <div className="rounded-md border border-border bg-background px-4 py-3 text-sm text-muted">
            FastAPI endpoint: <code>/api/uploads</code>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8">
        <Suspense fallback={
          <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-panel">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }>
          <MediaUploader />
        </Suspense>
      </div>
    </main>
  );
}
