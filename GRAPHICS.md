# 🎨 LELEMBUT — Dokumentasi Sistem Grafis

> File ini mendokumentasikan seluruh implementasi sistem grafis game, termasuk tier kualitas, teknik rendering, dan optimisasi yang telah diterapkan.

---

## Tier Kualitas Grafis

Sistem grafis terbagi menjadi **4 tier** yang dapat diubah di menu **Settings → Graphics → Graphics Quality**.

Pengaturan disimpan di `localStorage` dengan key `lelembut_graphics_quality` dan diakses secara global melalui `window.graphicsQuality`.

---

### ⚡ Ultra

**Target:** PC/laptop gaming, layar lebar, GPU dedicated.

| Komponen | Detail |
|---|---|
| Raycast | 200 rays, step 3px (Penetrasi: 25 unit) |
| Blur shadow | `filter: blur(45px)` |
| Ambient blend | `filter: blur(18px)` pada `ambLightCvs` |
| Bloom | Multi-layer dari **ujung senter (gun tip)** |
| Chromatic Aberration (dunia) | SVG `feColorMatrix` filter pada canvas element — R channel −1.0px, B channel +1.0px |
| Lens Flare | ❌ Dimatikan |
| Block outline | ✅ Aktif dengan `blur(1.5px)` |

**Detail efek Ultra:**
- **LAYER 1 (Halo):** Cahaya bocor membulat di pangkal senter (tidak berputar/cone), sangat pendek (`radius * 0.35`), `blur(28px)`, blend `overlay`
- **LAYER 2 (Core):** Inti panas putih dari ujung senter, `blur(10px)`, `radius * 0.38`, blend `overlay`
- **LAYER 3 (RGB Split):** Dispersi warna pada kerucut cahaya — R channel offset +perp, B channel offset −perp, `blur(7px)`, blend `screen`
- **World CA:** SVG filter `url(#ca-ultra)` diapply ke CSS `filter` pada element canvas (`gameCanvas`), dikelola oleh `changeGraphicsQuality()` dan dipulihkan saat `loadSettings()`

**SVG Filter (di `index.html`):**
```html
<filter id="ca-ultra" color-interpolation-filters="sRGB" x="-2%" y="-2%" width="104%" height="104%">
    <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
    <feOffset dx="-1.0" dy="0" in="red" result="red-s"/>
    <feOffset dx="1.0"  dy="0" in="blue" result="blue-s"/>
    <feBlend in="red-s" in2="green" mode="screen" result="rg"/>
    <feBlend in="rg" in2="blue-s" mode="screen"/>
</filter>
```

---

### 🔴 High

**Target:** PC/laptop biasa, HP flagship.

| Komponen | Detail |
|---|---|
| Raycast | 160 rays, step 4px (Penetrasi: 25 unit) |
| Blur shadow | `filter: blur(45px)` |
| Ambient blend | `filter: blur(18px)` pada `ambLightCvs` |
| Bloom | 1 layer halus dari gun tip, `blur(18px)`, `radius * 0.85`, blend `overlay` |
| Chromatic Aberration | ❌ |
| Lens Flare | ❌ |
| Block outline | ✅ Aktif dengan `blur(1.5px)` |

---

### 🟡 Medium

**Target:** HP mid-range, performa seimbang.

| Komponen | Detail |
|---|---|
| Raycast | 120 rays, step 5px (Penetrasi: 15 unit) |
| Blur shadow | `filter: blur(16px)` |
| Ambient blend | `filter: blur(8px)` pada `ambLightCvs` |
| Bloom | 1 layer sederhana tanpa filter |
| Chromatic Aberration | ❌ |
| Block outline | ✅ Aktif tanpa blur |

**Catatan teknis:** Blur cost skala kuadratik terhadap radius. `16² = 256` vs `45² = 2025` — Medium ~8× lebih hemat dari High untuk blur pass namun tetap sangat halus.

---

### 🟢 Low

**Target:** HP kentang, koneksi lemah, baterai hemat.

| Komponen | Detail |
|---|---|
| Raycast | 120 rays, step 5px |
| Blur shadow | `filter: blur(3px)` (~7× lebih ringan dari Medium) |
| Ambient blend | `filter: blur(3px)` pada `ambLightCvs` |
| Bloom | ❌ Dilewati sepenuhnya |
| Chromatic Aberration | ❌ |
| Lens Flare | ❌ |
| Block outline | ❌ Dimatikan |

