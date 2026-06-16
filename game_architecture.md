# Platformer Game Architecture & Documentation

Dokumen ini berfungsi sebagai "Sumber Kebenaran" (*Source of Truth*) untuk pengembangan game platformer ini. Tujuannya adalah untuk memastikan konsistensi dalam penamaan variabel, menghindari *bug* karena salah ruang lingkup (*scope*), dan memberikan peta jalan logika dari game.

## 1. Struktur File & Modul JavaScript

Game ini menggunakan pemisahan file berbasis fungsi, yang semuanya di-*load* ke dalam `index.html` dengan urutan tertentu. Semua variabel yang tidak dibatasi dengan penutup fungsi akan bertindak sebagai **variabel global**.

- `globals.js` : Mendeklarasikan variabel-variabel global fundamental (resolusi, status kamera, status game).
- `input.js` : Menangani masukan pengguna (*keyboard*, *mouse*). Menyimpan variabel posisi kursor dan status tombol.
- `audio.js` : Menangani semua *sound effect* dan musik berbasis sintesis (Oscillator).
- `settings.js` : Mengatur konfigurasi lokal (*localStorage*) untuk tampilan grafik (Filter, Film Mode).
- `entities.js` : Mendefinisikan entitas pemain (`player`) dengan segala propertinya, serta fungsi `updateHUD()` untuk elemen UI.
- `map.js` : Menangani struktur data *map*, pengambilan *tile*, resolusi tabrakan statis, dan struktur awal peta.
- `camera.js` : Logika *pan/zoom/shake* kamera dan penguncian bidikan kamera.
- `physics.js` : Fungsi tabrakan berbasis *AABB* (Axis-Aligned Bounding Box) dan manajemen entitas (menggerakkan musuh, dsb).
- `render.js` : Tempat semua fungsi menggambar kanvas (`drawBG`, `drawTiles`, `drawPlayer`, `drawEnemy`, partikel, alat editor).
- `api.js` : Komunikasi dengan *backend* (`api.php`) untuk mengambil (`load`) atau menyimpan (`save`) peta.
- `editor.js` : Logika *Map Editor* (alat kuas, pemilihan objek, pan editor, dsb).
- `main.js` : Inti game. Memuat `loop()` menggunakan `requestAnimationFrame`. Menangani transisi `gameState`, pergerakan dasar, penembakan senjata, dan pembaruan logika musuh (`updatePlay`).
- `lighting.js` : Menangani sistem pencahayaan dinamis berbasis kanvas gelap dan *gradient mask*.

---

## 2. Status Game (`gameState`)
Game berputar di antara beberapa status yang didefinisikan dalam `globals.js`:
- `'MENU'` : Tampilan awal menu.
- `'LEVEL_SELECT'` : Pemilihan level.
- `'PLAY'` : Sedang bermain di dalam map. Menjalankan fungsi `updatePlay()`.
- `'PAUSE'` : Bermain, tetapi dijeda. Menggambar tampilan terakhir, namun berhenti memperbarui pergerakan.
- `'EDITOR'` : Membangun/mengedit peta. Menjalankan logika dari `editor.js`.

---

## 3. Variabel Input & Kamera Global Penting

**Sistem Kamera:**
- `cam` : Sebuah *object* `{x, y, w, h, mw, mh, lock}`. Titik kiri-atas kamera (di dunia game).
- `camZoom` / `camZoomTarget` / `zoomState` : Mengendalikan penskalaan (*scaling*) konteks kanvas (2D Context).

**Sistem Input (Bidik & Tembak):**
- `keys` : *Object* yang mencatat status ditekan/tidaknya tombol (contoh: `keys.shoot`, `keys.jump`).
- `mouseX` / `mouseY` : Posisi mentah kursor relatif terhadap layar kanvas. Diperbarui otomatis dari *event listener* mouse.
- `aimMode` : Dapat bernilai `'keyboard'` atau `'mouse'`. Dikontrol dengan tombol **Q**.

---

## 4. Entitas Pemain (`player`)
Dideklarasikan di `entities.js`.

**Properti Dasar Fisika:**
- `x`, `y` : Posisi kiri atas pemain di dunia game.
- `vx`, `vy` : Kecepatan gerak Horizontal & Vertikal.
- `w`, `h` : Dimensi (*hitbox*) dari pemain.
- `grounded` : Status `true` jika pemain sedang berpijak di tanah.

