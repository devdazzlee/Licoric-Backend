# Vercel Deployment Guide for Backend

## 📦 Files Created

✅ `vercel.json` - Vercel configuration
✅ `.vercelignore` - Files to ignore during deployment
✅ `package.json` - Added `vercel-build` script

---

## 🚀 Deployment Steps

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
cd /Users/mac/Desktop/Ahmed\ Work/licorice_ropes/backend
vercel login
```

### Step 3: Deploy

```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- What's your project's name? **licorice-ropes-backend**
- In which directory is your code located? **.**
- Want to modify settings? **N**

### Step 4: Set Environment Variables

After deployment, add your environment variables:

```bash
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add JWT_REFRESH_SECRET
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add SHIPPO_API_KEY
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET
vercel env add EMAIL_USER
vercel env add EMAIL_PASSWORD
vercel env add CLIENT_URL
```

Or add them via Vercel Dashboard:
1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add all variables from your `.env` file

### Step 5: Redeploy with Environment Variables

```bash
vercel --prod
```

---

## 🔧 Configure Stripe Webhook

After deployment, you'll get a URL like:
```
https://licorice-ropes-backend.vercel.app
```

### Update Stripe Webhook:

1. **Go to Stripe Dashboard:**
   https://dashboard.stripe.com/test/webhooks

2. **Add Endpoint:**
   ```
   https://YOUR-VERCEL-URL.vercel.app/api/payment/webhook
   ```

3. **Select Events:**
   - `checkout.session.completed`
   - `payment_intent.payment_failed`

4. **Copy Webhook Signing Secret:**
   ```
   whsec_xxxxxxxxxxxxx
   ```

5. **Add to Vercel Environment Variables:**
   ```bash
   vercel env add STRIPE_WEBHOOK_SECRET
   # Paste: whsec_xxxxxxxxxxxxx
   # Select: Production
   ```

6. **Redeploy:**
   ```bash
   vercel --prod
   ```

---

## 🔧 Configure Shippo Webhook (Optional)

1. **Go to Shippo Dashboard:**
   https://apps.shippo.com/settings/api

2. **Add Webhook:**
   ```
   https://YOUR-VERCEL-URL.vercel.app/api/shippo/webhook
   ```

3. **Select Events:**
   - Track updated
   - Transaction created

---

## 📱 Update Frontend

Update your frontend `.env.local` to point to the deployed backend:

```bash
NEXT_PUBLIC_API_URL=https://YOUR-VERCEL-URL.vercel.app/api
```

---

## 🔍 Testing After Deployment

### Test 1: Health Check
```bash
curl https://YOUR-VERCEL-URL.vercel.app/api/
```

Should return: `{"message":"Licorice Ropes API is running"}`

### Test 2: Test Checkout
1. Go to your frontend
2. Add product to cart
3. Complete checkout
4. Pay with test card: `4242 4242 4242 4242`
5. Check admin panel for new order

### Test 3: Check Logs
```bash
vercel logs
```

Or view in dashboard: https://vercel.com/dashboard

---

## ⚠️ Important Notes

### Database Connection
- Make sure `DATABASE_URL` points to a publicly accessible PostgreSQL database
- Vercel cannot connect to `localhost` databases
- Use a cloud database like:
  - Railway (https://railway.app)
  - Neon (https://neon.tech)
  - Supabase (https://supabase.com)
  - Render (https://render.com)

### Prisma in Production
- The `vercel-build` script will:
  1. Generate Prisma client
  2. Push database schema
  3. Compile TypeScript
- This runs automatically on each deployment

### Environment Variables
- Set all variables in Vercel dashboard
- Use different values for Production vs Preview
- Never commit `.env` file to Git

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to database"
**Solution:** Make sure DATABASE_URL is set in Vercel and points to a public database

### Issue: "Prisma Client not generated"
**Solution:** Redeploy with:
```bash
vercel --force
```

### Issue: "Webhook not receiving events"
**Solution:** Check Stripe dashboard webhook logs and make sure the URL is correct

### Issue: "Module not found"
**Solution:** Make sure all dependencies are in `dependencies`, not `devDependencies`

---

## 🎯 Quick Deploy Commands

```bash
# First deploy
cd /Users/mac/Desktop/Ahmed\ Work/licorice_ropes/backend
vercel

# Production deploy
vercel --prod

# Redeploy (force rebuild)
vercel --force --prod

# View logs
vercel logs

# Open project in browser
vercel open
```

---

## ✅ Post-Deployment Checklist

- [ ] Backend deployed to Vercel
- [ ] All environment variables added
- [ ] Database accessible from Vercel
- [ ] Stripe webhook configured with production URL
- [ ] Shippo webhook configured (optional)
- [ ] Frontend updated with production API URL
- [ ] Test checkout flow end-to-end
- [ ] Check order appears in admin panel
- [ ] Verify Shippo tracking works
- [ ] Test email notifications

---

## 🔗 Useful Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Vercel Docs:** https://vercel.com/docs
- **Prisma on Vercel:** https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel
- **Stripe Webhooks:** https://dashboard.stripe.com/webhooks
- **Shippo Webhooks:** https://apps.shippo.com/settings/api

---

**After deployment, webhooks will work automatically and orders will be created successfully!** 🎉

