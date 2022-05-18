# 📦 B2 Backup Worker

[Cloudflare](https://www.cloudflare.com/) worker for allowing files to be downloaded from a private [Backblaze](https://www.backblaze.com/) bucket.

## 🔋 Getting Started

Setup B2 Application Key Id as a secret

```bash
wrangler secret put B2_APP_KEY_ID
```

Configure wrangler.toml values

You can use the command below (Linux) to generate a random string for the JWT Secret and API Key

```bash
openssl rand -base64 64
```