**Properti Status (*Survival*):**
- `hp`, `maxHp` : Darah / Nyawa pemain.
- `battery`, `maxBattery` : Baterai senter untuk navigasi di kegelapan.
- `nvTimer` : Waktu aktif (detik) dari efek *Night Vision*.
- `breath`, `maxBreath`, `isWater` : Mengukur oksigen pemain ketika masuk ke dalam wilayah *Air*.

**Sistem Senjata (*Weapons*):**
- Disimpan dalam sebuah *array of objects* `player.weapons`.
- Indeks senjata saat ini ditandai oleh `player.weapIdx`.
- Fungsi bawaan (*Getter/Setter*) `player.ammo`, `player.mag`, `player.currentWeapon` merujuk ke elemen aktif dari array `weapons` untuk meminimalisir kode berulang.
- `player.gunAngle` : Disimpan ketika menghitung arah kursor di `main.js` agar bisa dipakai oleh fungsi `drawPlayer` di `render.js`.

---

## 5. Tile Maps & Objek
Didefinisikan dalam konstanta di `map.js`:
- `0` = Kosong
- `1` = Tanah (Dirt)
- `2` = Batu (Stone)
- `3` = Besi (Metal)
- `4` = Es (Ice) -> Licin
- `5` = Kaca (Glass) -> Tembus pandang
- `6` = Platform (Bisa dilompati dari bawah)
- `7` = Spike -> Menyebabkan kerusakan
- `8` = Bouncer -> Memantulkan pemain tinggi
- `9` = Air (Water) -> Logika renang, gravitasi lebih lambat, bernapas
- `10`= Lava -> Serupa air namun membakar
- `11`= Tangga (Ladder) -> Mengubah gravitasi nol, memanjat dengan tombol W/S.

*Pickups* (Barang yang bisa dipungut):
Memiliki properti `{ t: 'jenis', x, y, mapIdx, got: 0/1 }`.
Jenis: `hp`, `ammo`, `ammo_mg`, `ammo_sniper`, `battery`, `check`, `end`, `nightvision`.

---

## 6. Konfigurasi Kritis & Pencegahan Kesalahan (JANGAN DIRUSAK!)
Bagian ini berisi peringatan dan konfigurasi penting berdasarkan *bug* yang pernah terjadi, agar tidak terulang kembali di masa depan:

1. **Akses DOM UI (Null Checks)**: 
   Pembaruan elemen HTML via JavaScript di fungsi `updateHUD()` (seperti ikon paru-paru, night vision, baterai) **HARUS SELALU** dibungkus menggunakan blok asersi eksistensi (`if(element)`). Jika tidak, game akan *crash* dengan layar hitam (*black screen*) jika browser memuat versi HTML dari *cache* lama.

2. **Deklarasi Variabel & *Block Scope***: 
   JavaScript ES6 menggunakan *Block Scope* untuk `let` dan `const`. JANGAN mendeklarasikan variabel penting (seperti `let wasG = player.grounded`) di dalam blok `if` atau `else` jika variabel tersebut akan diakses di baris bawahnya (misal: untuk mendeteksi pantulan karakter). Hal ini memicu *ReferenceError*.

3. **Status Bidikan (*Aiming*)**: 
   - Mode bidikan ditentukan oleh `aimMode` yang bernilai `'mouse'` atau `'keyboard'`. **JANGAN** menggunakan nama lain seperti `isAimMode`.
   - Posisi kursor murni disimpan di `mouseX` dan `mouseY`. **JANGAN** memanggilnya dengan nama `aimX` atau `aimY`.
   - Perhitungan sudut senjata (`player.gunAngle`) **HARUS** diletakkan di dalam *loop* utama (`updatePlay`) dan terlepas dari kondisi tombol tembak (`keys.shoot`). Jika dimasukkan ke dalam blok tembak, lengan karakter akan kaku dan tidak mau berputar mengikuti kursor jika karakter tidak sedang menembak.

4. **Kecerdasan Buatan Musuh (AI)**:
   - Musuh mengandalkan deteksi tepi jurang (*ledge detection*) **sebelum** fungsi `moveAndCollide(e, dt)` dan fungsi naik blok (*step up*) **setelah** fungsi `moveAndCollide(e, dt)`. Urutan ini sangat rapuh, pastikan tidak diacak atau dihapus saat memodifikasi fisika musuh.
