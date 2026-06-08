# ClientDesk — VPS Deployment Guide (cPanel/WHM)

## Prerequisites
- Node.js 18+ installed on VPS
- MySQL database created in cPanel
- Domain/subdomain pointed to VPS

## Step 1 — Upload Files
Upload the `clientdesk` folder to your VPS (e.g. `/home/youraccount/clientdesk`)
via File Manager or FTP/SFTP.

## Step 2 — Create MySQL Database (cPanel)
1. Login to cPanel → MySQL Databases
2. Create database: `clientdesk`
3. Create user and assign ALL PRIVILEGES
4. Note: username, password, database name

## Step 3 — Configure Environment
```bash
cp .env.example .env
nano .env
```
Fill in:
- `DATABASE_URL` with your MySQL credentials
- `NEXTAUTH_SECRET` — run: `openssl rand -base64 32`
- `NEXTAUTH_URL` — your domain e.g. `https://clientdesk.yourdomain.com`
- SMTP settings from cPanel Email Accounts
- Telegram Bot Token (optional)

## Step 4 — Install & Build
```bash
npm install
npx prisma generate
npx prisma db push
node scripts/seed.js
npm run build
```

## Step 5 — Run with PM2
```bash
npm install -g pm2
pm2 start npm --name "clientdesk" -- start
pm2 save
pm2 startup
```

## Step 6 — Nginx Reverse Proxy (if using Nginx)
```nginx
server {
    server_name clientdesk.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Step 7 — Apache (if using cPanel Apache)
Create `.htaccess` in public_html:
```apache
RewriteEngine On
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
```
Or use cPanel's "Setup Node.js App" feature.

## Default Login
- Email: admin@clientdesk.com
- Password: admin123
- ⚠️ Change password immediately after first login!

## Telegram Bot Setup
1. Message @BotFather on Telegram
2. Send `/newbot` and follow instructions
3. Copy the token to `.env` as `TELEGRAM_BOT_TOKEN`
4. Add client Telegram IDs in the client edit form
