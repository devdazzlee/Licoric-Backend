# 🚀 Deploy to Vercel Now - Quick Start

## ✅ What's Ready

All Vercel configuration files have been created:
- `vercel.json` ✅
- `.vercelignore` ✅
- `vercel-build` script ✅
- `.gitignore` (already had .env) ✅

---

## 🎯 Deploy in 3 Steps

### 1️⃣ Install Vercel CLI (if not installed)

```bash
npm install -g vercel
```

### 2️⃣ Deploy

```bash
cd /Users/mac/Desktop/Ahmed\ Work/licorice_ropes/backend
vercel
```

Answer the prompts:
- **Set up and deploy?** → `Y`
- **Which scope?** → Select your account
- **Link to existing project?** → `N`
- **Project name?** → `licorice-ropes-backend`
- **Directory?** → `.` (press Enter)
- **Override settings?** → `N`

### 3️⃣ Add Environment Variables

**Copy from your .env file and add to Vercel:**

```bash
# Required variables:
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add JWT_REFRESH_SECRET
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add SHIPPO_API_KEY
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET
vercel env add CLIENT_URL
```

For each command:
- Paste the value from your `.env` file
- Select: **Production** (press Enter)
- Press Enter to confirm

**Then deploy to production:**
```bash
vercel --prod
```

---

## 🔧 After Deployment

You'll get a URL like: `https://licorice-ropes-backend-xxxxx.vercel.app`

### Update Stripe Webhook:

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Enter: `https://YOUR-VERCEL-URL.vercel.app/api/payment/webhook`
4. Select events: `checkout.session.completed` and `payment_intent.payment_failed`
5. Click **"Add endpoint"**
6. **Copy the signing secret** (starts with `whsec_`)
7. Update in Vercel:
   ```bash
   vercel env add STRIPE_WEBHOOK_SECRET
   # Paste the new secret
   # Select: Production
   ```
8. Redeploy:
   ```bash
   vercel --prod
   ```

### Update Frontend:

Edit `/Users/mac/Desktop/Ahmed Work/licorice_ropes/frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=https://YOUR-VERCEL-URL.vercel.app/api
```

---

## ✅ Test It Works

1. **Test backend:**
   ```bash
   curl https://YOUR-VERCEL-URL.vercel.app/api/
   ```
   Should return: `{"message":"Licorice Ropes API is running"}`

2. **Test checkout:**
   - Go to your frontend
   - Add product to cart
   - Complete checkout
   - Use test card: `4242 4242 4242 4242`
   - Check admin panel → Order should appear! 🎉

---

## 🐛 If Something Goes Wrong

**View deployment logs:**
```bash
vercel logs
```

**Force rebuild:**
```bash
vercel --force --prod
```

**Check environment variables:**
```bash
vercel env ls
```

---

## 📝 Current Environment Variables to Copy

From your `.env` file, you need:

```
DATABASE_URL=postgresql://...
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (will be updated after webhook setup)
SHIPPO_API_KEY=shippo_test_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLIENT_URL=http://localhost:3000 (or your frontend URL)
```

---

## 🎯 Why This Fixes the Webhook Issue

**Problem now:**
- Backend on `localhost:4000`
- Stripe can't reach localhost
- Webhooks don't fire
- Orders never created ❌

**After Vercel deployment:**
- Backend on `https://your-app.vercel.app`
- Stripe CAN reach public URL
- Webhooks fire automatically
- Orders created immediately ✅

---

**Ready to deploy? Run:** `vercel`

See `VERCEL_DEPLOYMENT_GUIDE.md` for detailed instructions.

