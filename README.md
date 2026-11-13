# One Year, A Thousand Little Things

A responsive anniversary storybook made with React, TypeScript, Tailwind CSS, and Framer Motion.

## Run it

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## Make it yours

Open the site and choose **Make it yours** to edit both names, your relationship start date, anniversary date, timeline moments and reasons, extra dated writeups, the letter, and the surprise message. The photo selector in each timeline moment links a photo already added to the gallery. The closing screen and surprise use the first image in the gallery.

Use **Add your photos** to add your own images and videos. Captions, dates, and descriptions can be edited directly below each memory. Add up to ten audio files from the floating music player or the **Your soundtrack** editor; rename, remove, pause, and skip through your songs. Playback never starts without a click.

## Shared hosting setup (Supabase + Vercel)

1. Create a Supabase project. In **Project Settings → API**, copy the project URL and the public anon/publishable key.
2. In the Supabase SQL Editor, run [`supabase/setup.sql`](./supabase/setup.sql).
3. In **Authentication → Providers / Sign-in**, disable public email sign-ups. In **Authentication → Users**, create the one owner account used to edit the site. Do not put its password or a Supabase service-role/secret key in this repository.
4. For local work, copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `.env.local` is ignored by Git. Run `npm run dev`.
5. To publish on Vercel, import the GitHub repository and set the same two `VITE_` variables in the Vercel project's environment variables before deploying. Vercel uses `npm run build` and `dist` as the output directory.
6. Open the public site, choose **Make it yours**, and sign in with the owner account to add or edit shared content.

The website and uploaded media are public to anyone with the site link, as requested. The GitHub repository contains source code only; never commit `.env.local`, passwords, personal photos, or service-role keys. Supabase serves public reads, while edits and uploads require the owner to sign in. The public site is not a private or unlisted-access boundary.

Uploads are limited to 80 MB per file and remain subject to the Supabase project's storage limits and quota. Without Supabase environment variables, the app falls back to local browser storage; those edits will not sync to your partner's device.
