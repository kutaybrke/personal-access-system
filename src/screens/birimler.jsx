import React, { useEffect, useRef, useState } from 'react';
import $ from 'jquery';
import 'jstree';
import axios from 'axios';
import '../css/birimler.css'

const TreeComponent = () => {
    const treeRef = useRef(null);
    const [treeData, setTreeData] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('http://localhost:5000/unit-data');
                console.log('Backend Yanıtı:', response.data);
                const formattedData = formatTreeData(response.data);
                setTreeData(formattedData);
            } catch (error) {
                console.error('Veri çekerken hata:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (treeData.length > 0) {
            const $tree = $(treeRef.current).jstree({
                'core': {
                    'data': treeData,
                    'check_callback': true
                },
                'plugins': []
            });

            $tree.on('changed.jstree', (e, data) => {
                setSelectedNode(data.selected[0]);
            });

            return () => {
                $tree.jstree('destroy').empty();
            };
        }
    }, [treeData]);

    const formatTreeData = (unitsData) => {
        const units = unitsData.units || [];
        const personel = unitsData.personel || [];

        return [
            ...units.map(unit => ({
                id: `unit_${unit.brm_id}`,
                parent: unit.brm_rootid ? `unit_${unit.brm_rootid}` : '#',
                text: unit.brm_adi,
                icon: "fa fa-building ",

                state: { opened: true }
            })),
            ...personel.map(p => ({
                id: `personel_${p.personel_id}`,
                parent: `unit_${p.personel_birimid}`,
                text: `${p.personel_adi} (${p.personel_sicil})`,
                icon: 'fa fa-user',
                state: { opened: true }
            }))
        ];
    };

    const handleAddUnit = async () => {
        const unitName = prompt("Yeni birim adı girin:");
        const userName = localStorage.getItem('userName'); // Kullanıcı adını localStorage'dan alan kod

        if (!unitName) {
            alert('Birim adı girilmedi.');
            return;
        }

        if (!userName) {
            alert('Kullanıcı adı bulunamadı.');
            return;
        }

        try {
            setLoading(true);

            const response = await axios.post('http://localhost:5000/add-unit', {
                unitName: unitName,
                parentId: selectedNode && selectedNode.startsWith('unit_') ? selectedNode.replace('unit_', '') : null,
                userName: userName
            });

            const newUnitNode = {
                id: `unit_${response.data.brm_id}`,
                parent: response.data.parentId ? `unit_${response.data.parentId}` : '#',
                text: unitName,
                icon: "fa fa-building",
                state: { opened: true }
            };

            setTreeData(prevTreeData => [...prevTreeData, newUnitNode]);

            alert("Birim başarıyla eklendi!");
        } catch (error) {
            console.error("Birim eklerken hata:", error);
        } finally {
            setLoading(false);
        }
    };



    const handleAddPersonel = async () => {
        const name = prompt("Personel adı girin:");
        const sicil = prompt("Personel sicil numarası girin:");
        const userName = localStorage.getItem('userName');

        if (!userName) {
            alert('Kullanıcı adı bulunamadı.');
            return;
        }

        if (name && sicil) {
            if (selectedNode && selectedNode.startsWith('unit_')) {
                try {
                    setLoading(true);

                    const response = await axios.post('http://localhost:5000/add-personel', {
                        name: name,
                        sicil: sicil,
                        unitId: selectedNode ? selectedNode.replace('unit_', '') : null,
                        userName: userName
                    });

                    const newPersonelNode = {
                        id: `personel_${response.data.personel_id}`,
                        parent: `unit_${response.data.unitId}`,
                        text: `${name} (${sicil})`,
                        icon: "fa fa-user",
                        state: { opened: true }
                    };

                    setTreeData(prevTreeData => [...prevTreeData, newPersonelNode]);

                    const $tree = $(treeRef.current).jstree(true);
                    $tree.settings.core.data = formatTreeData({
                        units: treeData.filter(node => node.id.startsWith('unit_')),
                        personel: [
                            ...treeData.filter(node => node.id.startsWith('personel_')),
                            newPersonelNode
                        ]
                    });
                    $tree.refresh();

                    alert("Personel başarıyla eklendi!");
                } catch (error) {
                    console.error("Personel eklerken hata:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                alert("Lütfen bir birim seçin.");
            }
        } else {
            alert("Personel adı ve sicil numarası girilmelidir.");
        }
    };

    const handleDeleteUnit = async () => {
        if (selectedNode && selectedNode.startsWith('unit_')) {
            const unitId = selectedNode.replace('unit_', '');
            const userName = localStorage.getItem('userName');

            if (!userName) {
                alert('Kullanıcı adı bulunamadı.');
                return;
            }

            if (window.confirm("Bu birimi ve altındaki personelleri silmek istediğinizden emin misiniz?")) {
                try {
                    setLoading(true);
                    await axios.post('http://localhost:5000/delete-unit', { unitId, userName });
                    setTreeData(prevTreeData => prevTreeData.filter(node => node.id !== selectedNode));
                    alert("Birim başarıyla silindi!");
                } catch (error) {
                    console.error("Birim silme hatası:", error);
                } finally {
                    setLoading(false);
                }
            }
        } else {
            alert("Lütfen bir birim seçin.");
        }
    };

    const handleRenameUnit = async () => {
        if (selectedNode && selectedNode.startsWith('unit_')) {
            const unitId = selectedNode.replace('unit_', '');
            const newName = prompt("Yeni birim adı girin:");
            const userName = localStorage.getItem('userName');

            if (!userName) {
                alert('Kullanıcı adı bulunamadı.');
                return;
            }

            if (newName) {
                try {
                    setLoading(true);
                    await axios.post('http://localhost:5000/rename-unit', { unitId, newName, userName });
                    setTreeData(prevTreeData => prevTreeData.map(node =>
                        node.id === selectedNode
                            ? { ...node, text: newName }
                            : node
                    ));
                    alert("Birim başarıyla yeniden adlandırıldı!");
                } catch (error) {
                    console.error("Birim adını değiştirirken hata:", error);
                } finally {
                    setLoading(false);
                }
            }
        } else {
            alert("Lütfen bir birim seçin.");
        }
    };


    const handleDeletePersonel = async () => {
        if (selectedNode && selectedNode.startsWith('personel_')) {
            const personelId = selectedNode.replace('personel_', '');
            const userName = localStorage.getItem('userName');

            if (!userName) {
                alert('Kullanıcı adı bulunamadı.');
                return;
            }

            if (window.confirm("Bu personeli silmek istediğinizden emin misiniz?")) {
                try {
                    setLoading(true);
                    await axios.post('http://localhost:5000/delete-personel', { personelId, userName });
                    setTreeData(prevTreeData => prevTreeData.filter(node => node.id !== selectedNode));
                    alert("Personel başarıyla silindi!");
                } catch (error) {
                    console.error("Personel silme hatası:", error);
                } finally {
                    setLoading(false);
                }
            }
        } else {
            alert("Lütfen bir personel seçin.");
        }
    };


    const handleRenamePersonel = async () => {
        if (selectedNode && selectedNode.startsWith('personel_')) {
            const personelId = selectedNode.replace('personel_', '');
            const newName = prompt("Yeni personel adı girin:");
            const newSicil = prompt("Yeni personel sicil numarası girin:");
            const userName = localStorage.getItem('userName');

            if (!userName) {
                alert('Kullanıcı adı bulunamadı.');
                return;
            }

            if (newName && newSicil) {
                try {
                    setLoading(true);
                    await axios.post('http://localhost:5000/rename-personel', { personelId, newName, newSicil, userName });

                    setTreeData(prevTreeData => prevTreeData.map(node =>
                        node.id === selectedNode
                            ? { ...node, text: `${newName} (${newSicil})` }
                            : node
                    ));

                    alert("Personel adı ve sicil numarası başarıyla değiştirildi!");
                } catch (error) {
                    console.error("Personel adı ve sicil numarasını değiştirirken hata:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                alert("Personel adı ve sicil numarası girilmelidir.");
            }
        } else {
            alert("Lütfen bir personel seçin.");
        }
    };


    return (
        <div>
            {loading ? (
                <p>Yükleniyor...</p>
            ) : (
                <div>
                    <div ref={treeRef} />
                    <button className="tree-component-button" onClick={handleAddUnit}>Yeni Birim Ekle</button>
                    <button className="tree-component-button" onClick={handleDeleteUnit}>Birim Sil</button>
                    <button className="tree-component-button" onClick={handleRenameUnit}>Birim Adını Değiştir</button>
                    <button className="tree-component-button" onClick={handleAddPersonel}>Yeni Personel Ekle</button>
                    <button
                        className="tree-component-button"
                        onClick={handleDeletePersonel}
                        style={{ display: selectedNode && selectedNode.startsWith('personel_') ? 'inline-block' : 'none' }}
                    >
                        Personel Sil
                    </button>
                    <button
                        className="tree-component-button"
                        onClick={handleRenamePersonel}
                        style={{ display: selectedNode && selectedNode.startsWith('personel_') ? 'inline-block' : 'none' }}
                    >
                        Personel Adını ve Sicil No Değiştir
                    </button>
                </div>
            )}
        </div>
    );
};

export default TreeComponent;
