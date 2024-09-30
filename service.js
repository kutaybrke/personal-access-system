import express from 'express';
import mysql from 'mysql2';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import moment from 'moment';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
// app.use(express.static(path.join(__dirname, 'dist')));

// // Tüm yönlendirmeleri index.html'e yönlendirin
// app.get('/*', function (req, res) {
//     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

app.use(bodyParser.json());
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type,Authorization']
}));


const con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT
});

con.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log("Connection successful");
});

// E-posta gönderimi için transporter ayarları
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE, // E-posta hizmeti
    auth: {
        user: process.env.GMAIL_USER, // E-posta adres
        pass: process.env.GMAIL_PASS // E-posta şifre
    }
});

// Kayıt işlemi
app.post('/register', async (req, res) => {
    const { email, password, tcNumber, isimSoyisim, dogumTarihi } = req.body;

    if (!email || !password || !tcNumber || !isimSoyisim || !dogumTarihi) {
        return res.status(400).send('Lütfen tüm alanları doldurunuz.');
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = 'INSERT INTO kullanicilar (kullanici_mail, kullanici_sifre, kullanici_adi, kullanici_datetime, kullanici_tcno) VALUES (?, ?, ?, ?, ?)';
    const values = [email, hashedPassword, isimSoyisim, dogumTarihi, tcNumber];

    con.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send('Kayıt sırasında bir hata oluştu.');
        }
        res.status(200).send('Kayıt başarılı.');
    });
});

// Giriş işlemi
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        console.log('Email ve şifre eksik:', { email, password });
        return res.status(400).send('Lütfen email ve şifre giriniz.');
    }

    const sql = 'SELECT kullanici_sifre, kullanici_adi, giris_deneme, son_giris_denemesi, engellendi FROM kullanicilar WHERE kullanici_mail = ?';
    con.query(sql, [email], async (err, results) => {
        if (err) {
            console.error('Veritabanı sorgu hatası:', err);
            return res.status(500).send('Giriş sırasında bir hata oluştu.');
        }

        if (results.length === 0) {
            console.log('Bu email ile kullanıcı bulunamadı:', email);
            return res.status(401).send('Geçersiz email veya şifre.');
        }

        const user = results[0];
        const hashedPassword = user.kullanici_sifre;
        const userName = user.kullanici_adi;
        const failedAttempts = user.giris_deneme;
        const lastAttempt = new Date(user.son_giris_denemesi);
        const isLocked = user.engellendi;

        const lockoutPeriod = 0.5 * 60 * 1000; // 30 dakika

        if (isLocked) {
            const now = new Date();
            const elapsedTime = now - lastAttempt;

            if (elapsedTime < lockoutPeriod) {
                const remainingTime = lockoutPeriod - elapsedTime;
                return res.status(403).json({
                    message: 'Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin.',
                    remainingTime
                });
            } else {
                // Kilitlenme süresi dolduysa engeli kaldır ve giriş denemelerini sıfırla
                con.query('UPDATE kullanicilar SET engellendi = 0, giris_deneme = 0 WHERE kullanici_mail = ?', [email], async (updateErr) => {
                    if (updateErr) {
                        console.error('Engellemeyi kaldırırken hata:', updateErr);
                        return res.status(500).send('Giriş sırasında bir hata oluştu.');
                    }

                    // Şifre kontrolünü burada yap
                    const match = await bcrypt.compare(password, hashedPassword);

                    if (match) {
                        console.log('Giriş başarılı:', email);
                        return res.status(200).json({ userName });
                    } else {
                        console.log('Şifre uyuşmazlığı:', email);
                        const newFailedAttempts = failedAttempts + 1;
                        let lockout = 0;
                        if (newFailedAttempts >= 5) {
                            lockout = 1;
                        }
                        con.query('UPDATE kullanicilar SET giris_deneme = ?, son_giris_denemesi = ?, engellendi = ? WHERE kullanici_mail = ?', [newFailedAttempts, new Date(), lockout, email], (updateErr) => {
                            if (updateErr) {
                                console.error('Başarısız giriş güncellenirken hata:', updateErr);
                            }
                        });
                        return res.status(401).send('Geçersiz email veya şifre.');
                    }
                });
                return;
            }
        }

        // Şifreyi doğrula ve giriş işlemini gerçekleştir
        const match = await bcrypt.compare(password, hashedPassword);

        if (match) {
            console.log('Giriş başarılı:', email);
            // Giriş başarılı olduğunda denemeleri sıfırla
            con.query('UPDATE kullanicilar SET giris_deneme = 0, engellendi = 0 WHERE kullanici_mail = ?', [email], (updateErr) => {
                if (updateErr) {
                    console.error('Giriş denemeleri sıfırlanırken hata:', updateErr);
                }
            });
            return res.status(200).json({ userName });
        } else {
            console.log('Şifre uyuşmazlığı:', email);
            const newFailedAttempts = failedAttempts + 1;
            let lockout = 0;
            if (newFailedAttempts >= 5) {
                lockout = 1;
            }
            con.query('UPDATE kullanicilar SET giris_deneme = ?, son_giris_denemesi = ?, engellendi = ? WHERE kullanici_mail = ?', [newFailedAttempts, new Date(), lockout, email], (updateErr) => {
                if (updateErr) {
                    console.error('Başarısız giriş güncellenirken hata:', updateErr);
                }
            });
            return res.status(401).send('Geçersiz email veya şifre.');
        }
    });
});



// Şifre sıfırlama işlemi: Token gönderimi
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).send('E-posta adresi gerekli.');
    }

    // Kullanıcı e-posta adresinin veritabanında olup olmadığını kontrol eden sorgu
    const userSql = 'SELECT kullanici_mail FROM kullanicilar WHERE kullanici_mail = ?';
    con.query(userSql, [email], (err, results) => {
        if (err) {
            console.error('Error querying user email:', err);
            return res.status(500).send('E-posta adresi kontrol edilirken bir hata oluştu.');
        }

        if (results.length === 0) {
            return res.status(404).send('E-posta adresi bulunamadı.');
        }

        // Token oluşturup veritabanına ekler
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = moment().add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');

        const sql = 'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)';
        con.query(sql, [email, token, expiresAt], (err) => {
            if (err) {
                console.error('Error inserting token into database:', err);
                return res.status(500).send('Token oluşturulurken bir hata oluştu.');
            }

            // Token'ı e-posta ile gönder
            const mailOptions = {
                from: process.env.GMAIL_USER,
                to: email,
                subject: 'Şifre Sıfırlama Linki',
                text: `Şifre sıfırlama linkiniz: http://localhost:5173/reset-password/${token}`
            };

            transporter.sendMail(mailOptions, (error) => {
                if (error) {
                    console.error('Error sending email:', error);
                    return res.status(500).send('E-posta gönderilirken bir hata oluştu.');
                }
                res.status(200).send('Şifre sıfırlama linki e-postanıza gönderildi.');
            });
        });
    });
});

