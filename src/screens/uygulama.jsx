import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../css/uygulama.css';

const Uygulama = () => {
    const [uygulamalar, setUygulamalar] = useState([]);
    const [uygAdi, setUygAdi] = useState('');
    const [uygErisimNoktasi, setUygErisimNoktasi] = useState('');
    const [uygAciklama, setUygAciklama] = useState('');

    useEffect(() => {
        fetchUygulamalar();
    }, []);

    const fetchUygulamalar = async () => {
        try {
            const response = await axios.get('http://localhost:5000/uygulamalar');
            setUygulamalar(response.data);
        } catch (error) {
            console.error('Veritabanından uygulamalar getirilirken hata:', error);
        }
    };

    const handleAddUygulama = async () => {
        // Girişlerin boş olup olmadığını kontrol eden fonksiyon
        if (!uygAdi || !uygErisimNoktasi || !uygAciklama) {
            alert('Lütfen tüm alanları doldurun.');
            return;
        }

        try {
            const userName = localStorage.getItem('userName');

            if (!userName) {
                alert('Kullanıcı adı bulunamadı.');
                return;
            }

            await axios.post('http://localhost:5000/uygulama-ekle', {
                uyg_adi: uygAdi,
                uyg_erisimnoktasi: uygErisimNoktasi,
                uyg_aciklama: uygAciklama,
                userName: userName // Kullanıcı adını backend'e gönderiyoruz
            });

            fetchUygulamalar(); 
            setUygAdi('');
            setUygErisimNoktasi('');
            setUygAciklama('');
        } catch (error) {
            console.error('Uygulama eklenirken hata:', error);
        }
    };

    const handleDeleteUygulama = async (uyg_id, uygulamaAdi) => {
        const isConfirmed = window.confirm(`Uygulamayı silmek istediğinizden emin misiniz?`);
        if (!isConfirmed) return;

        try {
            const userName = localStorage.getItem('userName'); 

            if (!userName) {
                alert('Kullanıcı adı bulunamadı.');
                return;
            }

            await axios.delete(`http://localhost:5000/uygulama-sil/${uyg_id}`, {
                headers: {
                    'Content-Type': 'application/json',
                },
                data: {
                    userName: userName,
                    uygulamaAdi: uygulamaAdi 
                }
            });

            fetchUygulamalar(); // Güncellenmiş listeyi çek
        } catch (error) {
            console.error('Uygulama silinirken hata:', error);
        }
    };



    return (
        <div className="uygulama-container">
            <div className="form-container">
                <h3>Uygulama Ekle</h3>
                <div className="form-row">
                    <label>Uygulama Adı:</label>
                    <input
                        type="text"
                        value={uygAdi}
                        onChange={(e) => setUygAdi(e.target.value)}
                    />
                </div>
                <div className="form-row">
                    <label>Erişim Noktası:</label>
                    <input
                        type="text"
                        value={uygErisimNoktasi}
                        onChange={(e) => setUygErisimNoktasi(e.target.value)}
                    />
                </div>
                <div className="form-row">
                    <label>Açıklama:</label>
                    <input
                        type="text"
                        value={uygAciklama}
                        onChange={(e) => setUygAciklama(e.target.value)}
                    />
                </div>
                <button className='uygulama-add-button' onClick={handleAddUygulama}>Uygulama Ekle</button>
            </div>

            <div className="table-container">
                <h3>Uygulama Listesi</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Adı</th>
                            <th>Erişim Noktası</th>
                            <th>Açıklama</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {uygulamalar.map((uygulama) => (
                            <tr key={uygulama.uyg_id}>
                                <td>{uygulama.uyg_adi}</td>
                                <td>{uygulama.uyg_erisimnoktasi}</td>
                                <td>{uygulama.uyg_aciklama}</td>
                                <td>
                                    <button onClick={() => handleDeleteUygulama(uygulama.uyg_id)}>Uygulamayı Sil</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Uygulama;
