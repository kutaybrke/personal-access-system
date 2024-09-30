import '../css/forgotpassword.css';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false); // Butonun devre dışı olup olmadığını takip eder
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!email) {
            setMessage('Lütfen email adresinizi giriniz.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Şifre sıfırlama isteği göndermek için 
            const response = await fetch('http://localhost:5000/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            if (response.ok) {
                setMessage('Şifre sıfırlama bağlantısı e-posta adresinize gönderilmiştir.');

                // Kullanıcıyı reset-password sayfasına yönlendirme
                setTimeout(() => {
                    navigate('/reset-password');
                }, 5000); // 5 saniye

                setEmail('');
            } else {
                const errorMessage = await response.text();
                setMessage(errorMessage || 'Şifre sıfırlama isteği sırasında bir hata oluştu.');
                setIsSubmitting(false); // Hata oluşursa butonu tekrar etkinleştir
            }
        } catch (error) {
            console.error('Bir hata oluştu:', error);
            setMessage('Şifre sıfırlama isteği sırasında bir hata oluştu.');
            setIsSubmitting(false); 
        }
    };

    return (
        <div className="forgot-password">
            <form onSubmit={handleSubmit}>
                <h2>Şifremi Unuttum</h2>
                <div>
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="E-posta adresinizi girin"
                        required
                    />
                </div>
                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Lütfen Bekleyin...' : 'Şifre Sıfırlama Bağlantısı Oluştur'}
                </button>
                {message && <p className="message">{message}</p>}
            </form>

        </div>
    );
};

export default ForgotPassword;
