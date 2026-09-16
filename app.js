// app.js

// 1. INISIALISASI DATABASE LOKAL (LocalStorage)
let dbKelas = JSON.parse(localStorage.getItem('db_kelas')) || [];
let dbSiswa = JSON.parse(localStorage.getItem('db_siswa')) || [];
let dbSoal = JSON.parse(localStorage.getItem('db_soal')) || [];
let dbHasil = JSON.parse(localStorage.getItem('db_hasil')) || [];

// Warna rotasi untuk membedakan kartu tiap kelas secara visual
const paletteKelas = ['#2F7A6C', '#C98A2C', '#6E4B72', '#3B5787', '#B5533F'];

// State form Bank Soal
let kunciTerpilih = '';
let editingSoalId = null;

// ---- Migrasi data lama ----
// Jika sebelumnya ada siswa tanpa id_kelas (dari versi lama aplikasi),
// buatkan satu kelas default agar data lama tidak hilang.
(function migrasiDataLama() {
    let adaSiswaTanpaKelas = dbSiswa.some(s => !s.id_kelas);
    if (adaSiswaTanpaKelas) {
        let kelasDefault = dbKelas.find(k => k.nama === 'Kelas Lama');
        if (!kelasDefault) {
            kelasDefault = { id: 1, nama: 'Kelas Lama' };
            dbKelas.unshift(kelasDefault);
        }
        dbSiswa.forEach(s => { if (!s.id_kelas) s.id_kelas = kelasDefault.id; });
        localStorage.setItem('db_kelas', JSON.stringify(dbKelas));
        localStorage.setItem('db_siswa', JSON.stringify(dbSiswa));
    }

    // Soal lama mungkin tidak punya field "pilihan" (bug versi sebelumnya
    // tidak menyimpan pilihan A-D). Beri objek kosong agar tidak error saat dirender.
    dbSoal.forEach(s => { if (!s.pilihan) s.pilihan = { A: '', B: '', C: '', D: '' }; });
    localStorage.setItem('db_soal', JSON.stringify(dbSoal));
})();

// ---- Notifikasi ringan (toast) ----
function showToast(pesan) {
    let toastEl = document.getElementById('toast');
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.id = 'toast';
        toastEl.className = 'toast';
        document.body.appendChild(toastEl);
    }
    toastEl.innerText = pesan;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// 2. NAVIGASI HALAMAN
function switchTab(tabId, subtitle, btnElement) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('page-' + tabId).classList.add('active');
    btnElement.classList.add('active');
    document.getElementById('header-subtitle').innerText = subtitle;

    // Render ulang data saat pindah tab
    if(tabId === 'kelas') { renderKelasOptions(); renderSemuaKelas(); }
    if(tabId === 'soal') renderSoal();
    if(tabId === 'kamera') renderPilihanSoalKamera();
    if(tabId === 'hasil') renderHasil();
}

// 3. FITUR KELAS & SISWA

// -- Kelola Kelas --
function tambahKelas() {
    let inputEl = document.getElementById('nama-kelas');
    let nama = inputEl.value.trim();
    if (!nama) return alert("Nama kelas tidak boleh kosong!");

    let sudahAda = dbKelas.some(k => k.nama.toLowerCase() === nama.toLowerCase());
    if (sudahAda) return alert("Kelas dengan nama itu sudah ada!");

    let idBaru = dbKelas.length > 0 ? Math.max(...dbKelas.map(k => k.id)) + 1 : 1;
    dbKelas.push({ id: idBaru, nama: nama });
    localStorage.setItem('db_kelas', JSON.stringify(dbKelas));

    inputEl.value = '';
    renderKelasOptions();
    renderSemuaKelas();
    showToast(`Kelas "${nama}" ditambahkan`);
}

