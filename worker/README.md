# Tiger relay (free, Cloudflare Workers AI)

This small relay lets Tiger answer open questions using the facts MeshCheck measured. The 3D file is never sent, only numbers and the question. If the relay is not set up, or the free daily allowance runs out, Tiger uses its built-in answers instead.

## Set it up (about 10 minutes, no code editor needed)

1. Make a free account at https://dash.cloudflare.com/sign-up.
2. In the dashboard open **Workers & Pages**, then **Create**, then **Create Worker**. Name it `meshcheck-tiger` and press **Deploy**.
3. Press **Edit code**, delete what is there, paste in everything from `index.js` in this folder, and press **Deploy**.
4. Open the Worker's **Settings**, then **Bindings**, then **Add**, choose **Workers AI**, set the variable name to `AI`, and save.
5. In **Settings**, then **Variables and Secrets**, add a plain text variable `ALLOWED_ORIGIN` with the value `https://laurenlliu.github.io` (your site's address, no slash at the end). This stops other websites from using your allowance.
6. Copy the Worker's address (it looks like `https://meshcheck-tiger.YOURNAME.workers.dev`) and send it to Claude, or paste it into `AI_URL` near the top of the Tiger section of `index.html`.

Cloudflare's free plan includes a daily allowance of Workers AI usage that resets at 00:00 UTC. If a message fails, Tiger quietly falls back to its built-in answers.

## Command line instead

```
npm i -g wrangler
cd worker
wrangler login
wrangler deploy
```
