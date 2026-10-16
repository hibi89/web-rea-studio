# Public mobile UI preview (no analysis engine)

The Vercel project for this repository must set **Root Directory = preview** and **Framework Preset = Other**. This directory contains only three independent static assets and Vercel security headers. It does not deploy `studio/server.mjs`, the Chrome/REA engines, private run history or target credentials.

This is a publicly accessible visual demo. It makes **no** network requests for the original website or analysis APIs. The sample data clearly says `demo:true` and `live:false`, and no screenshots are presented as captured evidence. The URL input is read-only. The user can switch among fixture, static analysis and previous browser-error example UIs.

Manual local check: `node --test tests/public-preview.test.mjs`. Real Studio usage remains `npm run studio` on the local Windows PC. Do not infer that successful preview deployment makes Chrome/REA available on Vercel.