// Şifre sıfırlama işlemi: Token doğrulama
app.get('/verify-token/:token', (req, res) => {
    const { token } = req.params;

    // Token süresini kontrol 
    const sql = 'SELECT email, expires_at FROM password_resets WHERE token = ?';
    con.query(sql, [token], (err, results) => {
        if (err) {
            console.error('Token sorgulama hatası:', err);
            return res.status(500).send('Token kontrol edilirken bir hata oluştu.');
        }

        if (results.length === 0) {
            return res.status(400).send('Geçersiz veya bulunmayan token.');
        }

        const { expires_at } = results[0];
        const now = moment().format('YYYY-MM-DD HH:mm:ss');

        if (moment(now).isAfter(expires_at)) {
            return res.status(400).send('Token süresi dolmuş.');
        }

        res.status(200).send('Token geçerli.');
    });
});

// Şifre sıfırlama işlemi: Yeni şifre belirleme
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).send('Token ve yeni şifre gereklidir.');
    }

    // Tokeni ve süresini kontrol 
    const sql = 'SELECT email, expires_at FROM password_resets WHERE token = ?';
    con.query(sql, [token], async (err, results) => {
        if (err) {
            console.error('Error querying token:', err);
            return res.status(500).send('Token kontrol edilirken bir hata oluştu.');
        }

        if (results.length === 0) {
            return res.status(400).send('Geçersiz veya bulunmayan token.');
        }

        const { email, expires_at } = results[0];
        const now = moment().format('YYYY-MM-DD HH:mm:ss');

        if (moment(now).isAfter(expires_at)) {
            return res.status(400).send('Token süresi dolmuş.');
        }

        // Yeni şifreyi hashle
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Kullanıcının şifresini güncelle
        const updateSql = 'UPDATE kullanicilar SET kullanici_sifre = ? WHERE kullanici_mail = ?';
        con.query(updateSql, [hashedPassword, email], (err) => {
            if (err) {
                console.error('Error updating password:', err);
                return res.status(500).send('Şifre güncellenirken bir hata oluştu.');
            }

            // Token'ı veritabanından sil
            const deleteSql = 'DELETE FROM password_resets WHERE token = ?';
            con.query(deleteSql, [token], (err) => {
                if (err) {
                    console.error('Error deleting token:', err);
                    return res.status(500).send('Token silinirken bir hata oluştu.');
                }

                res.status(200).send('Şifreniz başarıyla güncellendi.');
            });
        });
    });
});

// Süresi dolmuş token'ları düzenli olarak temizleyen iş
const clearExpiredTokens = () => {
    const sql = 'DELETE FROM password_resets WHERE expires_at < NOW()';
    con.query(sql, (err) => {
        if (err) {
            console.error('Süresi dolmuş token\'ları silerken hata oluştu:', err);
        } else {
            console.log('Süresi dolmuş token\'lar başarıyla silindi.');
        }
    });
};

// 60 dkda bir çalışarak süresi dolmuş tokenleri siler
setInterval(clearExpiredTokens, 60 * 60 * 1000);

