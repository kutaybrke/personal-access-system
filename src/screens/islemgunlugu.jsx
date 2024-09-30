import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import '../css/islemgunlugu.css';

const IslemGunlugu = () => {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const limit = 10;

    const fetchLogs = useCallback(async (page, searchQuery) => {
        setLoading(true);
        try {
            const response = await axios.get('http://localhost:5000/get-recent-logs', {
                params: { page, limit, searchTerm: searchQuery }
            });
            setLogs(response.data.logs);
            setTotalPages(response.data.totalPages);
        } catch (error) {
            console.error('Son işlemler alınırken hata:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs(page, searchTerm);
    }, [page, searchTerm, fetchLogs]);

    useEffect(() => {
        if (searchTerm) {
            const filtered = logs.filter(log =>
                log.islem_aciklama.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.islem_tipi.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.islem_tabloadi.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.islem_degistiren.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredLogs(filtered);
        } else {
            setFilteredLogs(logs);
        }
    }, [searchTerm, logs]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
        setPage(1); // Arama yapıldığında sayfayı 1'e sıfırla
    };

    if (loading) {
        return <div>Yükleniyor...</div>;
    }

    const renderPagination = () => {
        const pages = [];

        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            pages.push(
                <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={i === page ? 'active' : ''}
                >
                    {i}
                </button>
            );
        }

        return (
            <div className="pagination">
                <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}>«</button>
                {pages}
                <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}>»</button>
            </div>
        );
    };

    return (
        <div>
            <h2>LOG TABLOSU</h2>
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Arama..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    autoFocus
                />
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Açıklama</th>
                        <th>Tür</th>
                        <th>Konum</th>
                        <th>Zaman</th>
                        <th>Değiştiren</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map(log => (
                        <tr key={log.islem_id}>
                            <td>{log.islem_aciklama}</td>
                            <td>{log.islem_tipi}</td>
                            <td>{log.islem_tabloadi}</td>
                            <td>{new Date(log.islem_zamani).toLocaleString()}</td>
                            <td>{log.islem_degistiren}</td>
                        </tr>
                    ))}
                </tbody>

            </table>
            <div>
                <span>{((page - 1) * limit) + 1} ile {Math.min(page * limit, filteredLogs.length + ((page - 1) * limit))} arası toplam {totalPages * limit} kayıt gösteriliyor</span>
                {renderPagination()}
            </div>
        </div>
    );
};

export default IslemGunlugu;