function hapusKelas(idKelas) {
    let kelas = dbKelas.find(k => k.id === idKelas);
    if (!kelas) return;

    let jumlahSiswa = dbSiswa.filter(s => s.id_kelas === idKelas).length;
    let pesan = jumlahSiswa > 0
        ? `Kelas "${kelas.nama}" berisi ${jumlahSiswa} siswa. Menghapus kelas ini akan menghapus semua siswa dan nilai mereka juga. Lanjutkan?`
        : `Hapus kelas "${kelas.nama}"?`;
    if (!confirm(pesan)) return;

    let idSiswaTerhapus = dbSiswa.filter(s => s.id_kelas === idKelas).map(s => s.id);

    dbKelas = dbKelas.filter(k => k.id !== idKelas);
    dbSiswa = dbSiswa.filter(s => s.id_kelas !== idKelas);
    dbHasil = dbHasil.filter(h => !idSiswaTerhapus.includes(h.id_siswa));

    localStorage.setItem('db_kelas', JSON.stringify(dbKelas));
    localStorage.setItem('db_siswa', JSON.stringify(dbSiswa));
    localStorage.setItem('db_hasil', JSON.stringify(dbHasil));

    renderKelasOptions();
    renderSemuaKelas();
}

// Isi dropdown pilihan kelas saat menambah siswa
function renderKelasOptions() {
    let select = document.getElementById('pilih-kelas-siswa');
    if (!select) return;

    if (dbKelas.length === 0) {
        select.innerHTML = '<option value="">-- Tambah kelas dulu di atas --</option>';
        return;
    }

    let kelasTerpilihSebelumnya = select.value;
    let html = '<option value="">-- Pilih Kelas --</option>';
    dbKelas.forEach(k => {
        html += `<option value="${k.id}">${k.nama}</option>`;
    });
    select.innerHTML = html;

    if (kelasTerpilihSebelumnya && dbKelas.some(k => k.id == kelasTerpilihSebelumnya)) {
        select.value = kelasTerpilihSebelumnya;
    }
}

// -- Tambah Siswa Banyak Sekaligus --
function tambahSiswaBanyak() {
    let idKelas = parseInt(document.getElementById('pilih-kelas-siswa').value);
    let textareaEl = document.getElementById('nama-siswa-banyak');

    if (!idKelas) return alert("Pilih kelas tujuan terlebih dahulu!");

    let baris = textareaEl.value
        .split('\n')
        .map(nama => nama.trim())
        .filter(nama => nama.length > 0);

    if (baris.length === 0) return alert("Masukkan minimal satu nama siswa (satu nama per baris)!");

    let idBerikutnya = dbSiswa.length > 0 ? Math.max(...dbSiswa.map(s => s.id)) + 1 : 1;

    baris.forEach(nama => {
        dbSiswa.push({ id: idBerikutnya, nama: nama, id_kelas: idKelas });
        idBerikutnya++;
    });

    localStorage.setItem('db_siswa', JSON.stringify(dbSiswa));

    textareaEl.value = '';
    renderSemuaKelas();
    showToast(`${baris.length} siswa berhasil ditambahkan`);
}

