import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../css/resetpassword.css';

const ResetPassword = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isTokenValid, setIsTokenValid] = useState(true);
    const navigate = useNavigate();
    const { token } = useParams();

    useEffect(() => {
        const verifyToken = async () => {
            try {
                const response = await fetch(`http://localhost:5000/verify-token/${token}`);
                if (response.ok) {
                    setIsTokenValid(true);
                } else {
                    setIsTokenValid(false);
                    setMessage('Geçersiz veya süresi dolmuş token.');
                }
            } catch (error) {
                console.error('Token doğrulama hatası:', error);
                setIsTokenValid(false);
                setMessage('Token doğrulama sırasında bir hata oluştu.');
            }
        };

        verifyToken();
    }, [token]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!newPassword || !confirmPassword) {
            setMessage('Lütfen tüm alanları doldurunuz.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage('Yeni şifreler uyuşmuyor.');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, newPassword }),
            });

            if (response.ok) {
                setMessage('Şifre başarıyla değiştirildi.');
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            } else {
                const errorMessage = await response.text();
                setMessage(errorMessage || 'Şifre değiştirirken bir hata oluştu.');
            }
        } catch (error) {
            console.error('Bir hata oluştu:', error);
            setMessage('Şifre değiştirirken bir hata oluştu.');
        }
    };

    if (!isTokenValid) {
        return <div className="reset-password"><p>{message}</p></div>;
    }

    return (
        <div className="reset-password">
            <form onSubmit={handleSubmit}>
                <h2>Yeni Şifrenizi Belirleyin</h2>
                <div>
                    <label>Yeni Şifre:</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Yeni şifrenizi girin"
                        required
                    />
                </div>
                <div>
                    <label>Yeni Şifreyi Onayla:</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Yeni şifrenizi onaylayın"
                        required
                    />
                </div>
                <button type="submit">Şifreyi Değiştir</button>
                {message && <p className="message">{message}</p>}
            </form>

        </div>
    );
};

export default ResetPassword;
