# BUDDY Landing Page

The BUDDY landing page, rebuilt as a single-page Next.js application with the
original visual style and theme intact.

## Stack

- Next.js 16 (App Router) + TypeScript
- Framer Motion for reveals, mascot parallax and micro-interactions
- Next Fonts (Anton for display type, Inter for body copy)
- Self-contained CSS in `app/globals.css`

## Pages

- `/` — the landing page (`app/page.tsx`)
- `/icon.png` — BUDDY favicon, generated from `app/icon.png`

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Checks

```bash
npm run typecheck
npm run build
npm run start
```

## Deploy to Vercel

1. Push this folder to a Git repository (GitHub, GitLab or Bitbucket).
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Next.js automatically — keep the default build settings.
4. Click **Deploy**.

Or deploy from the terminal:

```bash
npx vercel
```

No environment variables or external services are required.

## Legacy

`index.html` is the original static design preview, kept for reference. The
running Next.js app does not use it.
