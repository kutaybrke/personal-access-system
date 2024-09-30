import React, { useState } from 'react';
import '../css/changepassword.css';

const ChangePassword = () => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const email = localStorage.getItem('userEmail');

        if (!email) {
            alert('E-posta adresi bulunamadı.');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    oldPassword,
                    newPassword,
                    email,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                setError(errorData.message || 'Bir hata oluştu.');
                setSuccess(null); // Başarı mesajını temizle
            } else {
                const data = await response.json();
                setSuccess(data.message || 'Şifre başarılı bir şekilde değiştirildi.');
                setOldPassword('');
                setNewPassword('');
                setError(null); // Hata mesajını temizle

                // 2 saniye sonra sayfayı yenile
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            console.error('Error:', error);
            setError('Bir hata oluştu.');
            setSuccess(null); // Başarı mesajını temizle
        }
    };

    return (
        <div className="change-password-container">
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Eski Şifre:</label>
                    <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Yeni Şifre:</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Şifreyi Değiştir</button>
                {error && <p className="error">{error}</p>}
                {success && <p className="success">{success}</p>}
            </form>
        </div>
    );
};

export default ChangePassword;
