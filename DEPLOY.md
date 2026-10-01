# Hosting Agbero on Dokploy (app + Postgres)

Both the game and its database live on your Dokploy VPS. The repo builds
into one Docker image: it compiles the game, then runs a small Node server
that serves the game files and the account/save API (`/api/*`).

## 1. Create the Postgres database

1. Dokploy → **Databases** → **Create** → **PostgreSQL**.
2. Name it `agbero-db` (any name works).
3. Open it and copy the **internal connection string** — it looks like
   `postgresql://postgres:xxxx@agbero-db:5432/postgres`.
   Use the internal hostname (the service name), not the public IP.

## 2. Create the app

1. Dokploy → your project → **Create Service** → **Application**.
2. Name: `agbero`.
3. Source: **GitHub**, repo `Julieellis1/agbero`, branch `main`.
4. Build type: **Dockerfile**. Dockerfile path: `./Dockerfile`.
5. Port: `3000`.

## 3. Environment variables

In the app → **Environment**, add:

| Key            | Value                                              |
|----------------|----------------------------------------------------|
| `DATABASE_URL` | the internal Postgres string from step 1           |
| `JWT_SECRET`   | any long random string (e.g. 32+ characters)       |
| `PORT`         | `3000`                                             |

Generate the secret with: `openssl rand -hex 32`

## 4. Domain

App → **Domains** → add yours, e.g. `agbero.teta.dpdns.org`.
Point the DNS A record at your VPS IP, then Dokploy issues HTTPS automatically.

## 5. Deploy

Hit **Deploy**. The build takes a few minutes (it compiles the game with Vite).
When it is live, open the domain: the game loads, and the 👤 button lets
players create an account / sign in. Signed-in progress auto-saves to the
database; guests keep playing with local saves only.

## Notes

- The free GitHub Pages build (`julieellis1.github.io/agbero`) still works
  as a demo, but it has no API behind it — login there falls back to guest mode.
- Backups: Dokploy can schedule Postgres backups in the database settings —
  turn that on once real players exist.
- To update the live game, just push to `main` and hit **Redeploy** in Dokploy
  (or enable auto-deploy on push).