// Şifre değiştirme işlemi
app.post('/change-password', async (req, res) => {
    const { oldPassword, newPassword, email } = req.body;

    if (!oldPassword || !newPassword || !email) {
        return res.status(400).json({ message: 'Eski şifre, yeni şifre ve e-posta gereklidir.' });
    }

    // Kullanıcının mevcut şifresini kontrol 
    const sql = 'SELECT kullanici_sifre FROM kullanicilar WHERE kullanici_mail = ?';
    con.query(sql, [email], async (err, results) => {
        if (err) {
            console.error('Veritabanı sorgu hatası:', err);
            return res.status(500).json({ message: 'Bir hata oluştu.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        const hashedPassword = results[0].kullanici_sifre;

        // Eski şifreyi doğrula
        const match = await bcrypt.compare(oldPassword, hashedPassword);
        if (!match) {
            return res.status(401).json({ message: 'Eski şifre yanlış.' });
        }

        // Yeni şifreyi hashle
        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        // Şifreyi güncelle
        const updateSql = 'UPDATE kullanicilar SET kullanici_sifre = ? WHERE kullanici_mail = ?';
        con.query(updateSql, [newHashedPassword, email], (err) => {
            if (err) {
                console.error('Şifre güncelleme hatası:', err);
                return res.status(500).json({ message: 'Şifre güncellenirken bir hata oluştu.' });
            }

            res.status(200).json({ message: 'Şifre başarıyla değiştirildi.' });
        });
    });
});

// Kullanıcı bilgilerini getirme
app.get('/user-info/:email', (req, res) => {
    const { email } = req.params;

    if (!email) {
        return res.status(400).json({ message: 'E-posta adresi gerekli.' });
    }

    const sql = 'SELECT kullanici_mail, kullanici_adi, kullanici_datetime, kullanici_tcno FROM kullanicilar WHERE kullanici_mail = ?';
    con.query(sql, [email], (err, results) => {
        if (err) {
            console.error('Veritabanı sorgu hatası:', err);
            return res.status(500).json({ message: 'Veritabanı sorgusu sırasında bir hata oluştu.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        res.status(200).json(results[0]);
    });
});


// Dosya ve dosya versiyonlarını çekme
app.get('/folder-file-data', (req, res) => {
    const folderSql = 'SELECT klasor_id, klasor_rootid, klasor_isim, klasor_olusturmatrh, klasor_olusturan FROM klasoragaci';
    const fileSql = 'SELECT dosya_id, dosya_adi, dosya_klasoragacid FROM dosya';
    const versionSql = 'SELECT version_id, version_dosyaid, version_dosyayolu, version_no, version_olusturmatrh, version_olusturan FROM dosyaversiyonlari';

    con.query(folderSql, (folderErr, folderResults) => {
        if (folderErr) {
            console.error('Klasör veritabanı sorgu hatası:', folderErr);
            return res.status(500).send('Klasör verisi çekme sırasında bir hata oluştu.');
        }

        con.query(fileSql, (fileErr, fileResults) => {
            if (fileErr) {
                console.error('Dosya veritabanı sorgu hatası:', fileErr);
                return res.status(500).send('Dosya verisi çekme sırasında bir hata oluştu.');
            }

            con.query(versionSql, (versionErr, versionResults) => {
                if (versionErr) {
                    console.error('Versiyon veritabanı sorgu hatası:', versionErr);
                    return res.status(500).send('Versiyon verisi çekme sırasında bir hata oluştu.');
                }

                res.json({
                    folders: folderResults,
                    files: fileResults,
                    versions: versionResults
                });
            });
        });
    });
});
app.post('/add-folder', (req, res) => {
    const { parentId, folderName, userName } = req.body;
    let parentFolderId = null;

    // Kullanıcı adı ve klasör adının geçerli olduğunu kontrol 
    if (!userName || !folderName) {
        console.log('Klasör adı veya kullanıcı adı bulunamadı:', { userName, folderName });
        return res.status(400).send('Klasör adı veya kullanıcı adı eksik.');
    }

    if (parentId && parentId.startsWith('folder_')) {
        parentFolderId = parentId.replace('folder_', '');
    }

    // Klasör ekleme işlemi
    const sql = 'INSERT INTO klasoragaci (klasor_rootid, klasor_isim, klasor_olusturmatrh, klasor_olusturan) VALUES (?, ?, NOW(), ?)';
    con.query(sql, [parentFolderId, folderName, userName], (err, result) => {
        if (err) {
            console.error('Klasör eklerken hata:', err);
            return res.status(500).send('Klasör eklenemedi.');
        }

        // İşlem günlüğüne kayıt ekleme
        const folderId = result.insertId;
        const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
        const logDescription = `Klasör eklendi: ${folderName}`;
        const logType = 'Ekleme';
        const logTableName = 'DOSYALAR';

        con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
            if (logErr) {
                console.error('İşlem günlüğü eklerken hata:', logErr);

                return res.status(500).send('Klasör eklenmiş, ancak işlem günlüğü eklenirken hata oluştu.');
            }

            res.json({ klasor_id: folderId });
        });
    });
});

// Klasör silme
app.post('/delete-folder', (req, res) => {
    const { folderId, userName, folderName } = req.body;

    if (!userName || !folderId || !folderName) {
        console.log('Klasör ID, kullanıcı adı veya klasör adı bulunamadı:', { userName, folderId, folderName });
        return res.status(400).send('Klasör ID, kullanıcı adı veya klasör adı eksik.');
    }

    // Klasör silme işlemi
    const sql = 'DELETE FROM klasoragaci WHERE klasor_id = ?';
    con.query(sql, [folderId], (err, result) => {
        if (err) {
            console.error('Klasör silerken hata:', err);
            return res.status(500).json({ error: 'Klasör silinemedi' });
        }

        // İşlem günlüğüne kayıt ekleme
        const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
        const logDescription = `Klasör silindi: ${folderName}`;
        const logType = 'Klasör Silme';  // İşlem tipi
        const logTableName = 'DOSYALAR';  // İşlem yapılan tablo

        con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
            if (logErr) {
                console.error('İşlem günlüğü eklerken hata:', logErr);

                return res.status(500).send('Klasör silinmiş, ancak işlem günlüğü eklenirken hata oluştu.');
            }

            res.json({ success: true });
        });
    });
});

// Klasör yeniden adlandırma
app.post('/rename-folder', (req, res) => {
    const { folderId, newName, userName } = req.body;

    if (!userName || !folderId || !newName) {
        console.error('Gerekli bilgiler eksik:', { userName, folderId, newName });
        return res.status(400).json({ error: 'Gerekli bilgiler eksik' });
    }

    // Eski klasör adını almak için sorgu
    const sqlSelect = 'SELECT klasor_isim FROM klasoragaci WHERE klasor_id = ?';
    con.query(sqlSelect, [folderId], (selectErr, selectResult) => {
        if (selectErr) {
            console.error('Eski klasör adını alırken hata:', selectErr);
            return res.status(500).json({ error: 'Eski klasör adı alınamadı' });
        }

        const oldName = selectResult[0].klasor_isim;

        const sqlUpdate = 'UPDATE klasoragaci SET klasor_isim = ? WHERE klasor_id = ?';
        con.query(sqlUpdate, [newName, folderId], (updateErr, updateResult) => {
            if (updateErr) {
                console.error('Klasör adını değiştirirken hata:', updateErr);
                return res.status(500).json({ error: 'Klasör adı değiştirilemedi' });
            }

            // İşlem günlüğüne ekleme
            const sqlLog = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
            const logDescription = `Klasör adı değiştirildi: ${oldName} -> ${newName}`;
            con.query(sqlLog, [logDescription, 'Klasör adı değiştirme', 'DOSYALAR', userName], (logErr, logResult) => {
                if (logErr) {
                    console.error('İşlem günlüğüne eklerken hata:', logErr);
                    return res.status(500).json({ error: 'İşlem günlüğüne eklenemedi' });
                }

                res.json({ success: true });
            });
        });
    });
});



// Dosya ekleme
app.post('/add-file', (req, res) => {
    const { parentId, fileName, userName } = req.body;

    if (!fileName || !parentId || !userName) {
        return res.status(400).json({ error: 'Eksik veri: Dosya adı, klasör ID veya kullanıcı adı eksik' });
    }

    const sqlInsert = 'INSERT INTO dosya (dosya_adi, dosya_klasoragacid) VALUES (?, ?)';
    con.query(sqlInsert, [fileName, parentId], (err, result) => {
        if (err) {
            console.error('Veritabanına dosya eklerken hata:', err);
            return res.status(500).json({ error: 'Veritabanına dosya eklenirken hata oluştu' });
        }

        // İşlem günlüğüne ekleme
        const sqlLog = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
        const logDescription = `Dosya "${fileName}" eklendi.`;
        con.query(sqlLog, ['Dosya eklendi: ' + fileName, 'Dosya Ekleme', 'DOSYALAR', userName], (logErr, logResult) => {
            if (logErr) {
                console.error('İşlem günlüğüne eklerken hata:', logErr);
                return res.status(500).json({ error: 'İşlem günlüğüne eklenemedi' });
            }

            res.json({
                message: 'Dosya başarıyla eklendi',
                dosya_id: result.insertId,
                dosya_yolu: `/dosyalar/${fileName}` // dosyayolu
            });
        });
    });
});


// Dosya yükleme 
app.post('/upload-file', upload.single('file'), (req, res) => {
    if (req.file) {
        const filePath = req.file.path;

        res.json({
            message: 'Dosya başarıyla yüklendi',
            dosya_yolu: filePath // Yüklenen dosya yolunu döndürme
        });
    } else {
        res.status(400).send('Dosya yüklenirken bir hata oluştu.');
    }
});

// Versiyon ekleme 
app.post('/add-version', (req, res) => {
    const { fileId, versionNo, versionDosyaYolu, versionOlusturmaTarihi, versionOlusturan } = req.body;

    if (!fileId || !versionNo || !versionDosyaYolu || !versionOlusturmaTarihi || !versionOlusturan) {
        return res.status(400).json({ error: 'Geçersiz veri' });
    }

    // Versiyonu ekleme
    const sql = `
        INSERT INTO dosyaversiyonlari 
        (version_dosyaid, version_no, version_dosyayolu, version_olusturmatrh, version_olusturan) 
        VALUES (?, ?, ?, ?, ?)
    `;
    con.query(sql, [fileId, versionNo, versionDosyaYolu, versionOlusturmaTarihi, versionOlusturan], (err, result) => {
        if (err) {
            console.error('Versiyon eklerken hata:', err);
            res.status(500).json({ error: 'Versiyon eklenemedi' });
            return;
        }

        // Dosya adı bilgilerini almak için sorgu
        const fileSql = 'SELECT dosya_adi FROM dosya WHERE dosya_id = ?';
        con.query(fileSql, [fileId], (fileErr, fileResults) => {
            if (fileErr) {
                console.error('Dosya bilgilerini alırken hata:', fileErr);
                res.status(500).json({ error: 'Dosya bilgileri alınırken bir hata oluştu.' });
                return;
            }

            const fileName = fileResults.length > 0 ? fileResults[0].dosya_adi : 'Bilinmiyor';

            // İşlem günlüğüne ekleme
            const insertLogSql = `
                INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren)
                VALUES (?, 'Versiyon Ekleme', 'DOSYALAR', NOW(), ?)
            `;
            const logDescription = `${fileName} adı altına Versiyon eklendi: No: ${versionNo}`;
            con.query(insertLogSql, [logDescription, versionOlusturan], (logErr) => {
                if (logErr) {
                    console.error('İşlem günlüğü eklenirken hata:', logErr);
                    res.status(500).json({ error: 'İşlem günlüğü eklenirken hata oluştu' });
                    return;
                }

                res.json({ version_id: result.insertId });
            });
        });
    });
});


app.get('/download-version/:versionId', (req, res) => {
    const versionId = req.params.versionId;
    const userName = req.query.userName; // URL parametresi olarak kullanıcı adı

    con.query('SELECT version_dosyayolu, version_no, version_dosyaid FROM dosyaversiyonlari WHERE version_id = ?', [versionId], (err, results) => {
        if (err) {
            console.error('Veritabanı sorgusu hatası:', err);
            return res.status(500).send('Dosya bilgileri alınırken bir hata oluştu.');
        }

        if (results.length === 0) {
            return res.status(404).send('Versiyon bulunamadı.');
        }

        const { version_dosyayolu: filePath, version_no: versionNo, version_dosyaid: fileId } = results[0];

        // Dosya yolunu dosyalar tablosundan almak için sorgu
        con.query('SELECT dosya_adi FROM dosya WHERE dosya_id = ?', [fileId], (fileErr, fileResults) => {
            if (fileErr) {
                console.error('Dosya adı sorgusu hatası:', fileErr);
                return res.status(500).send('Dosya adı alınırken bir hata oluştu.');
            }

            const fileName = fileResults.length > 0 ? fileResults[0].dosya_adi : 'Bilinmiyor';

            // Dosyayı sunucudan alıp istemciye gönderir
            res.download(filePath, (err) => {
                if (err) {
                    console.error('Dosya indirilirken hata:', err);
                } else {
                    // İşlem günlüğüne ekleme
                    const logSql = `
                        INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren)
                        VALUES (?, ?, ?, NOW(), ?)
                    `;
                    con.query(logSql, [`Versiyon ${versionNo} (${fileName}) indirildi`, 'Versiyon İndirme', 'DOSYALAR', userName], (logErr) => {
                        if (logErr) {
                            console.error('İşlem günlüğü eklenirken hata:', logErr);
                        }
                    });
                }
            });
        });
    });
});




app.post('/delete-file', (req, res) => {
    const { fileId, userName } = req.body; // Kullanıcı adını alır

    if (!fileId) {
        return res.status(400).json({ error: 'Dosya ID gerekli' });
    }

    // Dosya adını almak için sorgu
    const getFileSql = 'SELECT dosya_adi FROM dosya WHERE dosya_id = ?';
    con.query(getFileSql, [fileId], (getFileErr, getFileResult) => {
        if (getFileErr) {
            console.error('Dosya adını alırken hata:', getFileErr);
            return res.status(500).json({ error: 'Dosya adını alırken bir hata oluştu' });
        }

        if (getFileResult.length === 0) {
            return res.status(404).json({ error: 'Dosya bulunamadı' });
        }

        const fileName = getFileResult[0].dosya_adi;

        // Öncelikli olarak dosya versiyonlarını sil !
        const deleteVersionsSql = 'DELETE FROM dosyaversiyonlari WHERE version_dosyaid = ?';
        con.query(deleteVersionsSql, [fileId], (versionErr, versionResult) => {
            if (versionErr) {
                console.error('Dosya versiyonlarını silerken hata:', versionErr);
                return res.status(500).json({ error: 'Dosya versiyonlarını silerken bir hata oluştu' });
            }

            // Daha sonra dosyayı sil
            const deleteFileSql = 'DELETE FROM dosya WHERE dosya_id = ?';
            con.query(deleteFileSql, [fileId], (fileErr, fileResult) => {
                if (fileErr) {
                    console.error('Dosyayı silerken hata:', fileErr);
                    return res.status(500).json({ error: 'Dosyayı silerken bir hata oluştu' });
                }

                // İşlem günlüğüne dosya silme kaydını ekle
                const insertLogSql = `
                    INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren)
                    VALUES (?, 'Dosya Silme', 'DOSYALAR', NOW(), ?)
                `;
                const logDescription = `Dosya silindi: ${fileName}`;
                con.query(insertLogSql, [logDescription, userName], (logErr, logResult) => {
                    if (logErr) {
                        console.error('İşlem günlüğü eklenirken hata:', logErr);
                        return res.status(500).json({ error: 'İşlem günlüğü eklenirken hata oluştu' });
                    }

                    res.json({ success: true, message: 'Dosya ve ilgili versiyonlar başarıyla silindi' });
                });
            });
        });
    });
});


// Dosya yeniden adlandırma
app.post('/rename-file', (req, res) => {
    const { fileId, newName, userName } = req.body;

    if (!fileId || !newName || !userName) {
        return res.status(400).json({ error: 'Eksik veri: Dosya ID, yeni isim veya kullanıcı adı eksik' });
    }

    // Eski dosya adını al
    const getOldNameSql = 'SELECT dosya_adi FROM dosya WHERE dosya_id = ?';
    con.query(getOldNameSql, [fileId], (err, result) => {
        if (err) {
            console.error('Eski dosya adını alırken hata:', err);
            return res.status(500).json({ error: 'Eski dosya adı alınamadı' });
        }

        const oldName = result[0].dosya_adi;

        // Dosya adını güncelle
        const sql = 'UPDATE dosya SET dosya_adi = ? WHERE dosya_id = ?';
        con.query(sql, [newName, fileId], (err, result) => {
            if (err) {
                console.error('Dosya adını değiştirirken hata:', err);
                return res.status(500).json({ error: 'Dosya adı değiştirilemedi' });
            }

            // İşlem günlüğüne dosya yeniden adlandırma kaydını ekle
            const insertLogSql = `
                INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren)
                VALUES (?, 'Dosya Adı Değiştirme', 'DOSYALAR', NOW(), ?)
            `;
            const logDescription = `Dosya adı değiştirildi."${oldName}" > "${newName}"`;

            con.query(insertLogSql, [logDescription, userName], (logErr, logResult) => {
                if (logErr) {
                    console.error('İşlem günlüğü eklenirken hata:', logErr);
                    return res.status(500).json({ error: 'İşlem günlüğü eklenirken hata oluştu' });
                }

                res.json({ success: true });
            });
        });
    });
});


// delete-version 
app.post('/delete-version', (req, res) => {
    const { versionId, islemDegistiren } = req.body;

    if (!versionId) {
        return res.status(400).json({ error: 'Versiyon ID gerekli' });
    }

    // Versiyon bilgilerini almak için sorgu
    const sqlSelect = 'SELECT * FROM dosyaversiyonlari WHERE version_id = ?';
    con.query(sqlSelect, [versionId], (err, results) => {
        if (err) {
            console.error('Versiyon bilgilerini alırken hata:', err);
            return res.status(500).json({ error: 'Versiyon bilgileri alınırken bir hata oluştu.' });
        }

        const version = results[0];
        if (!version) {
            return res.status(404).json({ error: 'Versiyon bulunamadı' });
        }

        // Dosya bilgilerini almak için sorgu
        const sqlFileSelect = 'SELECT dosya_adi FROM dosya WHERE dosya_id = ?';
        con.query(sqlFileSelect, [version.version_dosyaid], (fileErr, fileResults) => {
            if (fileErr) {
                console.error('Dosya bilgilerini alırken hata:', fileErr);
                return res.status(500).json({ error: 'Dosya bilgileri alınırken bir hata oluştu.' });
            }

            const fileName = fileResults.length > 0 ? fileResults[0].dosya_adi : 'Bilinmiyor';

            // Versiyonu silme
            const sqlDelete = 'DELETE FROM dosyaversiyonlari WHERE version_id = ?';
            con.query(sqlDelete, [versionId], (err) => {
                if (err) {
                    console.error('Versiyon silinirken hata:', err);
                    return res.status(500).json({ error: 'Versiyon silinirken bir hata oluştu.' });
                }

                // İşlem günlüğüne ekleme
                const logSql = `
                    INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren)
                    VALUES (?, ?, ?, NOW(), ?)
                `;
                const logDescription = `${fileName} altındaki Versiyon silindi: No ${version.version_no}`;
                con.query(logSql, [logDescription, 'Versiyon Silme', 'DOSYALAR', islemDegistiren], (logErr) => {
                    if (logErr) {
                        console.error('İşlem günlüğü eklenirken hata:', logErr);
                    }
                });

                res.status(200).json({ message: 'Versiyon başarıyla silindi.' });
            });
        });
    });
});


app.get('/unit-data', (req, res) => {
    // Birimlerin sorgulanması
    const unitsQuery = 'SELECT * FROM birimler';
    con.query(unitsQuery, (err, unitsResults) => {
        if (err) {
            console.error('Birim verilerini çekerken hata:', err);
            res.status(500).send('Birim verilerini çekerken hata oluştu.');
            return;
        }

        // Personel verilerini sorgulama
        const personelQuery = 'SELECT * FROM personeller';
        con.query(personelQuery, (err, personelResults) => {
            if (err) {
                console.error('Personel verilerini çekerken hata:', err);
                res.status(500).send('Personel verilerini çekerken hata oluştu.');
                return;
            }

            // Yanıtı birleştirme
            res.json({
                units: unitsResults,
                personel: personelResults
            });
        });
    });
});


// Yeni birim eklemek için POST endpoint
app.post('/add-unit', (req, res) => {
    const { unitName, parentId, userName } = req.body;

    if (!unitName) {
        return res.status(400).send('Birim adı bulunamadı.');
    }

    // Birim ekleme sorgusu
    const query = 'INSERT INTO birimler (brm_adi, brm_rootid) VALUES (?, ?)';
    con.query(query, [unitName, parentId || null], (err, results) => {
        if (err) {
            console.error('Birim eklerken hata:', err);
            res.status(500).send('Birim eklenirken hata oluştu.');
            return;
        }

        // İşlem günlüğüne kayıt ekleme
        const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
        const logDescription = `Birim eklendi: ${unitName}`;
        const logType = 'Birim Ekleme';
        const logTableName = 'BIRIMLER';

        con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
            if (logErr) {
                console.error('İşlem günlüğü eklerken hata:', logErr);
                return res.status(500).send('Birim eklenmiş, ancak işlem günlüğü eklenirken hata oluştu.');
            }

            // Birim ekleme işlemi başarılı, yanıtı döndür
            res.json({ brm_id: results.insertId, parentId: parentId });
        });
    });
});