// Render satu tabel siswa per kelas (bukan satu daftar gabungan), tiap kelas berwarna berbeda
function renderSemuaKelas() {
    let container = document.getElementById('semua-daftar-kelas');
    if (!container) return;

    if (dbKelas.length === 0) {
        container.innerHTML = `<div class="card"><p class="info-kosong">Belum ada kelas. Tambahkan kelas terlebih dahulu di form di atas.</p></div>`;
        return;
    }

    let html = '';
    dbKelas.forEach((kelas, idx) => {
        let siswaKelasIni = dbSiswa.filter(s => s.id_kelas === kelas.id);
        let warna = paletteKelas[idx % paletteKelas.length];
        let inisial = kelas.nama.trim().charAt(0).toUpperCase() || '?';

        html += `<div class="card kelas-card" style="--kelas-color:${warna};">
            <div class="kelas-card-header">
                <div class="kelas-identitas">
                    <span class="kelas-avatar">${inisial}</span>
                    <h3>${kelas.nama} <span class="badge">${siswaKelasIni.length} siswa</span></h3>
                </div>
                <button class="btn-danger btn-hapus-kelas" onclick="hapusKelas(${kelas.id})">Hapus</button>
            </div>`;

        if (siswaKelasIni.length === 0) {
            html += `<p class="info-kosong">Belum ada siswa di kelas ini.</p>`;
        } else {
            html += `<table class="tabel-siswa">
                <thead><tr><th>No</th><th>Nama</th><th></th></tr></thead>
                <tbody>`;
            siswaKelasIni.forEach((s, i) => {
                html += `<tr>
                    <td>${i + 1}</td>
                    <td>${s.nama}</td>
                    <td><button class="btn-danger btn-hapus-siswa" onclick="hapusSiswa(${s.id})">X</button></td>
                </tr>`;
            });
            html += `</tbody></table>`;
        }

        html += `</div>`;
    });

    container.innerHTML = html;
}

function hapusSiswa(idSiswa) {
    dbSiswa = dbSiswa.filter(s => s.id !== idSiswa);
    dbHasil = dbHasil.filter(h => h.id_siswa !== idSiswa);
    localStorage.setItem('db_siswa', JSON.stringify(dbSiswa));
    localStorage.setItem('db_hasil', JSON.stringify(dbHasil));
    renderSemuaKelas();
}

// 4. FITUR BANK SOAL

// Tandai huruf jawaban benar dengan menekan tombol A/B/C/D
function pilihKunci(huruf) {
    kunciTerpilih = huruf;
    document.querySelectorAll('.opsi-huruf').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.huruf === huruf);
    });
}

function resetFormSoal() {
    document.getElementById('teks-soal').value = '';
    document.getElementById('pil-a').value = '';
    document.getElementById('pil-b').value = '';
    document.getElementById('pil-c').value = '';
    document.getElementById('pil-d').value = '';
    kunciTerpilih = '';
    document.querySelectorAll('.opsi-huruf').forEach(btn => btn.classList.remove('selected'));
    editingSoalId = null;
    document.getElementById('soal-form-heading').innerText = 'Buat Soal Baru';
    document.getElementById('btn-simpan-soal').innerText = 'Simpan Soal';
    document.getElementById('btn-batal-edit').style.display = 'none';
}

function tambahSoal() {
    let teks = document.getElementById('teks-soal').value.trim();
    let a = document.getElementById('pil-a').value.trim();
    let b = document.getElementById('pil-b').value.trim();
    let c = document.getElementById('pil-c').value.trim();
    let d = document.getElementById('pil-d').value.trim();

    if (!teks) return alert("Pertanyaan tidak boleh kosong!");
    if (!a || !b || !c || !d) return alert("Semua 4 pilihan jawaban harus diisi!");
    if (!kunciTerpilih) return alert("Tandai jawaban yang benar dengan menekan salah satu huruf A/B/C/D!");

    let pilihan = { A: a, B: b, C: c, D: d };

    if (editingSoalId !== null) {
        let soal = dbSoal.find(s => s.id === editingSoalId);
        soal.teks = teks;
        soal.pilihan = pilihan;
        soal.kunci = kunciTerpilih;
        showToast('Soal berhasil diperbarui');
    } else {
        let idBaru = dbSoal.length > 0 ? Math.max(...dbSoal.map(s => s.id)) + 1 : 1;
        dbSoal.push({ id: idBaru, teks: teks, pilihan: pilihan, kunci: kunciTerpilih });
        showToast('Soal berhasil disimpan');
    }

    localStorage.setItem('db_soal', JSON.stringify(dbSoal));
    resetFormSoal();
    renderSoal();
}

