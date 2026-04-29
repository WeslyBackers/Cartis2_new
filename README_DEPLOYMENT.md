# 🚀 Vercel Deployment - Complete Guide

Welcome! This directory now contains everything needed to deploy CARTIS 2.0 to Vercel.

## 📚 Documentation Files

| File | Purpose | Read Time | When to Use |
|------|---------|-----------|-----------|
| **VERCEL_QUICKSTART.md** | 5-step quick start guide | 5 min | 👈 **START HERE** |
| **DEPLOYMENT_CHECKLIST.md** | Complete step-by-step checklist | 10 min | While deploying |
| **DEPLOYMENT.md** | Detailed technical documentation | 20 min | Deep dive / troubleshooting |
| **ENV_VARIABLES.md** | Environment variable reference | 10 min | Setting up credentials |
| **vercel.json** | Build configuration | 2 min | Reference |
| **.vercelignore** | Files to exclude from build | 1 min | Reference |

---

## 🎯 Quick Path to Deployment

### First Time Deploy (30 minutes)

1. **Prepare (10 min)**
   - [ ] Set up Supabase database (or Vercel Postgres)
   - [ ] Create Google Cloud service account
   - [ ] Push code to GitHub

2. **Deploy (10 min)**
   - [ ] Go to https://vercel.com/new
   - [ ] Import GitHub repository
   - [ ] Add environment variables (DB, JWT_SECRET, Google Cloud)
   - [ ] Click Deploy

3. **Verify (10 min)**
   - [ ] Test health endpoint: `/api/health`
   - [ ] Test frontend loads
   - [ ] Check logs for errors

**Total: ~30 minutes**

---

## 📋 What Was Changed for Vercel

### New Files
✅ `vercel.json` - Vercel build configuration  
✅ `.vercelignore` - Ignore large files during build  
✅ `VERCEL_QUICKSTART.md` - This quickstart  
✅ `DEPLOYMENT.md` - Full deployment guide  
✅ `DEPLOYMENT_CHECKLIST.md` - Step-by-step checklist  
✅ `ENV_VARIABLES.md` - Environment variable reference  

### Modified Files
✅ `backend/src/index.ts` - Made `/uploads` folder optional (for Vercel stateless functions)

---

## 🔧 Architecture

```
CARTIS 2.0 (Monorepo)
├── backend/          (Node.js API)
│   ├── src/
│   ├── dist/         (Vercel runs this)
│   ├── tsconfig.json
│   └── package.json
├── frontend/         (React SPA)
│   ├── src/
│   ├── dist/         (Vercel serves this as static)
│   ├── vite.config.ts
│   └── package.json
├── vercel.json       (← Deployment config)
├── .vercelignore     (← What to skip)
└── package.json      (← Root workspace)
```

**Deployment target**: Vercel Functions + Static Hosting

---

## 🌍 Database Options

| Option | Setup Time | Cost | Recommendation |
|--------|-----------|------|-----------------|
| **Supabase** | 5 min | Free tier available | ✅ **Best for beginners** |
| **Vercel Postgres** | 2 min | $15/mo minimum | Good for Vercel users |
| **AWS RDS** | 15 min | ~$10/mo | Most control |
| **Railway** | 5 min | ~$5/mo | Good alternative |

**Recommended**: Supabase (easiest, includes PostGIS)

---

## 📦 Environment Variables Needed

```
Database:
- DB_HOST          (e.g., db.xxxxx.supabase.co)
- DB_PORT          (usually 5432)
- DB_NAME          (usually "postgres")
- DB_USER          (usually "postgres")
- DB_PASSWORD      (your password)

Application:
- PORT             (3000)
- NODE_ENV         (production)
- JWT_SECRET       (random string - generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

Services:
- GOOGLE_APPLICATION_CREDENTIALS  (full Google Cloud service account JSON)
```

See `ENV_VARIABLES.md` for detailed instructions on getting each variable.

---

## 🚦 Status Indicators

### ✅ Ready to Deploy
- [ ] `npm run build` succeeds locally
- [ ] `npm run typecheck --prefix backend` passes
- [ ] Code is pushed to GitHub
- [ ] All credentials ready

### ⚠️ Common Issues
- **TypeScript errors** → Run `npm run typecheck --prefix backend`
- **Build fails** → Check `vercel.json` and `tsconfig.json`
- **DB connection fails** → Verify DB_HOST, DB_PORT, password
- **Frontend doesn't load** → Check `frontend/dist` was created

---

## 📞 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Run `npm run build` locally first |
| API returns 503 | Normal cold start - wait 5-10 seconds |
| DB connection error | Check env vars in Vercel dashboard |
| CORS errors | Backend has `app.use(cors())` enabled |
| Files don't upload | Use Vercel Blob or S3 instead of local `/uploads` |

**Detailed troubleshooting**: See `DEPLOYMENT.md`

---

## 🔄 Deployment Flow

```
Code Push to GitHub
    ↓
Vercel Detects Commit
    ↓
Build Stage
  ├─ npm install (backend + frontend)
  ├─ npm run build (backend TypeScript → dist/)
  └─ npm run build (frontend Vite → dist/)
    ↓
Deploy Stage
  ├─ Backend runs as Node function
  └─ Frontend serves static files
    ↓
Live at: https://your-project.vercel.app
```

**Build time**: ~3-5 minutes (first deploy)  
**Subsequent deploys**: ~1-2 minutes

---

## 🎓 Learning Resources

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Express + Vercel**: https://vercel.com/docs/frameworks/express
- **Vite + Vercel**: https://vercel.com/docs/frameworks/vite

---

## ✨ What Happens After Deploy

1. **Automatic Deployments**
   - Every `git push origin main` triggers auto-deploy
   - Previous version stays available for rollback

2. **Production Monitoring**
   - Check Vercel dashboard for error logs
   - Monitor API response times
   - Set up email alerts (optional)

3. **Database Backups**
   - Supabase: Automatic 7-day retention
   - Manual: Run `npm run backfill:*` scripts as needed

4. **Updates**
   - Just push code → Vercel auto-deploys
   - No manual server management

---

## 🎯 Next Steps

### Now
1. Read `VERCEL_QUICKSTART.md`
2. Set up Supabase database
3. Deploy to Vercel

### After Successful Deploy
1. Test all endpoints
2. Run database backfill: `npm run backfill:publ-correction-lists`
3. Test Verbeterlijst features
4. Add custom domain (optional)

### Later
1. Set up monitoring/alerts
2. Migrate file uploads to S3/Blob
3. Performance optimization
4. Load testing

---

## 💡 Pro Tips

✅ **Use environment variable preview**: Create `.env.local` with production secrets for local testing  
✅ **Test print function**: Verbeterlijst print preview works in development - test before deploy  
✅ **Check cold starts**: First request to backend takes 3-5s (normal on Vercel Functions)  
✅ **Git workflow**: Use branches for features, merge to `main` for production deploy  
✅ **Rollback strategy**: Keep previous deployments - can revert via Vercel dashboard  

---

## 🆘 Need Help?

1. **Read**: Check relevant MD file for your issue
2. **Check logs**: Vercel dashboard → Deployments → Logs
3. **Test locally**: Run `npm run build && npm start --prefix backend`
4. **Verify env**: Check all variables in Vercel dashboard

---

**Happy deploying! 🎉**

For step-by-step instructions, start with `VERCEL_QUICKSTART.md`