app.post('/delete-unit', (req, res) => {
    const { unitId, userName } = req.body;
    const selectUnitQuery = 'SELECT brm_adi FROM birimler WHERE brm_id = ?';
    const deleteUnitQuery = 'DELETE FROM birimler WHERE brm_id = ?';
    const deletePersonelQuery = 'DELETE FROM personeller WHERE personel_birimid = ?';

    let unitName = '';

    con.beginTransaction(err => {
        if (err) {
            console.error('Transaction başlatma hatası:', err);
            return res.status(500).send('Transaction başlatılamadı.');
        }

        // Birim adını almak için sorgu
        con.query(selectUnitQuery, [unitId], (err, results) => {
            if (err) {
                return con.rollback(() => {
                    console.error('Birim adı alınırken hata:', err);
                    res.status(500).send('Birim adı alınırken hata oluştu.');
                });
            }

            if (results.length === 0) {
                return con.rollback(() => {
                    console.error('Birim bulunamadı:', unitId);
                    res.status(404).send('Birim bulunamadı.');
                });
            }

            unitName = results[0].brm_adi;

            con.query(deletePersonelQuery, [unitId], (err) => {
                if (err) {
                    return con.rollback(() => {
                        console.error('Personel silme hatası:', err);
                        // İşlem günlüğüne hatayı kaydet
                        const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                        const logDescription = `Personel silinirken hata oluştu. Birim adı: ${unitName}`;
                        const logType = 'Silme Hatası';
                        const logTableName = 'PERSONELLER';

                        con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                            if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                        });

                        res.status(500).send('Personel silinirken hata oluştu.');
                    });
                }

                con.query(deleteUnitQuery, [unitId], (err) => {
                    if (err) {
                        return con.rollback(() => {
                            console.error('Birim silme hatası:', err);
                            // İşlem günlüğüne hatayı kaydet
                            const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                            const logDescription = `Birim silinirken hata oluştu. Birim adı: ${unitName}`;
                            const logType = 'Silme Hatası';
                            const logTableName = 'BIRIMLER';

                            con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                                if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                            });

                            res.status(500).send('Birim silinirken hata oluştu.');
                        });
                    }

                    con.commit(err => {
                        if (err) {
                            return con.rollback(() => {
                                console.error('Transaction hatası:', err);
                                // İşlem günlüğüne hatayı kaydet
                                const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                                const logDescription = `Transaction hatası oluştu. Birim adı: ${unitName}`;
                                const logType = 'Transaction Hatası';
                                const logTableName = 'BIRIMLER';

                                con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                                    if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                                });

                                res.status(500).send('Transaction hatası oluştu.');
                            });
                        }

                        // İşlem günlüğüne başarılı silme kaydı ekleme
                        const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                        const logDescription = `Birim başarıyla silindi. Birim adı: ${unitName}`;
                        const logType = 'Birim Silme';
                        const logTableName = 'BIRIMLER';

                        con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                            if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                        });

                        res.json({ message: 'Birim başarıyla silindi' });
                    });
                });
            });
        });
    });
});


