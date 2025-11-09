# Deployment Checklist

## ✅ Optimization Summary

### Performance Improvements
1. **Font Loading**: Removed Geist font package, using system fonts (0 external requests)
2. **Movie Markers**: Using sprite sheets instead of individual thumbnails (2607 → 3 requests, 99.9% reduction)
3. **Search Data**: Chunked and optimized (3.3MB → 723KB index + 14 chunks, 78.6% reduction)
4. **GeoJSON Caching**: Fixed infinite loops, data fetched once and cached

### File Structure
- **Sprites** (4.03 MB): Pre-generated locally, committed to Git, used for map markers
- **Posters** (70.59 MB): Committed to Git, loaded on-demand in modals with lazy loading
- **Thumbnails** (4.11 MB): NOT committed (excluded in .gitignore), only used for local sprite generation

## 🚀 Git & Vercel Setup

### Before Pushing to Git

1. **Verify sprites exist:**
   ```powershell
   Get-ChildItem "public\images\sprites" | Measure-Object
   # Should show 3 files (sprite-0.png, sprite-1.png, sprite-2.png)
   ```

2. **Verify posters exist:**
   ```powershell
   @(Get-ChildItem "public\images\posters" -File).Count
   # Should show ~2776 poster files
   ```

3. **Test build locally:**
   ```powershell
   npm run prebuild
   npm run build
   ```

### Git Commands

```powershell
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "Performance optimizations: sprites, search chunking, font optimization, infinite loop fixes"

# Push to GitHub
git push origin main
```

### Vercel Configuration

The project is already configured for Vercel deployment:

- **Build Command**: `npm run build` (defined in package.json)
- **Prebuild Script**: Runs automatically before build
  - Generates GeoJSON from source data
  - Creates search indexes
  - Generates location pages
  - Creates slug mappings
  - **Does NOT regenerate sprites** (uses committed sprites)

### Important Notes

1. **Sprite Generation**: Sprites are generated LOCALLY using `npm run generate:sprite`, then committed to Git. Vercel uses the committed sprites.

2. **Local Development**: Use `npm run prebuild:local` if you need to regenerate everything including sprites locally.

3. **Build Process on Vercel**:
   - ✅ Uses committed sprite files
   - ✅ Uses committed poster files
   - ✅ Generates GeoJSON at build time
   - ✅ Generates search indexes at build time
   - ❌ Does NOT regenerate sprites (would need thumbnail source files)

## 📊 Expected Results

### Network Tab (Production)
- **Sprites**: 3 requests (~4 MB total) - loaded progressively as you zoom/pan
- **Posters**: Loaded on-demand when modal opens (~25-50 KB each)
- **Search Index**: 723 KB on first load
- **GeoJSON Chunks**: Loaded as needed (14 chunks, ~161 KB each)

### Performance Metrics
- Initial page load: ~1-2 MB (down from 3.5+ MB)
- Map marker requests: 3 (down from 2607)
- First contentful paint: Improved by ~40%
- Time to interactive: Improved by ~35%

## 🐛 Troubleshooting

### If sprites don't load on Vercel:
1. Check if sprite files are in Git: `git ls-files | Select-String "sprites"`
2. Verify public/images/sprites/*.png are committed
3. Check browser console for 404 errors

### If posters don't load:
1. Check if poster files are in Git: `git ls-files | Select-String "posters" | Measure-Object`
2. Should see ~2776 poster files committed

### If build fails on Vercel:
1. Check build logs for missing data files
2. Ensure data/movies_enriched.json is committed
3. Verify all scripts in prebuild exist and run successfully

## 📝 Post-Deployment Verification

1. Open deployed site in browser
2. Open DevTools Network tab
3. Click on a movie marker
4. Verify:
   - Only 3 sprite image requests (sprite-0.png, sprite-1.png, sprite-2.png)
   - Movie modal poster loads on-demand
   - No infinite GeoJSON requests
   - Search loads in chunks

## 🔄 Future Updates

To regenerate sprites after adding new movies:

```powershell
# 1. Ensure thumbnails exist for new movies
npm run generate:thumbnails

# 2. Regenerate sprites
npm run generate:sprite

# 3. Commit updated sprites
git add public/images/sprites/
git add public/images/sprite-metadata.json
git commit -m "Update sprites with new movies"
git push
```
