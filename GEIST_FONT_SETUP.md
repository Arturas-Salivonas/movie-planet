# Geist Font Installation

## Download Instructions

1. Visit the official Geist repository: https://github.com/vercel/geist-font
2. Download the latest release or clone the repository
3. Copy the `GeistVF.woff2` file (Variable Font) to: `public/fonts/GeistVF.woff2`

## Alternative: Direct Download

You can download Geist directly from:
- GitHub Releases: https://github.com/vercel/geist-font/releases
- Or use npm: `npm install geist` and copy from `node_modules/geist/dist/fonts/geist-sans/GeistVF.woff2`

## What's Already Configured

✅ Font configuration created in `lib/fonts.ts`
✅ Layout updated to use Geist font in `app/layout.tsx`
✅ Tailwind configured to use Geist as default sans-serif font
✅ Font will be optimized and cached by Next.js automatically

## After Adding the Font File

Simply place `GeistVF.woff2` in `public/fonts/` and restart the dev server.
The font will be:
- Self-hosted (no external requests)
- Optimized by Next.js
- Cached with proper headers
- Used everywhere across the application including map labels
