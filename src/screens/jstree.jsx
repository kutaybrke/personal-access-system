import React, { useEffect, useRef, useState } from 'react';
import $ from 'jquery';
import 'jstree';
import axios from 'axios';

const TreeComponent = () => {
    const treeRef = useRef(null);
    const [treeData, setTreeData] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloadVersionId, setDownloadVersionId] = useState(null);

    useEffect(() => {
        axios.get('http://localhost:5000/folder-file-data')
            .then(response => {
                const formattedData = formatTreeData(response.data);
                setTreeData(formattedData);
                setLoading(false);
            })
            .catch(error => {
                console.error('Veri çekerken hata:', error);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (treeData.length > 0) {
            $(treeRef.current).jstree({
                'core': {
                    'data': treeData,
                    'check_callback': true

                },
                'plugins': []
            }).on('changed.jstree', (e, data) => {
                setSelectedNode(data.selected[0]);
            });
        }

        return () => {
            $(treeRef.current).jstree('destroy').empty();
        };
    }, [treeData]);

    const formatTreeData = (foldersData) => {
        const { folders, files, versions } = foldersData;

        const folderData = folders.map(folder => ({
            id: `folder_${folder.klasor_id}`,
            parent: folder.klasor_rootid === "" || folder.klasor_rootid === null || folder.klasor_rootid === 0 ? '#' : `folder_${folder.klasor_rootid}`,
            text: `${folder.klasor_isim} (Oluşturan: ${folder.klasor_olusturan}, Tarih: ${folder.klasor_olusturmatrh})`,
            icon: 'fas fa-folder',
            state: {
                opened: true
            }
        }));

        const fileData = files.map(file => ({
            id: `file_${file.dosya_id}`,
            parent: `folder_${file.dosya_klasoragacid}`,
            text: `Dosya: ${file.dosya_adi}`,
            icon: 'fas fa-file',
            state: {
                opened: true
            }
        }));

        const versionData = versions.map(version => ({
            id: `version_${version.version_id}`,
            parent: `file_${version.version_dosyaid}`,
            text: `Versiyon ${version.version_no}: ${version.version_dosyayolu} (Oluşturan: ${version.version_olusturan}, Tarih: ${version.version_olusturmatrh})`,
            icon: 'fas fa-code-branch',
            state: {
                opened: true
            },
            a_attr: {
                'data-version-id': version.version_id
            }
        }));

        return [...folderData, ...fileData, ...versionData];
    };

    const handleAddFolder = async () => {
        const folderName = prompt("Yeni klasör adı:");
        const userName = localStorage.getItem('userName');

        if (!folderName) {
            alert('Klasör adı girilmedi.');
            return;
        }

        if (!userName) {
            alert('Kullanıcı adı bulunamadı.');
            return;
        }

        try {
            const response = await axios.post('http://localhost:5000/add-folder', {
                parentId: selectedNode,
                folderName: folderName,
                userName: userName
            });

            const newFolderNode = {
                id: `folder_${response.data.klasor_id}`,
                parent: selectedNode || '#',
                text: folderName,
                icon: "fa fa-folder",
                state: { opened: true }
            };

            // Klasörleri güncelle
            setTreeData(prevTreeData => [
                ...prevTreeData,
                newFolderNode
            ]);

            // `jstree`'yi güncelle
            $(treeRef.current).jstree(true).settings.core.data = [...treeData, newFolderNode];
            $(treeRef.current).jstree(true).refresh();
        } catch (error) {
            console.error("Klasör eklerken hata:", error);
        }
    };


    const handleDeleteFolder = async () => {
        if (selectedNode && selectedNode.startsWith('folder_')) {
            const userName = localStorage.getItem('userName');

            if (!userName) {
                alert('Kullanıcı adı bulunamadı.');
                return;
            }

            // folderName'i treeData'dan al
            const folderNode = treeData.find(node => node.id === selectedNode);
            const folderName = folderNode ? folderNode.text : '';

            if (!folderName) {
                alert('Klasör adı bulunamadı.');
                return;
            }

            // Onay mesajı
            const confirmed = window.confirm(`Bu klasörü silmek istediğinizden emin misiniz?`);

            if (!confirmed) {
                return; // Eğer kullanıcı iptal ederse işlem sonlandırılır
            }

            try {
                await axios.post('http://localhost:5000/delete-folder', {
                    folderId: selectedNode.replace('folder_', ''),
                    userName: userName,
                    folderName: folderName
                });

                setTreeData(treeData.filter(node => node.id !== selectedNode));
                setSelectedNode(null);
                alert(`Klasör başarıyla silindi!`);
            } catch (error) {
                console.error("Klasör silerken hata:", error);
            }
        } else {
            alert("Lütfen silmek istediğiniz klasörü seçin.");
        }
    };

    const handleRenameFolder = async () => {
        if (selectedNode && selectedNode.startsWith('folder_')) {
            const newName = prompt("Yeni klasör adı:");
            const userName = localStorage.getItem('userName');

            if (!userName) {
                alert('Kullanıcı adı bulunamadı.');
                return;
            }

            if (newName) {
                try {
                    await axios.post('http://localhost:5000/rename-folder', {
                        folderId: selectedNode.replace('folder_', ''),
                        newName: newName,
                        userName: userName
                    });

                    setTreeData(treeData.map(node => {
                        if (node.id === selectedNode) {
                            node.text = newName;
                        }
                        return node;
                    }));
                } catch (error) {
                    console.error("Klasör adını değiştirirken hata:", error);
                }
            }
        } else {
            alert("Lütfen yeniden adlandırmak istediğiniz klasörü seçin.");
        }
    };

    const handleAddFile = async () => {
        const fileName = prompt("Yeni dosya adı girin:");
        const userName = localStorage.getItem('userName');

        if (!fileName) {
            alert("Dosya adı girilmedi.");
            return;
        }

        if (!userName) {
            alert("Kullanıcı adı bulunamadı.");
            return;
        }

        const parentId = selectedNode && selectedNode.startsWith('folder_') ? selectedNode.replace('folder_', '') : null;

        try {
            const response = await axios.post('http://localhost:5000/add-file', {
                parentId: parentId,
                fileName: fileName,
                userName: userName
            });

            const newFileNode = {
                id: `file_${response.data.dosya_id}`,
                parent: `folder_${parentId}`,
                text: `Dosya: ${fileName}`,
                icon: "fa fa-file",
                state: { opened: true }
            };

            setTreeData(prevTreeData => [
                ...prevTreeData,
                newFileNode
            ]);
        } catch (error) {
            console.error('Dosya eklenirken hata:', error);
        }
    };


    const handleDeleteFile = async () => {
        if (selectedNode && selectedNode.startsWith('file_')) {
            const userName = localStorage.getItem('userName');

            if (!userName) {
                alert('Kullanıcı adı bulunamadı.');
                return;
            }

            // Silme onayı al
            const confirmed = confirm("Bu dosyayı silmek istediğinize emin misiniz?");
            if (!confirmed) {
                return; // Kullanıcı onaylamadıysa işlem iptal edilir
            }

            try {
                await axios.post('http://localhost:5000/delete-file', {
                    fileId: selectedNode.replace('file_', ''),
                    userName: userName
                });

                alert('Dosya başarıyla silindi.');

                setTreeData(treeData.filter(node => !node.id.startsWith('version_') && node.id !== selectedNode));
                setSelectedNode(null);
            } catch (error) {
                console.error("Dosya silerken hata:", error);
                alert('Dosya silinirken bir hata oluştu.');
            }
        } else {
            alert("Lütfen silmek istediğiniz dosyayı seçin.");
        }
    };




    const handleRenameFile = async () => {
        if (selectedNode && selectedNode.startsWith('file_')) {
            const newName = prompt("Yeni dosya adı:");
            const userName = localStorage.getItem('userName');

            if (newName) {
                if (!userName) {
                    alert("Kullanıcı adı bulunamadı.");
                    return;
                }

                try {
                    await axios.post('http://localhost:5000/rename-file', {
                        fileId: selectedNode.replace('file_', ''),
                        newName: newName,
                        userName: userName
                    });

                    // Dosya adını frontend'de güncelle
                    setTreeData(treeData.map(node => {
                        if (node.id === selectedNode) {
                            node.text = `Dosya: ${newName}`;
                        }
                        return node;
                    }));
                } catch (error) {
                    console.error("Dosya adını değiştirirken hata:", error);
                    alert("Dosya adını değiştirirken bir hata oluştu. Lütfen tekrar deneyin.");
                }
            }
        } else {
            alert("Lütfen yeniden adlandırmak istediğiniz dosyayı seçin.");
        }
    };


    const handleAddVersion = () => {
        if (!selectedNode || !selectedNode.startsWith('file_')) {
            alert("Lütfen bir dosya seçin.");
            return;
        }

        const versionNo = prompt("Yeni versiyon numarası girin:");
        if (!versionNo) {
            alert("Versiyon numarası girilmedi.");
            return;
        }

        const fileId = selectedNode.replace('file_', '');
        const versionOlusturmaTarihi = new Date().toISOString(); 

        const userName = localStorage.getItem('userName');
        if (!userName) {
            alert("Kullanıcı adı bulunamadı.");
            return;
        }

        const handleFileUpload = (file) => {
            const formData = new FormData();
            formData.append('file', file);

            axios.post('http://localhost:5000/upload-file', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })
                .then(response => {
                    const filePath = response.data.dosya_yolu;

                    // Versiyon ekleme
                    axios.post('http://localhost:5000/add-version', {
                        fileId,
                        versionNo,
                        versionDosyaYolu: filePath,
                        versionOlusturmaTarihi,
                        versionOlusturan: userName // Kullanıcı adını ekle
                    })
                        .then(response => {
                            setTreeData(prevTreeData => [
                                ...prevTreeData,
                                {
                                    id: `version_${response.data.version_id}`,
                                    parent: selectedNode,
                                    text: `Versiyon ${versionNo}: ${filePath} (Oluşturan: ${userName}, Tarih: ${versionOlusturmaTarihi})`,
                                    icon: "fa fa-code-branch",
                                    state: { opened: true }
                                }
                            ]);
                        })
                        .catch(error => {
                            console.error("Versiyon eklerken hata:", error);
                        });
                })
                .catch(error => {
                    console.error('Dosya yüklenirken hata:', error);
                });
        };

        const fileInput = document.createElement('input');
        fileInput.type = 'file';

        fileInput.onchange = () => {
            const file = fileInput.files[0];
            if (file) {
                handleFileUpload(file);
            } else {
                alert("Dosya seçilmedi.");
            }
        };

        fileInput.click();
    };

    const handleDeleteVersion = () => {
        if (selectedNode && selectedNode.startsWith('version_')) {
            const versionId = selectedNode.replace('version_', '');

            const userName = localStorage.getItem('userName');
            if (!userName) {
                alert("Kullanıcı adı bulunamadı.");
                return;
            }

            const confirmed = confirm("Bu versiyonu silmek istediğinize emin misiniz?");
            if (!confirmed) {
                return; // Kullanıcı onaylamazsa işlem iptal edilir
            }

            // Versiyonu sil
            axios.post('http://localhost:5000/delete-version', { versionId, islemDegistiren: userName })
                .then(() => {
                    alert("Versiyon başarıyla silindi.");

                    setTreeData(treeData.filter(node => node.id !== selectedNode));
                    setSelectedNode(null);
                    setDownloadVersionId(null);
                })
                .catch(error => {
                    console.error("Versiyon silerken hata:", error);
                    alert('Versiyon silinirken bir hata oluştu.');
                });
        } else {
            alert("Lütfen silmek istediğiniz versiyonu seçin.");
        }
    };


    const handleDownloadVersion = () => {
        if (downloadVersionId) {
            // Kullanıcı adını localStorage'den alan kod
            const userName = localStorage.getItem('userName');
            if (!userName) {
                alert("Kullanıcı adı bulunamadı.");
                return;
            }

            // İndirme işlemini başlatan kod
            const downloadUrl = `http://localhost:5000/download-version/${downloadVersionId}?userName=${encodeURIComponent(userName)}`;
            window.open(downloadUrl, '_blank');
        } else {
            alert("Lütfen indirmek istediğiniz versiyonu seçin.");
        }
    };


    const handleNodeClick = (event, data) => {
        const nodeId = data.node.id;
        if (nodeId.startsWith('version_')) {
            setDownloadVersionId(nodeId.replace('version_', '')); // Seçilen versiyon ID'sini state'e set et
        }
    };

    useEffect(() => {
        if (treeData.length > 0) {
            $(treeRef.current).on('select_node.jstree', handleNodeClick);
        }

        return () => {
            $(treeRef.current).off('select_node.jstree');
        };
    }, [treeData]);

    if (loading) {
        return <div>Loading...</div>;
    }

    // Butonların görünürlüğünü belirleyen değişkenler
    const isFileSelected = selectedNode && selectedNode.startsWith('file_');
    const isVersionSelected = selectedNode && selectedNode.startsWith('version_');

    return (
        <div>

            <div ref={treeRef}></div>
            <button className='tree-component-button' onClick={handleAddFolder}>Klasör Ekle</button>
            <button className='tree-component-button' onClick={handleDeleteFolder}>Klasör Sil</button>
            <button className='tree-component-button' onClick={handleRenameFolder}>Klasör Yeniden Adlandır</button>
            <button className='tree-component-button' onClick={handleAddFile}>Dosya Ekle</button>
            {isFileSelected && (
                <>
                    <button className='tree-component-button' onClick={handleDeleteFile}>Dosya Sil</button>
                    <button className='tree-component-button' onClick={handleRenameFile}>Dosya Yeniden Adlandır</button>
                    <button className='tree-component-button' onClick={handleAddVersion}>Versiyon Ekle</button>
                </>
            )}
            {isVersionSelected && (
                <>
                    <button className='tree-component-button' onClick={handleDeleteVersion}>Versiyon Sil</button>
                    <button className='tree-component-button' onClick={handleDownloadVersion}>Versiyonu İndir</button>
                </>
            )}
        </div>
    );
};

export default TreeComponent;
