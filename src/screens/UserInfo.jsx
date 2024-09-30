import React, { useState, useEffect } from 'react';
import '../css/userinfo.css';

const UserInfo = () => {
    const [userInfo, setUserInfo] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUserInfo = async () => {
            const email = localStorage.getItem('userEmail');
            if (!email) {
                alert('E-posta adresi bulunamadı.');
                return;
            }

            try {
                const response = await fetch(`http://localhost:5000/user-info/${email}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    setError(errorData.message || 'Kullanıcı bilgileri alınamadı.');
                    return;
                }

                const data = await response.json();
                setUserInfo(data);
            } catch (error) {
                console.error('Error:', error);
                setError('Bir hata oluştu.');
            }
        };

        fetchUserInfo();
    }, []);

    return (
        <div className="user-info-container">
            <div className="user-info">
                {userInfo ? (
                    <table>
                        <tbody>
                            <tr>
                                <td><strong>E-posta:</strong></td>
                                <td>{userInfo.kullanici_mail}</td>
                            </tr>
                            <tr>
                                <td><strong>Kullanıcı Adı:</strong></td>
                                <td>{userInfo.kullanici_adi}</td>
                            </tr>
                            <tr>
                                <td><strong>Doğum Tarihi:</strong></td>
                                <td>{userInfo.kullanici_datetime}</td>
                            </tr>
                            <tr>
                                <td><strong>T.C. No:</strong></td>
                                <td>{userInfo.kullanici_tcno}</td>
                            </tr>
                        </tbody>
                    </table>
                ) : (
                    <p>{error || 'Yükleniyor...'}</p>
                )}
            </div>
        </div>
    );
};

export default UserInfo;
