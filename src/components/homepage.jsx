import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserInfo from '../screens/UserInfo';
import ChangePassword from '../screens/ChangePassword';
import JsTree from '../screens/jstree';
import Units from '../screens/birimler';
import Uygulama from '../screens/uygulama';
import AccessStatus from '../screens/erisimdurumu';
import SonIslemler from '../screens/islemgunlugu';
import TanitimVideosu from '../screens/tanitimvideosu';
import '../css/homepage.css';
import logo from '../image/logokcetas2.png';

const Homepage = () => {
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [showUserInfo, setShowUserInfo] = useState(false);
    const [showJsTree, setShowJsTree] = useState(false);
    const [showUnits, setShowUnits] = useState(false);
    const [showUygulama, setShowUygulama] = useState(false);
    const [showAccessStatus, setShowAccessStatus] = useState(false);
    const [showIslemGunlugu, setShowIslemGunlugu] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showTanitimVideosu, setShowTanitimVideosu] = useState(false); 
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuOpen && !event.target.closest('.side-menu') && !event.target.closest('.hamburger-menu')) {
                setMenuOpen(false);
            }
            if (userMenuOpen && !event.target.closest('.user-menu')) {
                setUserMenuOpen(false);
            }
        };

        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [menuOpen, userMenuOpen]);

    useEffect(() => {
        const header = document.querySelector('.header');
        if (header) {
            if (menuOpen) {
                header.classList.add('blur');
            } else {
                header.classList.remove('blur');
            }
        }
    }, [menuOpen]);

    const handleChangePassword = () => {
        setShowPasswordForm(true);
        setShowUserInfo(false);
        setShowJsTree(false);
        setShowUnits(false);
        setShowUygulama(false);
        setShowAccessStatus(false);
        setShowIslemGunlugu(false);
        setMenuOpen(false);
    };

    const handleShowUserInfo = () => {
        setShowUserInfo(true);
        setShowPasswordForm(false);
        setShowJsTree(false);
        setShowUnits(false);
        setShowUygulama(false);
        setShowAccessStatus(false);
        setShowIslemGunlugu(false);
        setMenuOpen(false);
    };

    const handleShowJsTree = () => {
        setShowJsTree(true);
        setShowUserInfo(false);
        setShowPasswordForm(false);
        setShowUnits(false);
        setShowUygulama(false);
        setShowAccessStatus(false);
        setShowIslemGunlugu(false);
        setMenuOpen(false);
    };

    const handleShowUnits = () => {
        setShowUnits(true);
        setShowUserInfo(false);
        setShowPasswordForm(false);
        setShowJsTree(false);
        setShowUygulama(false);
        setShowAccessStatus(false);
        setShowIslemGunlugu(false);
        setMenuOpen(false);
    };

    const handleShowUygulama = () => {
        setShowUygulama(true);
        setShowUserInfo(false);
        setShowPasswordForm(false);
        setShowJsTree(false);
        setShowUnits(false);
        setShowAccessStatus(false);
        setShowIslemGunlugu(false);
        setMenuOpen(false);
    };

    const handleShowAccessStatus = () => {
        setShowAccessStatus(true);
        setShowUserInfo(false);
        setShowPasswordForm(false);
        setShowJsTree(false);
        setShowUnits(false);
        setShowUygulama(false);
        setShowIslemGunlugu(false);
        setMenuOpen(false);
    };

    const handleShowIslemGunlugu = () => {
        setShowIslemGunlugu(true);
        setShowUserInfo(false);
        setShowPasswordForm(false);
        setShowJsTree(false);
        setShowUnits(false);
        setShowUygulama(false);
        setShowAccessStatus(false);
        setMenuOpen(false);
    };

    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    const toggleUserMenu = () => {
        setUserMenuOpen(!userMenuOpen);
    };

    const handleMouseEnterUserMenu = () => {
        setUserMenuOpen(true);
    };

    const handleMouseLeaveUserMenu = () => {
        setUserMenuOpen(false);
    };

    return (
        <div>
            <header className={`header ${menuOpen ? 'blur' : ''}`}>
                <div className="logo-container">
                    <img src={logo} alt="Logo" className="logo" />
                </div>
                <div className="hamburger-menu" onClick={toggleMenu}>
                    &#9776;
                </div>
                <div className="header-buttons">
                    <a href="#" onClick={handleShowIslemGunlugu}><i className="fas fa-home"></i> ANASAYFA</a>

                    <a href="#" onClick={handleShowJsTree}><i className="fas fa-folder"></i> DOSYALAR</a>
                    <a href="#" onClick={handleShowUnits}><i className="fas fa-building"></i> BİRİMLER ve PERSONELLER</a>
                    <a href="#" onClick={handleShowUygulama}><i className="fas fa-cogs"></i> UYGULAMALAR</a>
                    <a href="#" onClick={handleShowAccessStatus} className="show-access-status-button"><i className="fas fa-lock"></i> ERİŞİM DURUMU</a>

                    <div
                        className="user-menu"
                        onMouseEnter={handleMouseEnterUserMenu}
                        onMouseLeave={handleMouseLeaveUserMenu}
                    >
                        <a href="#"><i className='fa fa-user'></i> KULLANICI İŞLEMLERİ</a>
                        {userMenuOpen && (
                            <div className="sub-menu">
                                <a href="#" onClick={handleShowUserInfo}>Kullanıcı Bilgileri</a>
                                <a href="#" onClick={handleChangePassword}>Şifre Değiştir</a>
                            </div>
                        )}
                    </div>
                    <a href="#" onClick={() => setShowTanitimVideosu(true)}><i className="fas fa-video"></i> TANITIM VİDEOSU</a> 
                    <a href="#" onClick={() => navigate('/login')}><i className="fas fa-sign-out-alt"></i> ÇIKIŞ YAP</a>
                </div>
            </header>
            <div className={`overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}></div>
            <div className={`side-menu ${menuOpen ? 'open' : ''}`}>
                <a href="#" onClick={handleShowIslemGunlugu}><i className="fas fa-home"></i> ANASAYFA</a>
                <a href="#" onClick={handleShowJsTree}><i className="fas fa-folder"></i> DOSYALAR</a>
                <a href="#" onClick={handleShowUnits}><i className="fas fa-building"></i> BİRİMLER ve PERSONELLER</a>
                <a href="#" onClick={handleShowUygulama}><i className="fas fa-cogs"></i> UYGULAMALAR</a>
                <a href="#" onClick={handleShowAccessStatus}><i className="fas fa-lock"></i> ERİŞİM DURUMU</a>
                <a href="#" onClick={handleShowUserInfo}><i className="fas fa-user"></i> KULLANICI BİLGİLERİ</a>
                <a href="#" onClick={handleChangePassword}><i className="fas fa-key"></i> ŞİFRE DEĞİŞTİR</a>
                <a href="#" onClick={() => setShowTanitimVideosu(true)}><i className="fas fa-video"></i> TANITIM VİDEOSU</a>
                <a href="#" onClick={() => navigate('/login')}><i className="fas fa-sign-out-alt"></i> ÇIKIŞ YAP</a>
            </div>
            <main>
                {showUserInfo && <UserInfo />}
                {showPasswordForm && <ChangePassword />}
                {showJsTree && <JsTree />}
                {showUnits && <Units />}
                {showUygulama && <Uygulama />}
                {showAccessStatus && <AccessStatus />}
                {showIslemGunlugu && <SonIslemler />}
            </main>
            <TanitimVideosu show={showTanitimVideosu} onClose={() => setShowTanitimVideosu(false)} /> 
        </div>
    );
};

export default Homepage;
