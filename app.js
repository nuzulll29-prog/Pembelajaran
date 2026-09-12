// app.js

// 1. INISIALISASI DATABASE LOKAL (LocalStorage)
let dbSiswa = JSON.parse(localStorage.getItem('db_siswa')) || [];
let dbSoal = JSON.parse(localStorage.getItem('db_soal')) || [];
let dbHasil = JSON.parse(localStorage.getItem('db_hasil')) || [];

// 2. NAVIGASI HALAMAN
function switchTab(tabId, title, btnElement) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('page-' + tabId).classList.add('active');
    btnElement.classList.add('active');
    document.getElementById('app-header').innerText = title;
    
    // Render ulang data saat pindah tab
    if(tabId === 'kelas') renderSiswa();
    if(tabId === 'soal') renderSoal();
    if(tabId === 'kamera') renderPilihanSoalKamera();
    if(tabId === 'hasil') renderHasil();
}

// 3. FITUR KELAS & SISWA
function tambahSiswa() {
    let nama = document.getElementById('nama-siswa').value;
    if(!nama) return alert("Nama tidak boleh kosong!");
    let idBaru = dbSiswa.length > 0 ? dbSiswa[dbSiswa.length-1].id + 1 : 1;
    dbSiswa.push({ id: idBaru, nama: nama });
    localStorage.setItem('db_siswa', JSON.stringify(dbSiswa));
    document.getElementById('nama-siswa').value = '';
    renderSiswa();
}

function renderSiswa() {
    let html = '';
    dbSiswa.forEach((s, index) => {
        html += `<div class="list-item"><span>${s.id}. ${s.nama}</span> 
                 <button onclick="hapusSiswa(${index})" style="width:auto; padding:5px 10px; margin:0;" class="btn-danger">X</button></div>`;
    });
    document.getElementById('daftar-siswa').innerHTML = html;
}

function hapusSiswa(index) {
    dbSiswa.splice(index, 1);
    localStorage.setItem('db_siswa', JSON.stringify(dbSiswa));
    renderSiswa();
}

// 4. FITUR BANK SOAL
function tambahSoal() {
    let teks = document.getElementById('teks-soal').value;
    let kunci = document.getElementById('kunci-jawaban').value;
    if(!teks || !kunci) return alert("Soal dan Kunci harus diisi!");
    let idBaru = dbSoal.length > 0 ? dbSoal[dbSoal.length-1].id + 1 : 1;
    dbSoal.push({ id: idBaru, teks: teks, kunci: kunci });
    localStorage.setItem('db_soal', JSON.stringify(dbSoal));
    alert("Soal tersimpan!");
    
    // Kosongkan form setelah simpan
    document.getElementById('teks-soal').value = '';
    document.getElementById('kunci-jawaban').value = '';
    renderSoal();
}

function renderSoal() {
    let html = '';
    dbSoal.forEach((s, index) => {
        html += `<div class="list-item"><span>${s.id}. ${s.teks} (Kunci: ${s.kunci})</span>
                 <button onclick="hapusSoal(${index})" style="width:auto; padding:5px 10px; margin:0;" class="btn-danger">X</button></div>`;
    });
    document.getElementById('daftar-soal').innerHTML = html;
}

function hapusSoal(index) {
    dbSoal.splice(index, 1);
    localStorage.setItem('db_soal', JSON.stringify(dbSoal));
    renderSoal();
}

// 5. FITUR KAMERA WEBRTC
let streamKamera = null;

function renderPilihanSoalKamera() {
    let html = '<option value="">-- Pilih Soal --</option>';
    dbSoal.forEach(s => { html += `<option value="${s.id}">Soal ${s.id}: ${s.teks}</option>`; });
    document.getElementById('pilih-soal-aktif').innerHTML = html;
}

async function bukaKamera() {
    try {
        // Meminta akses kamera belakang HP
        streamKamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        document.getElementById('kamera-feed').srcObject = streamKamera;
        document.getElementById('status-kamera').innerText = "Kamera Aktif - Siap Scan";
    } catch (err) {
        alert("Gagal membuka kamera. Pastikan menggunakan https:// atau localhost. Error: " + err.message);
    }
}

function tutupKamera() {
    if(streamKamera) {
        streamKamera.getTracks().forEach(track => track.stop());
        document.getElementById('status-kamera').innerText = "Kamera dimatikan";
    }
}

// Simulasi Scan (Karena pendeteksi pola butuh library OpenCV yang berat)
function simulasiScan() {
    let idSoal = document.getElementById('pilih-soal-aktif').value;
    if(!idSoal) return alert("Pilih soal dulu di atas!");
    
    // Simulasi: Anggap kamera mendeteksi siswa ID 1 menjawab 'A'
    let jawabanTerdeteksi = "A"; 
    let idSiswaTerdeteksi = 1;
    
    let soalAktif = dbSoal.find(s => s.id == idSoal);
    let benar = (soalAktif.kunci === jawabanTerdeteksi);
    
    dbHasil.push({ id_siswa: idSiswaTerdeteksi, id_soal: idSoal, jawab: jawabanTerdeteksi, benar: benar });
    localStorage.setItem('db_hasil', JSON.stringify(dbHasil));
    
    alert(`Terscan! Siswa ID 1 menjawab ${jawabanTerdeteksi}. Jawaban: ${benar ? 'BENAR' : 'SALAH'}`);
}

// 6. FITUR HASIL SKOR
function renderHasil() {
    let html = '';
    dbHasil.forEach(h => {
        let namaSiswa = dbSiswa.find(s => s.id == h.id_siswa)?.nama || "Unknown";
        let warna = h.benar ? "green" : "red";
        html += `<div class="list-item" style="color:${warna}; font-weight:bold;">
                    ${namaSiswa} - Soal ${h.id_soal} - Jawab: ${h.jawab}
                 </div>`;
    });
    document.getElementById('daftar-hasil').innerHTML = html;
}

function hapusSemuaHasil() {
    if(confirm("Yakin hapus semua data nilai?")) {
        dbHasil = [];
        localStorage.setItem('db_hasil', JSON.stringify(dbHasil));
        renderHasil();
    }
}

// 7. FITUR CETAK PDF
function cetakMarkerPDF() {
    if(dbSiswa.length === 0) return alert("Belum ada siswa!");
    
    let areaCetak = document.getElementById('area-cetak');
    areaCetak.style.display = 'block';
    
    let htmlTemplate = '<h2>Kartu Marker Siswa</h2><div style="display:flex; flex-wrap:wrap; gap:20px;">';
    
    dbSiswa.forEach(s => {
        htmlTemplate += `
        <div style="border:2px solid #000; width:150px; height:150px; position:relative; text-align:center;">
            <div style="position:absolute; top:5px; width:100%; font-weight:bold;">A</div>
            <div style="position:absolute; bottom:5px; width:100%; font-weight:bold;">C</div>
            <div style="position:absolute; left:5px; top:45%; font-weight:bold;">D</div>
            <div style="position:absolute; right:5px; top:45%; font-weight:bold;">B</div>
            <div style="margin-top:40px; font-size:24px; font-weight:bold;">ID: ${s.id}</div>
            <div style="font-size:12px;">${s.nama}</div>
        </div>`;
    });
    htmlTemplate += '</div>';
    areaCetak.innerHTML = htmlTemplate;

    let opt = {
        margin:       1,
        filename:     'Kartu_Marker_Kelas.pdf',
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
    renderSiswa();
    renderSoal();
};