// Birimi yeniden adlandır
app.post('/rename-unit', (req, res) => {
    const { unitId, newName, userName } = req.body;
    const selectUnitQuery = 'SELECT brm_adi FROM birimler WHERE brm_id = ?';
    const updateUnitQuery = 'UPDATE birimler SET brm_adi = ? WHERE brm_id = ?';

    let oldName = ''; // Eski birim adı burada saklanacak

    con.beginTransaction(err => {
        if (err) {
            console.error('Transaction başlatma hatası:', err);
            return res.status(500).send('Transaction başlatılamadı.');
        }

        // Eski birim adını almak için sorgu
        con.query(selectUnitQuery, [unitId], (err, results) => {
            if (err) {
                return con.rollback(() => {
                    console.error('Birim adı alınırken hata:', err);
                    res.status(500).send('Birim adı alınırken hata oluştu.');
                });
            }

            if (results.length === 0) {
                return con.rollback(() => {
                    console.error('Birim bulunamadı:', unitId);
                    res.status(404).send('Birim bulunamadı.');
                });
            }

            oldName = results[0].brm_adi;

            con.query(updateUnitQuery, [newName, unitId], (err) => {
                if (err) {
                    return con.rollback(() => {
                        console.error('Birim adını güncellerken hata:', err);
                        // İşlem günlüğüne hatayı kaydet
                        const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                        const logDescription = `Birim adı güncellenirken hata oluştu. Eski birim adı: ${oldName}, Yeni birim adı: ${newName}`;
                        const logType = 'Güncelleme Hatası';
                        const logTableName = 'BIRIMLER';

                        con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                            if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                        });

                        res.status(500).send('Birim adı güncellenirken hata oluştu.');
                    });
                }

                con.commit(err => {
                    if (err) {
                        return con.rollback(() => {
                            console.error('Transaction hatası:', err);
                            // İşlem günlüğüne hatayı kaydet
                            const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                            const logDescription = `Transaction hatası oluştu. Eski birim adı: ${oldName}, Yeni birim adı: ${newName}`;
                            const logType = 'Transaction Hatası';
                            const logTableName = 'BIRIMLER';

                            con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                                if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                            });

                            res.status(500).send('Transaction hatası oluştu.');
                        });
                    }

                    // İşlem günlüğüne başarılı güncelleme kaydı ekleme
                    const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                    const logDescription = `Birim başarıyla yeniden adlandırıldı. Eski birim adı: ${oldName}, Yeni birim adı: ${newName}`;
                    const logType = 'Güncelleme';
                    const logTableName = 'BIRIMLER';

                    con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                        if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                    });

                    res.json({ message: 'Birim başarıyla yeniden adlandırıldı' });
                });
            });
        });
    });
});


