import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/login.css';
import logo from '../image/logokcetas2.png';
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [isRegistering, setIsRegistering] = useState(false);
    const [tcNumber, setTcNumber] = useState('');
    const [isimSoyisim, setIsimSoyisim] = useState('');
    const [dogumTarihi, setDogumTarihi] = useState('');
    const [loginError, setLoginError] = useState(null);
    const [lockoutError, setLockoutError] = useState(null);
    const [remainingTime, setRemainingTime] = useState(null);
    const navigate = useNavigate();

    const tcNumberPattern = /^[0-9]{11}$/;
    const isimSoyisimPattern = /^[a-zA-ZşŞıİçÇöÖüÜğĞ\s]+$/;

    useEffect(() => {
        if (remainingTime !== null && remainingTime > 0) {
            const timer = setInterval(() => {
                setRemainingTime((prevTime) => {
                    if (prevTime <= 1000) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prevTime - 1000;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [remainingTime]);

    const formatTime = (milliseconds) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes} dakika ${seconds} saniye`;
    };

    const handleLoginSubmit = async (event) => {
        event.preventDefault();

        try {
            const response = await fetch('http://localhost:5000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (response.ok) {
                const result = await response.json();
                localStorage.setItem('userEmail', email);
                localStorage.setItem('userName', result.userName);
                navigate('/homepage');
                alert("Giriş İşleminiz Başarılı. Hoşgeldiniz! Anasayfa Ekranına Yönlendiriliyorsunuz...");
            } else if (response.status === 403) {
                const { message, remainingTime } = await response.json();
                setError(message);
                setRemainingTime(remainingTime || 0); // Kalan süreyi al ve state'e ata
                setLockoutError("Çok fazla giriş denemesi. Lütfen tekrar deneyin.");
            } else {
                const errorMessage = await response.text();
                setError(errorMessage || 'Giriş başarısız.');
            }
        } catch (error) {
            console.error('Bir hata oluştu:', error);
            setError('Giriş sırasında bir hata oluştu.');
        }
    };
    const handleRegisterSubmit = async (event) => {
        event.preventDefault();

        // Form doğrulamaları
        if (!email || !password || !tcNumber || !isimSoyisim || !dogumTarihi) {
            setError('Lütfen tüm alanları doldurunuz.');
            return;
        }
        if (!tcNumberPattern.test(tcNumber)) {
            setError('TC Kimlik No 11 haneli rakamlardan oluşmalıdır.');
            return;
        }
        if (!isimSoyisimPattern.test(isimSoyisim)) {
            setError('İsim ve soyisim sadece harflerden oluşmalı ve rakam içermemelidir.');
            return;
        }

        // Tarih doğrulama
        const today = new Date();
        const birthDate = new Date(dogumTarihi);
        if (birthDate > today) {
            setError('Doğum tarihi gelecekteki bir tarih olamaz.');
            return;
        }

        // Kullanıcının 18 yaşında olup olmadığını kontrol etme
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        if (age < 18) {
            setError('Kayıt olmak için en az 18 yaşında olmanız gerekmektedir.');
            return;
        }

        setError('');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('TC Kimlik No:', tcNumber);
        console.log('İsim Soyisim:', isimSoyisim);
        console.log('Doğum Tarihi:', dogumTarihi);

        try {
            const response = await fetch('http://localhost:5000/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    tcNumber,
                    isimSoyisim,
                    dogumTarihi,
                }),
            });

            if (response.ok) {
                alert("Kayıt Başarılı! Login Ekranına Yönlendiriliyor!!");
                setIsRegistering(false);

                // Alanları temizleme
                setEmail('');
                setPassword('');
                setTcNumber('');
                setIsimSoyisim('');
                setDogumTarihi('');
            } else {
                const errorText = await response.text();
                setError(`Kayıt sırasında bir hata oluştu: ${errorText}`);
            }
        } catch (err) {
            console.error('Error:', err);
            setError('Kayıt sırasında bir hata oluştu.');
        }
    };


    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const switchToRegister = () => {
        setIsRegistering(true);
        document.getElementById('btn').classList.add('move-right');
        document.getElementById('btn').classList.remove('move-left');
    };

    const switchToLogin = () => {
        setIsRegistering(false);
        document.getElementById('btn').classList.add('move-left');
        document.getElementById('btn').classList.remove('move-right');
    };

    useEffect(() => {
        const btn = document.getElementById('btn');
        if (btn) {
            btn.style.transform = isRegistering ? 'translateX(110px)' : 'translateX(0px)';
        }
    }, [isRegistering]);


    return (
        <div className="main">
            <div className="form-box">
                <img src={logo} alt="Logo" className="logo" />
                <h2>{isRegistering ? '' : ''}</h2>
                <div className="button-group">
                    <div id='btn' className={isRegistering ? 'move-right' : 'move-left'}></div>
                    <button
                        className={`toggle-btn ${!isRegistering ? 'active' : ''}`}
                        onClick={switchToLogin}
                    >
                        Giriş Yap
                    </button>
                    <button
                        className={`toggle-btn ${isRegistering ? 'active' : ''}`}
                        onClick={switchToRegister}
                    >
                        Kayıt Ol
                    </button>
                </div>
                {isRegistering ? (
                    <form className="input-group" onSubmit={handleRegisterSubmit}>
                        <div className="input-container">
                            <i className="fa fa-envelope icon"></i>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="Lütfen email adresinizi giriniz"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-container">
                            <i className="fa fa-lock icon"></i>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input-field"
                                placeholder="Lütfen parolanızı giriniz"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <i
                                className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}
                                onClick={togglePasswordVisibility}
                            ></i>
                        </div>
                        <div className="input-container">
                            <i className="fa fa-id-card icon"></i>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Lütfen TC kimlik numaranızı giriniz"
                                value={tcNumber}
                                onChange={(e) => setTcNumber(e.target.value)}
                                maxLength="11"
                                required
                            />
                        </div>
                        <div className="input-container">
                            <i className="fa fa-user icon"></i>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Lütfen İsim ve Soyisiminizi giriniz"
                                value={isimSoyisim}
                                onChange={(e) => setIsimSoyisim(e.target.value)}
                                maxLength="50"
                                required
                            />
                        </div>
                        <div className="input-container">
                            <i className="fa fa-calendar icon"></i>
                            <input
                                type="date"
                                className="input-field"
                                value={dogumTarihi}
                                onChange={(e) => setDogumTarihi(e.target.value)}
                                required
                            />
                        </div>
                        {error && <p className="error">{error}</p>}
                        <button type="submit" className="submit-btn">Kayıt Ol</button>
                    </form>
                ) : (
                    <form className="input-group" onSubmit={handleLoginSubmit}>
                        <div className="input-container">

                            <i className="fa fa-envelope icon"></i>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="Lütfen email adresinizi giriniz"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-container">
                            <i className="fa fa-lock icon"></i>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input-field"
                                placeholder="Lütfen parolanızı giriniz"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <i
                                className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}
                                onClick={togglePasswordVisibility}
                            ></i>
                        </div>
                        {/* Genel hata mesajı */}
                        {error && <p className="error">{error}</p>}

                        {/* Giriş hatası mesajı */}
                        {loginError && !lockoutError && <p className="error">{loginError}</p>}

                        {/* Kilitlenme hatası ve kalan süre mesajı */}
                        {lockoutError && (
                            <div className="error">

                                {remainingTime !== null && remainingTime > 0 && (
                                    <div>
                                        Kalan süre: {formatTime(remainingTime)}
                                    </div>
                                )}
                            </div>
                        )}

                        <button type="submit" className="submit-btn">Giriş Yap</button>


                    </form>
                )}
                {!isRegistering && (
                    <a href="#" className="forgot-passwordd" onClick={() => navigate('/forgot-password')}>
                        Şifremi Unuttum?
                    </a>
                )}
                {loginError && <p className="error">{loginError}</p>}
            </div>
        </div>
    );
};

export default Login;