function editSoal(id) {
    let soal = dbSoal.find(s => s.id === id);
    if (!soal) return;

    editingSoalId = id;
    document.getElementById('teks-soal').value = soal.teks;
    document.getElementById('pil-a').value = soal.pilihan?.A || '';
    document.getElementById('pil-b').value = soal.pilihan?.B || '';
    document.getElementById('pil-c').value = soal.pilihan?.C || '';
    document.getElementById('pil-d').value = soal.pilihan?.D || '';
    pilihKunci(soal.kunci);

    document.getElementById('soal-form-heading').innerText = 'Edit Soal';
    document.getElementById('btn-simpan-soal').innerText = 'Perbarui Soal';
    document.getElementById('btn-batal-edit').style.display = 'block';
    document.getElementById('teks-soal').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function batalEditSoal() {
    resetFormSoal();
}

function renderSoal() {
    let container = document.getElementById('daftar-soal');
    let badge = document.getElementById('jumlah-soal-badge');
    if (badge) badge.innerText = dbSoal.length;

    if (dbSoal.length === 0) {
        container.innerHTML = `<p class="info-kosong">Belum ada soal. Buat soal pertama di form di atas.</p>`;
        return;
    }

    let html = '';
    dbSoal.forEach((s, index) => {
        let opsiHtml = '';
        ['A', 'B', 'C', 'D'].forEach(huruf => {
            let teksOpsi = s.pilihan ? s.pilihan[huruf] : '';
            let benar = s.kunci === huruf;
            opsiHtml += `<div class="opsi-preview ${benar ? 'opsi-benar' : ''}">
                <span class="opsi-preview-huruf">${huruf}</span>
                <span>${teksOpsi || '-'}</span>
            </div>`;
        });

        html += `<div class="soal-item">
            <div class="soal-item-header">
                <span class="soal-nomor">Soal ${index + 1}</span>
                <div class="soal-item-aksi">
                    <button class="btn-icon" onclick="editSoal(${s.id})">Edit</button>
                    <button class="btn-icon btn-danger" onclick="hapusSoal(${s.id})">Hapus</button>
                </div>
            </div>
            <p class="soal-teks">${s.teks}</p>
            <div class="opsi-preview-grid">${opsiHtml}</div>
        </div>`;
    });
    container.innerHTML = html;
}

function hapusSoal(id) {
    if (!confirm('Hapus soal ini?')) return;
    dbSoal = dbSoal.filter(s => s.id !== id);
    localStorage.setItem('db_soal', JSON.stringify(dbSoal));
    if (editingSoalId === id) resetFormSoal();
    renderSoal();
}

// 5. FITUR KAMERA & DETEKSI MARKER ArUco
let streamKamera = null;
let detektorAR = null;
let intervalDeteksi = null;

// Jika huruf yang terbaca kamera selalu meleset satu posisi dari yang
// sebenarnya (misal niatnya "B" tapi selalu kebaca "C"), ganti angka ini
// ke 90, 180, atau 270 sampai cocok. Ini perlu dites langsung dengan HP.
const OFFSET_ROTASI = 0;

function renderPilihanSoalKamera() {
    let html = '<option value="">-- Pilih Soal --</option>';
    dbSoal.forEach(s => { html += `<option value="${s.id}">Soal ${s.id}: ${s.teks}</option>`; });
    document.getElementById('pilih-soal-aktif').innerHTML = html;
}

async function bukaKamera() {
    try {
        if (typeof AR === 'undefined') {
            document.getElementById('status-kamera').innerText =
                "Pustaka deteksi marker gagal dimuat. Cek koneksi internet lalu muat ulang halaman.";
            return;
        }
        if (!detektorAR) detektorAR = new AR.Detector();

        // Meminta akses kamera belakang HP
        streamKamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        let video = document.getElementById('kamera-feed');
        video.srcObject = streamKamera;
        document.getElementById('status-kamera').innerText = "Kamera Aktif - Arahkan kartu ke kamera";

        video.addEventListener('loadedmetadata', () => mulaiLoopDeteksi(video), { once: true });
    } catch (err) {
        alert("Gagal membuka kamera. Pastikan menggunakan https:// atau localhost. Error: " + err.message);
    }
}

function tutupKamera() {
    if (streamKamera) {
        streamKamera.getTracks().forEach(track => track.stop());
        streamKamera = null;
        document.getElementById('status-kamera').innerText = "Kamera dimatikan";
    }
    clearInterval(intervalDeteksi);
    intervalDeteksi = null;
    document.getElementById('hasil-deteksi-langsung').innerHTML = `<p class="info-kosong">Kamera belum aktif.</p>`;
}

// Ambil frame video secara berkala, cari marker, lalu render hasilnya
function mulaiLoopDeteksi(video) {
    let canvas = document.getElementById('kamera-canvas');
    let lebar = 320;
    let tinggi = Math.round(lebar * ((video.videoHeight || 240) / (video.videoWidth || 320))) || 240;
    canvas.width = lebar;
    canvas.height = tinggi;
    let ctx = canvas.getContext('2d', { willReadFrequently: true });

    clearInterval(intervalDeteksi);
    intervalDeteksi = setInterval(() => {
        if (!streamKamera) return;
        try {
            ctx.drawImage(video, 0, 0, lebar, tinggi);
            let dataGambar = ctx.getImageData(0, 0, lebar, tinggi);
            let markerTerdeteksi = detektorAR.detect(dataGambar);
            renderHasilDeteksi(markerTerdeteksi);
        } catch (e) {
            // Frame belum siap / kamera baru dibuka, abaikan dan coba lagi di interval berikutnya
        }
    }, 200);
}

// Hitung sudut rotasi marker (derajat) dari posisi sudut-sudutnya di gambar
function hitungSudutMarker(corners) {
    let dx = corners[1].x - corners[0].x;
    let dy = corners[1].y - corners[0].y;
    return Math.atan2(dy, dx) * 180 / Math.PI;
}

// Bulatkan sudut ke posisi terdekat (atas/kanan/bawah/kiri) lalu ubah jadi huruf
function hitungHurufDariSudut(sudutDerajat) {
    let sudut = ((sudutDerajat + OFFSET_ROTASI) % 360 + 360) % 360;
    let posisi = Math.round(sudut / 90) % 4;
    return ['A', 'B', 'C', 'D'][posisi];
}

function renderHasilDeteksi(markers) {
    let container = document.getElementById('hasil-deteksi-langsung');
    if (!container) return;

    if (!markers || markers.length === 0) {
        container.innerHTML = `<p class="info-kosong">Belum ada kartu terdeteksi. Arahkan kartu marker ke kamera.</p>`;
        return;
    }

    let html = '';
    markers.forEach(m => {
        let siswa = dbSiswa.find(s => s.id === m.id);
        let namaSiswa = siswa ? siswa.nama : `Marker ID ${m.id} (tidak dikenali)`;
        let sudut = hitungSudutMarker(m.corners);
        let huruf = hitungHurufDariSudut(sudut);

        html += `<div class="list-item deteksi-item">
            <span>${namaSiswa} — menunjuk <strong>${huruf}</strong> <span class="sudut-debug">(${Math.round(sudut)}°)</span></span>
            <button class="btn-simpan-deteksi" ${siswa ? '' : 'disabled'} onclick="simpanJawabanTerdeteksi(${m.id}, '${huruf}')">Simpan</button>
        </div>`;
    });
    container.innerHTML = html;
}

function simpanJawabanTerdeteksi(idSiswa, huruf) {
    let idSoal = document.getElementById('pilih-soal-aktif').value;
    if (!idSoal) return alert("Pilih soal dulu di atas!");

    let soalAktif = dbSoal.find(s => s.id == idSoal);
    let benar = (soalAktif.kunci === huruf);

    dbHasil.push({ id_siswa: idSiswa, id_soal: idSoal, jawab: huruf, benar: benar });
    localStorage.setItem('db_hasil', JSON.stringify(dbHasil));

    let siswa = dbSiswa.find(s => s.id === idSiswa);
    showToast(`${siswa ? siswa.nama : 'Siswa'} menjawab ${huruf} — tersimpan`);
}

// 6. FITUR HASIL SKOR
function renderHasil() {
    let html = '';
    dbHasil.forEach(h => {
        let siswa = dbSiswa.find(s => s.id == h.id_siswa);
        let namaSiswa = siswa?.nama || "Unknown";
        let namaKelas = dbKelas.find(k => k.id === siswa?.id_kelas)?.nama || "-";
        let warna = h.benar ? "var(--accent-teal-dark)" : "var(--accent-red)";
        html += `<div class="list-item" style="color:${warna}; font-weight:600;">
                    ${namaSiswa} (${namaKelas}) - Soal ${h.id_soal} - Jawab: ${h.jawab}
                 </div>`;
    });
    document.getElementById('daftar-hasil').innerHTML = html || `<p class="info-kosong">Belum ada nilai yang tercatat.</p>`;
}

function hapusSemuaHasil() {
    if(confirm("Yakin hapus semua data nilai?")) {
        dbHasil = [];
        localStorage.setItem('db_hasil', JSON.stringify(dbHasil));
        renderHasil();
    }
}

// 7. FITUR CETAK PDF (dikelompokkan per kelas, kartu berisi marker asli)
function cetakMarkerPDF() {
    if(dbSiswa.length === 0) return alert("Belum ada siswa!");

    if (typeof window.buatSVGMarker !== 'function') {
        return alert("Pustaka pembuat marker belum siap dimuat. Pastikan terhubung internet, tunggu beberapa detik, lalu coba lagi.");
    }

    let areaCetak = document.getElementById('area-cetak');
    areaCetak.style.display = 'block';

    let htmlTemplate = `<p style="margin-bottom:10px;">Cara pakai: putar kartu sampai huruf jawaban berada di sisi ATAS, lalu tunjukkan ke kamera.</p>`;

    dbKelas.forEach(kelas => {
        let siswaKelasIni = dbSiswa.filter(s => s.id_kelas === kelas.id);
        if (siswaKelasIni.length === 0) return;

        htmlTemplate += `<h2 style="margin-top:20px;">Kartu Marker - Kelas ${kelas.nama}</h2>
            <div style="display:flex; flex-wrap:wrap; gap:20px; margin-bottom:10px;">`;

        siswaKelasIni.forEach(s => {
            let svgMarker = window.buatSVGMarker(s.id, '90px');
            htmlTemplate += `
            <div style="border:2px solid #000; width:170px; height:170px; position:relative; text-align:center;">
                <div style="position:absolute; top:4px; width:100%; font-weight:bold;">A</div>
                <div style="position:absolute; bottom:4px; width:100%; font-weight:bold;">C</div>
                <div style="position:absolute; left:6px; top:47%; font-weight:bold;">D</div>
                <div style="position:absolute; right:6px; top:47%; font-weight:bold;">B</div>
                <div style="margin-top:34px;">${svgMarker}</div>
                <div style="font-size:11px; margin-top:2px;">${s.nama}</div>
            </div>`;
        });
        htmlTemplate += '</div>';
    });

    areaCetak.innerHTML = htmlTemplate;

    let opt = {
        margin:       1,
        filename:     'Kartu_Marker_Semua_Kelas.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(areaCetak).save().then(() => {
        areaCetak.style.display = 'none'; 
        alert("PDF berhasil diunduh ke perangkat Anda!");
    });
}

// 8. INISIALISASI AWAL (Render saat aplikasi pertama dibuka)
window.onload = () => {
    renderKelasOptions();
    renderSemuaKelas();
    renderSoal();
};