app.post('/add-personel', (req, res) => {
    const { name, sicil, unitId, userName } = req.body;

    const insertPersonelQuery = 'INSERT INTO personeller (personel_adi, personel_sicil, personel_birimid) VALUES (?, ?, ?)';
    con.query(insertPersonelQuery, [name, sicil, unitId], (err, results) => {
        if (err) {
            console.error('Personel eklerken hata:', err);

            // İşlem günlüğüne hatayı kaydet
            const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
            const logDescription = `Personel eklenirken hata oluştu. Personel adı: ${name}, Sicil: ${sicil}, Birim ID: ${unitId}`;
            const logType = 'Ekleme Hatası';
            const logTableName = 'PERSONELLER';

            con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
            });

            res.status(500).send('Personel eklenirken hata oluştu.');
            return;
        }

        const newPersonelId = results.insertId;

        // İşlem günlüğüne başarılı kayıt ekleme
        const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
        const logDescription = `Personel başarıyla eklendi. Personel adı: ${name}, Sicil: ${sicil}`;
        const logType = 'Personel Ekleme';
        const logTableName = 'PERSONELLER';

        con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
            if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
        });

        res.json({ personel_id: newPersonelId, name, sicil, unitId });
    });
});


// Personeli sil
app.post('/delete-personel', (req, res) => {
    const { personelId, userName } = req.body;

    // Personel bilgilerini almak için sorgu
    const selectPersonelQuery = 'SELECT personel_adi, personel_sicil FROM personeller WHERE personel_id = ?';
    const deletePersonelQuery = 'DELETE FROM personeller WHERE personel_id = ?';

    con.beginTransaction(err => {
        if (err) {
            console.error('Transaction başlatma hatası:', err);
            return res.status(500).send('Transaction başlatılamadı.');
        }

        con.query(selectPersonelQuery, [personelId], (err, results) => {
            if (err) {
                return con.rollback(() => {
                    console.error('Personel bilgileri alınırken hata:', err);
                    res.status(500).send('Personel bilgileri alınırken hata oluştu.');
                });
            }

            if (results.length === 0) {
                return con.rollback(() => {
                    console.error('Personel bulunamadı:', personelId);
                    res.status(404).send('Personel bulunamadı.');
                });
            }

            const personel = results[0];

            con.query(deletePersonelQuery, [personelId], (err) => {
                if (err) {
                    return con.rollback(() => {
                        console.error('Personel silme hatası:', err);
                        // İşlem günlüğüne hatayı kaydet
                        const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                        const logDescription = `Personel silinirken hata oluştu. Personel adı: ${personel.personel_adi}, Sicil: ${personel.personel_sicil}, Personel ID: ${personelId}`;
                        const logType = 'Silme Hatası';
                        const logTableName = 'PERSONELLER';

                        con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                            if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                        });

                        res.status(500).send('Personel silinirken hata oluştu.');
                    });
                }

                con.commit(err => {
                    if (err) {
                        return con.rollback(() => {
                            console.error('Transaction hatası:', err);
                            // İşlem günlüğüne hatayı kaydet
                            const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                            const logDescription = `Transaction hatası oluştu. Personel adı: ${personel.personel_adi}, Sicil: ${personel.personel_sicil}, Personel ID: ${personelId}`;
                            const logType = 'Transaction Hatası';
                            const logTableName = 'PERSONELLER';

                            con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                                if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                            });

                            res.status(500).send('Transaction hatası oluştu.');
                        });
                    }

                    // İşlem günlüğüne başarılı silme kaydı ekleme
                    const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                    const logDescription = `Personel başarıyla silindi. Personel adı: ${personel.personel_adi}, Sicil: ${personel.personel_sicil}`;
                    const logType = 'Personel Silme';
                    const logTableName = 'PERSONELLER';

                    con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                        if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                    });

                    res.json({ message: 'Personel başarıyla silindi' });
                });
            });
        });
    });
});