---

## Perbandingan Biaya Komputasi

```
GPU blur cost (relatif):
  Low    blur(3px)  →  3² =    9 unit  ██
  Medium blur(8px)  →  8² =   64 unit  ████████████
  High   blur(45px) → 45² = 2025 unit  ████████████████████████████████████████████████
  Ultra  blur(45px) → 45² = 2025 unit  + SVG CA (1 GPU pass)

Raycast CPU cost (per frame):
  Low/Medium  120 rays × step 5  →  ~480 iterations per ray
  High        160 rays × step 4  →  ~500 iterations per ray
  Ultra       200 rays × step 3  →  ~667 iterations per ray
```

---

## Arsitektur Rendering Cahaya (`js/lighting.js`)

```
lightDraw(ctx, px, py)
│
├─ 1. Buat kegelapan dasar (fillRect hitam di lightCvs)
│
├─ 2. Ambient light di sekitar player (radial gradient, destination-out)
│
├─ 3. Flashlight Raycast
│   ├─ Ultra: 200 rays, step 3
│   ├─ High:  160 rays, step 4
│   └─ Med/Low: 120 rays, step 5
│
├─ 4. Isi kerucut cahaya (radial gradient)
│   ├─ Ultra/High: blur(45px) → fill → reset
│   ├─ Medium:     blur(8px)  → fill → reset
│   └─ Low:        blur(3px)  → fill → reset
│
├─ 5. Secondary lights (obor/lampu) di ambLightCvs (0.5× resolusi)
│   └─ Blend ke lightCvs dengan:
│       ├─ Ultra/High: blur(18px)
│       ├─ Medium:     blur(8px)
│       └─ Low:        blur(3px)
│
├─ 6. Block outline highlight (NOT 'low')
│   ├─ High/Ultra: blur(1.5px)
│   └─ Medium:     tanpa blur
│
├─ 7. ctx.drawImage(lightCvs) — terapkan darkness ke scene
│
└─ 8. Bloom / Post-effects (skip jika 'low')
    ├─ High: 1 layer bloom dari gun tip, blur(18px), overlay
    └─ Ultra:
        ├─ LAYER 1: Halo lebar dari gun tip (blur 28px, overlay)
        ├─ LAYER 2: Core panas dari gun tip (blur 10px, overlay)
        ├─ LAYER 3: RGB split dari gun tip (blur 7px, screen)
        └─ LAYER 4: Lens flare streak berputar (blur 3px, screen)
```

---

## Posisi Gun Tip

Untuk Ultra, titik origin efek cahaya mengikuti ujung senter secara dinamis:

```javascript
const GUN_REACH = 22;  // pixel dari center player
const gsx = sx + Math.cos(lightAngle) * GUN_REACH;
const gsy = sy + Math.sin(lightAngle) * GUN_REACH * 0.75;
```

Ini membuat cahaya bocor terasa lebih hidup dan natural, bergerak mengikuti rotasi senter, bukan terpaku di tengah karakter.

---

## Optimisasi Utama yang Diterapkan

| Optimisasi | Detail | Dampak |
|---|---|---|
| Hapus `willReadFrequently` | `lightCvs` kini disimpan di GPU VRAM, bukan CPU RAM | Compositing lebih cepat |
| Kurangi numRays | High: 240→160, Med/Low: 240→120 | −33% / −50% CPU raycast |
| Naikkan step | High: 3→4, Med/Low: 3→5 | −25% / −40% iterasi per ray |
| ambLightCvs 0.5× resolusi | Secondary lights dirender di half-res, bilinear upscale gratis | −75% pixel area untuk ambLightCvs |
| GPU-native blur tier | Blur radius berbeda per tier | Sampai 224× lebih hemat di Low vs High |
| SVG filter untuk CA | Chromatic aberration diproses 1× GPU pass | Hampir nol overhead CPU |

---

## File yang Terlibat

| File | Perubahan |
|---|---|
| `js/lighting.js` | Seluruh sistem pencahayaan, blur tier, bloom, Ultra effects |
| `js/settings.js` | `changeGraphicsQuality()`, `loadSettings()` untuk restore Ultra CA |
| `index.html` | SVG filter `#ca-ultra`, dropdown opsi grafis |
| `js/globals.js` | `_baseCanvasFilter` — basis CSS filter canvas |

---

*Terakhir diperbarui: 2026-06-17*
