import React from 'react';
import '../css/tanitimvideo.css';
import videoFile from '../videos/tanitim.mp4';

const TanitimVideosu = ({ show, onClose }) => {
    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>X</button>
                <div className="video-container">
                    <video width="100%" height="315" controls>
                        <source src={videoFile} type="video/mp4" />
                        Tarayıcınız bu videoyu oynatmayı desteklemiyor.
                    </video>
                </div>
            </div>
        </div>
    );
};

export default TanitimVideosu;
