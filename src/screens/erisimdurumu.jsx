import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../css/erisimdurumu.css';

const ErişimDurumu = () => {
    const [veriler, setVeriler] = useState([]);
    const [değişiklikler, setDeğişiklikler] = useState({});

    useEffect(() => {
        fetchVeriler();
    }, []);

    const fetchVeriler = async () => {
        try {
            const response = await axios.get('http://localhost:5000/personel-uygulama-erisimleri');
            setVeriler(response.data);
        } catch (error) {
            console.error('Veriler getirilirken hata:', error);
        }
    };

    const handleCheckboxChange = (personelId, uygulamaId, isChecked) => {
        setDeğişiklikler((prevDeğişiklikler) => ({
            ...prevDeğişiklikler,
            [`${personelId}-${uygulamaId}`]: isChecked,
        }));
    };

    const handleSaveChanges = async () => {
        const isConfirmed = window.confirm('Değişiklikleri kaydetmek istiyor musunuz?');

        if (!isConfirmed) return;

        const userName = localStorage.getItem('userName');

        if (!userName) {
            alert('Kullanıcı adı bulunamadı.');
            return;
        }

        try {
            const updatePromises = Object.keys(değişiklikler).map(async (key) => {
                const [personelId, uygulamaId] = key.split('-');
                const isChecked = değişiklikler[key];
                await axios.put('http://localhost:5000/erisim-durumu', {
                    personel_id: personelId,
                    uygulama_id: uygulamaId,
                    erisim_durumu: isChecked,
                    userName: userName
                });
            });

            await Promise.all(updatePromises);
            fetchVeriler();
            setDeğişiklikler({});
        } catch (error) {
            console.error('Erişim durumu güncellenirken hata:', error);
        }
    };


    return (
        <div className="erisim-durumu-container">
            <h3>Personel ve Uygulama Erişim Durumu</h3>
            <table>
                <thead>
                    <tr>
                        <th>Sicil</th>
                        <th>Personel Adı</th>
                        <th>Birim Adı</th>
                        <th>Uygulama Adı</th>
                        <th>Erişim Durumu</th>
                    </tr>
                </thead>
                <tbody>
                    {veriler.map((veri) => (
                        <tr key={`${veri.personel_id}-${veri.uyg_id}`}>
                            <td>{veri.personel_sicil}</td>
                            <td>{veri.personel_adi}</td>
                            <td>{veri.birim_adi}</td>
                            <td>{veri.uyg_adi}</td>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={değişiklikler[`${veri.personel_id}-${veri.uyg_id}`] ?? veri.erisim_durumu}
                                    onChange={(e) =>
                                        handleCheckboxChange(
                                            veri.personel_id,
                                            veri.uyg_id,
                                            e.target.checked
                                        )
                                    }
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="button-container">
                <button className="kaydetbutton" onClick={handleSaveChanges}>Değişiklikleri Kaydet</button>
            </div>
        </div>
    );
};

export default ErişimDurumu;