// Personelin adını değiştir
app.post('/rename-personel', (req, res) => {
    const { personelId, newName, newSicil, userName } = req.body;

    // Eski personel bilgilerini almak için sorgu
    const selectPersonelQuery = 'SELECT personel_adi, personel_sicil FROM personeller WHERE personel_id = ?';
    const updatePersonelQuery = 'UPDATE personeller SET personel_adi = ?, personel_sicil = ? WHERE personel_id = ?';

    con.beginTransaction(err => {
        if (err) {
            console.error('Transaction başlatma hatası:', err);
            return res.status(500).send('Transaction başlatılamadı.');
        }

        con.query(selectPersonelQuery, [personelId], (err, results) => {
            if (err) {
                return con.rollback(() => {
                    console.error('Personel bilgileri alınırken hata:', err);
                    res.status(500).send('Personel bilgileri alınırken hata oluştu.');
                });
            }

            if (results.length === 0) {
                return con.rollback(() => {
                    console.error('Personel bulunamadı:', personelId);
                    res.status(404).send('Personel bulunamadı.');
                });
            }

            const oldPersonel = results[0];

            con.query(updatePersonelQuery, [newName, newSicil, personelId], (err) => {
                if (err) {
                    return con.rollback(() => {
                        console.error('Personel bilgilerini güncellerken hata:', err);
                        // İşlem günlüğüne hatayı kaydet
                        const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                        const logDescription = `Personel adı ve sicil numarası değiştirilirken hata oluştu. Eski Personel adı: ${oldPersonel.personel_adi}, Eski Sicil: ${oldPersonel.personel_sicil}, Yeni Personel adı: ${newName}, Yeni Sicil: ${newSicil}, Personel ID: ${personelId}`;
                        const logType = 'Güncelleme Hatası';
                        const logTableName = 'PERSONELLER';

                        con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                            if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                        });

                        res.status(500).send('Personel bilgileri güncellenirken hata oluştu.');
                    });
                }

                con.commit(err => {
                    if (err) {
                        return con.rollback(() => {
                            console.error('Transaction hatası:', err);
                            // İşlem günlüğüne hatayı kaydet
                            const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                            const logDescription = `Transaction hatası oluştu. Eski Personel adı: ${oldPersonel.personel_adi}, Eski Sicil: ${oldPersonel.personel_sicil}, Yeni Personel adı: ${newName}, Yeni Sicil: ${newSicil}, Personel ID: ${personelId}`;
                            const logType = 'Transaction Hatası';
                            const logTableName = 'PERSONELLER';

                            con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                                if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                            });

                            res.status(500).send('Transaction hatası oluştu.');
                        });
                    }

                    // İşlem günlüğüne başarılı güncelleme kaydı ekleme
                    const logSql = 'INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren) VALUES (?, ?, ?, NOW(), ?)';
                    const logDescription = `Personel adı ve sicil numarası başarıyla değiştirildi. Eski Personel adı: ${oldPersonel.personel_adi}, Eski Sicil: ${oldPersonel.personel_sicil}, Yeni Personel adı: ${newName}, Yeni Sicil: ${newSicil}`;
                    const logType = 'Güncelleme';
                    const logTableName = 'PERSONELLER';

                    con.query(logSql, [logDescription, logType, logTableName, userName], (logErr) => {
                        if (logErr) console.error('İşlem günlüğü eklerken hata:', logErr);
                    });

                    res.json({ message: 'Personel adı ve sicil numarası başarıyla değiştirildi' });
                });
            });
        });
    });
});


