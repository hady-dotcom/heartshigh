# Phone-test this branch on the preview service

This is only for `heartshigh-preview`. The public address is:

https://heartshigh-preview-preview.up.railway.app

Do not change the production service, and do not deploy `heartshigh-production.up.railway.app`. Leave pull request 56 as a draft.

## Why `railway up` failed

`railway.toml` used to set `builder = "DOCKERFILE"`. Railway now runs Railpack prepare on that file, ignores the Dockerfile builder, and stops the deploy with `railpack prepare error (ignored DOCKERFILE builder in railway.toml)`.

This branch no longer sets that builder. The Dockerfile is still here and is used when the service builder is Dockerfile. `railpack.json` repeats the same Node 22 build and start command for a Railpack build.

## Dashboard (preview service only)

1. Open the Railway project and the service named `heartshigh-preview`. Check the domain is `heartshigh-preview-preview.up.railway.app`. If the domain is the production address, stop.
2. Settings → Source. Connect the GitHub repository `hady-dotcom/heartshigh` if it is not already connected.
3. Set the branch to `cursor/feed-autoplay-swipe-ecee`.
4. Set Root Directory to `hearts-prototype`.
5. If a config-file path is shown, set it to `/hearts-prototype/railway.toml`. That path starts at the repository root. It does not follow the root directory.
6. Settings → Build. Choose builder Dockerfile and Dockerfile path `Dockerfile`. If the control is locked on Railpack, leave it. `railpack.json` covers that path.
7. The environment must be the preview environment, not production.
8. Use Deploy → Redeploy on this service. A manual redeploy is the one that has been honouring the Dockerfile when a git-triggered build ran Railpack instead.
9. Open https://heartshigh-preview-preview.up.railway.app/api/health and look for `"ok": true`.

## CLI

From the repository root, linked to the preview project:

```bash
railway up hearts-prototype --path-as-root --service heartshigh-preview --environment preview --detach
```

`--path-as-root` makes `hearts-prototype` the archive root, so Railway can see the Dockerfile. Running `railway up` in the repository root without that flag uploads the whole repository and Railpack has no app to build.

Do not pass `--environment production`.
