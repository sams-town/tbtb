import fileService from "../services/FileService.js";

class FileController {
    /**
     * GET /api/documents
     */
    async index(req, res) {
        try {
            const result = await fileService.getAll(req.query);
            return res.status(200).json({
                success: true,
                message: "Data dokumen berhasil diambil",
                ...result,
            });
        } catch (error) {
            console.error("FileController.index error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal mengambil data dokumen",
                error: error.message,
            });
        }
    }

    /**
     * POST /api/documents
     */
    async store(req, res) {
        try {
            if (!req.body.user_id || !req.body.nama_dokumen) {
                return res.status(400).json({
                    success: false,
                    message: "User ID dan Nama Dokumen wajib diisi",
                });
            }

            const data = await fileService.create(req.body, req.file);
            return res.status(201).json({
                success: true,
                message: "Dokumen berhasil diunggah",
                data,
            });
        } catch (error) {
            console.error("FileController.store error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal mengunggah dokumen",
                error: error.message,
            });
        }
    }

    /**
     * PUT /api/documents/:id
     */
    async update(req, res) {
        try {
            const data = await fileService.update(req.params.id, req.body, req.file);
            return res.status(200).json({
                success: true,
                message: "Dokumen berhasil diperbarui",
                data,
            });
        } catch (error) {
            console.error("FileController.update error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal memperbarui dokumen",
                error: error.message,
            });
        }
    }

    /**
     * DELETE /api/documents/:id
     */
    async destroy(req, res) {
        try {
            const ok = await fileService.delete(req.params.id);
            if (!ok) {
                return res.status(404).json({
                    success: false,
                    message: "Dokumen tidak ditemukan",
                });
            }
            return res.status(200).json({
                success: true,
                message: "Dokumen berhasil dihapus",
            });
        } catch (error) {
            console.error("FileController.destroy error:", error);
            return res.status(500).json({
                success: false,
                message: "Gagal menghapus dokumen",
                error: error.message,
            });
        }
    }
    /**
     * GET /api/documents/bulk-info
     * Ambil list URL dokumen untuk bulk download
     * Query: jenis_file, user_ids[], jabatan_id
     */
    async bulkInfo(req, res) {
        try {
            const data = await fileService.getBulkFiles(req.query);
            return res.status(200).json({
                success: true,
                message: `Ditemukan ${data.length} dokumen`,
                total: data.length,
                data
            });
        } catch (error) {
            console.error("FileController.bulkInfo error:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/documents/bulk-download
     * Download semua dokumen sesuai filter sebagai response multipart
     * atau kembalikan ZIP sederhana menggunakan zlib bawaan Node.js
     * Query: jenis_file, user_ids[], jabatan_id
     */
    async bulkDownload(req, res) {
        try {
            const files = await fileService.getBulkFiles(req.query);

            if (files.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Tidak ada dokumen yang ditemukan sesuai filter."
                });
            }

            // Buat ZIP menggunakan child_process + zip bawaan sistem
            // atau gunakan pendekatan: kirim manifest JSON untuk download satu per satu di frontend
            // Karena ZIP butuh library, kita kembalikan CSV manifest dengan URL dokumen
            const e = (val) => {
                const s = String(val ?? '');
                return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
            };

            const jenis = req.query.jenis_file || 'Semua';
            const lines = [
                `Manifest Dokumen - ${jenis}`,
                `Total,${files.length}`,
                `Diekspor pada,${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
                '',
                'No,Nama Karyawan,Jabatan,Jenis Dokumen,URL Dokumen'
            ];
            files.forEach((f, i) => {
                lines.push([
                    i + 1,
                    e(f.user_name),
                    e(f.jabatan),
                    e(f.jenis_file),
                    e(f.fileUpload ?? '-'),
                ].join(','));
            });

            const csv      = lines.join('\r\n');
            const filename = `dokumen-${jenis.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.csv`;
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.status(200).send('\uFEFF' + csv);
        } catch (error) {
            console.error("FileController.bulkDownload error:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

export default new FileController();