app.get('/uygulamalar', (req, res) => {
    const query = 'SELECT * FROM uygulamalar';
    con.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.post('/uygulama-ekle', (req, res) => {
    const { uyg_adi, uyg_erisimnoktasi, uyg_aciklama, userName } = req.body;

    // Uygulama ekleme sorgusu
    const query = 'INSERT INTO uygulamalar (uyg_adi, uyg_erisimnoktasi, uyg_aciklama) VALUES (?, ?, ?)';
    con.query(query, [uyg_adi, uyg_erisimnoktasi, uyg_aciklama], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // İşlem günlüğüne kayıt ekleme
        const insertLogSql = `
            INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren)
            VALUES (?, 'Uygulama Ekleme', 'Uygulamalar', NOW(), ?)
        `;
        con.query(insertLogSql, [`Uygulama eklendi: ${uyg_adi}`, userName], (logErr) => {
            if (logErr) {
                console.error('İşlem günlüğü eklenirken hata:', logErr);
                return res.status(500).json({ error: 'İşlem günlüğü eklenirken hata oluştu' });
            }

            res.json({ message: 'Uygulama başarıyla eklendi', insertId: results.insertId });
        });
    });
});


app.delete('/uygulama-sil/:id', (req, res) => {
    const uygulamaId = req.params.id;
    const { userName } = req.body;

    if (!userName) {
        return res.status(400).json({ error: 'Kullanıcı adı gerekli' });
    }

    // Önce uygulama adını almak için sorgu yap
    const getUygulamaQuery = 'SELECT uyg_adi FROM uygulamalar WHERE uyg_id = ?';
    con.query(getUygulamaQuery, [uygulamaId], (err, results) => {
        if (err) {
            console.error('Uygulama adı alınırken hata:', err);
            return res.status(500).send('Uygulama adı alınırken hata oluştu.');
        }

        if (results.length === 0) {
            return res.status(404).send('Uygulama bulunamadı.');
        }

        const uygulamaAdi = results[0].uyg_adi;

        // Uygulama tablosundan sil
        const deleteQuery = 'DELETE FROM uygulamalar WHERE uyg_id = ?';
        con.query(deleteQuery, [uygulamaId], (deleteErr) => {
            if (deleteErr) {
                console.error('Uygulama silinirken hata:', deleteErr);
                return res.status(500).send('Uygulama silinirken hata oluştu.');
            }

            // İşlem günlüğüne uygulama silme kaydını ekle
            const logQuery = `
                INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren)
                VALUES (?, 'Uygulama Silme', 'Uygulamalar', NOW(), ?)
            `;
            con.query(logQuery, [`Uygulama silindi: ${uygulamaAdi}`, userName], (logErr) => {
                if (logErr) {
                    console.error('İşlem günlüğü eklenirken hata:', logErr);
                    return res.status(500).json({ error: 'İşlem günlüğü eklenirken hata oluştu' });
                }

                res.send('Uygulama başarıyla silindi.');
            });
        });
    });
});


app.get('/personel-uygulama-erisimleri', (req, res) => {
    const query = `
        SELECT 
            p.personel_sicil, 
            p.personel_adi, 
            b.brm_adi AS birim_adi, 
            u.uyg_adi, 
            pe.pue_erisimdurumu AS erisim_durumu,
            p.personel_id,
            u.uyg_id
        FROM personeluygulamaerisimleri pe
        JOIN personeller p ON pe.pue_personelid = p.personel_id
        JOIN birimler b ON p.personel_birimid = b.brm_id
        JOIN uygulamalar u ON pe.pue_uygulamaid = u.uyg_id
    `;
    con.query(query, (err, results) => {
        if (err) {
            console.error('Veriler getirilirken hata:', err);
            res.status(500).send('Veriler getirilirken hata oluştu.');
            return;
        }
        res.json(results);
    });
});

// Erişim durumu güncelleme endpoint'i
app.put('/erisim-durumu', (req, res) => {
    const { personel_id, uygulama_id, erisim_durumu, userName } = req.body;

    if (!userName) {
        return res.status(400).json({ error: 'Kullanıcı adı gerekli' });
    }

    // Önce personel ve uygulama bilgilerini al
    const getPersonelQuery = 'SELECT personel_sicil FROM personeller WHERE personel_id = ?';
    const getUygulamaQuery = 'SELECT uyg_adi FROM uygulamalar WHERE uyg_id = ?';

    con.query(getPersonelQuery, [personel_id], (personelErr, personelResults) => {
        if (personelErr) {
            console.error('Personel bilgileri alınırken hata:', personelErr);
            return res.status(500).send('Personel bilgileri alınırken hata oluştu.');
        }

        if (personelResults.length === 0) {
            return res.status(404).send('Personel bulunamadı.');
        }

        const personelSicil = personelResults[0].personel_sicil;


        con.query(getUygulamaQuery, [uygulama_id], (uygulamaErr, uygulamaResults) => {
            if (uygulamaErr) {
                console.error('Uygulama bilgileri alınırken hata:', uygulamaErr);
                return res.status(500).send('Uygulama bilgileri alınırken hata oluştu.');
            }

            if (uygulamaResults.length === 0) {
                return res.status(404).send('Uygulama bulunamadı.');
            }

            const uygulamaAdi = uygulamaResults[0].uyg_adi;

            // Erişim durumunu güncelle
            const updateQuery = `
                UPDATE personeluygulamaerisimleri
                SET pue_erisimdurumu = ?
                WHERE pue_personelid = ? AND pue_uygulamaid = ?
            `;
            con.query(updateQuery, [erisim_durumu, personel_id, uygulama_id], (updateErr) => {
                if (updateErr) {
                    console.error('Erişim durumu güncellenirken hata:', updateErr);
                    return res.status(500).send('Erişim durumu güncellenirken hata oluştu.');
                }

                // İşlem günlüğüne erişim durumu güncelleme kaydını ekle
                const logQuery = `
                    INSERT INTO islem_gunlugu (islem_aciklama, islem_tipi, islem_tabloadi, islem_zamani, islem_degistiren)
                    VALUES (?, 'Erişim Durumu Güncelleme', 'Erişim Durumu', NOW(), ?)
                `;
                con.query(logQuery, [`Sicil no ${personelSicil} olan personelin ${uygulamaAdi} erişimi ${erisim_durumu ? 'açıldı' : 'kapatıldı'}`, userName], (logErr) => {
                    if (logErr) {
                        console.error('İşlem günlüğü eklenirken hata:', logErr);
                        return res.status(500).json({ error: 'İşlem günlüğü eklenirken hata oluştu' });
                    }

                    res.json({ message: 'Erişim durumu başarıyla güncellendi.' });
                });
            });
        });
    });
});


app.get('/get-recent-logs', (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const searchTerm = req.query.searchTerm ? `%${req.query.searchTerm}%` : '%';

    // Toplam kayıt sayısını almak için
    const countQuery = `
        SELECT COUNT(*) AS total
        FROM islem_gunlugu
        WHERE islem_aciklama LIKE ? 
           OR islem_tipi LIKE ? 
           OR islem_tabloadi LIKE ? 
           OR islem_degistiren LIKE ?
    `;
    con.query(countQuery, [searchTerm, searchTerm, searchTerm, searchTerm], (countErr, countResults) => {
        if (countErr) {
            console.error('Toplam kayıt sayısı alınırken hata:', countErr);
            return res.status(500).send('Toplam kayıt sayısı alınırken hata oluştu.');
        }

        const totalRecords = countResults[0].total;
        const totalPages = Math.ceil(totalRecords / limit);

        // Filtrelenmiş kayıtları almak için
        const query = `
            SELECT * FROM islem_gunlugu
            WHERE islem_aciklama LIKE ? 
               OR islem_tipi LIKE ? 
               OR islem_tabloadi LIKE ? 
               OR islem_degistiren LIKE ?
            ORDER BY islem_zamani DESC
            LIMIT ? OFFSET ?
        `;
        con.query(query, [searchTerm, searchTerm, searchTerm, searchTerm, limit, offset], (err, results) => {
            if (err) {
                console.error('Son işlemler alınırken hata:', err);
                return res.status(500).send('Son işlemler alınırken hata oluştu.');
            }
            res.json({
                logs: results,
                totalPages: Math.min(totalPages, 10), // Toplam sayfa sayısını 10 ile sınırla
            });
        });
    });
});


app.listen(5000, () => {
    console.log('Server listening on port 5000');
});
