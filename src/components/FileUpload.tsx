import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Loader2, AlertCircle } from 'lucide-react';
import { extractTextFromPDF, parseQuizText } from '../utils/pdfParser';
import type { ParseResult } from '../utils/pdfParser';

interface FileUploadProps {
  onParseSuccess: (result: ParseResult, file: File | null) => void;
  onBackToDashboard?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onParseSuccess, onBackToDashboard }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Vui lòng chọn một file PDF hợp lệ.');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // 1. Extract text from PDF
      const text = await extractTextFromPDF(file, (p) => setProgress(p));
      
      // 2. Parse text into questions and answers
      const result = parseQuizText(text);
      
      onParseSuccess(result, file);
    } catch (err: any) {
      console.error(err);
      setError('Đã có lỗi xảy ra khi đọc file PDF. Đảm bảo file không bị khóa hoặc lỗi định dạng.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Helper to load sample quiz for demonstration
  const handleLoadSample = () => {
    const sampleText = `ĐỀ ÔN TẬP CHỮ CÁI TIẾNG VIỆT
Câu 1. Chữ cái nào dưới đây là chữ "A"?
A. B
B. A
C. C
D. D

Câu 2. Chữ "Ă" có đặc điểm gì khác so với chữ "A"?
A. Có thêm dấu mũ ngược (á á) ở trên đầu
B. Có thêm dấu râu ở bên phải
C. Có thêm dấu gạch ngang ở giữa
D. Không có gì khác biệt

Câu 3: Trong các từ sau, từ nào chứa chữ cái "Ô"?
A. Con cá
B. Cái ô
C. Cái ca
D. Quả na

Câu 4: Chữ cái nào đứng ngay sau chữ "U" trong bảng chữ cái tiếng Việt?
A. V
B. Ư
C. T
D. Y

Câu 5: Từ "Mèo" bắt đầu bằng chữ cái nào?
A. N
B. M
C. L
D. H

ĐÁP ÁN ĐỀ THI
1. B
2. A
3. B
4. B
5. B
`;
    const result = parseQuizText(sampleText);
    onParseSuccess(result, null);
  };

  return (
    <div className="glass-panel animate-slide-up" style={{ padding: '40px', maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      {onBackToDashboard && (
        <button 
          onClick={onBackToDashboard} 
          className="btn btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ← Bảng điều khiển
        </button>
      )}
      <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px', textAlign: 'center' }}>
        Tải Đề Thi Lên Hệ Thống
      </h2>
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px' }}>
        Hỗ trợ file PDF trắc nghiệm tiếng Việt. Hệ thống tự động phân tích câu hỏi và đáp án ở cuối file.
      </p>

      <form 
        onDragEnter={handleDrag} 
        onDragOver={handleDrag} 
        onDragLeave={handleDrag} 
        onDrop={handleDrop}
        onClick={onButtonClick}
        style={{
          border: '2px dashed var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragActive ? 'var(--primary-light)' : 'transparent',
          borderColor: isDragActive ? 'var(--primary-color)' : 'var(--border-color)',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".pdf" 
          onChange={handleChange} 
          style={{ display: 'none' }}
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary-color)', animation: 'spin 1.5s linear infinite' }} />
            <p style={{ fontWeight: '600' }}>Đang đọc và phân tích file PDF...</p>
            <div style={{
              width: '200px',
              height: '8px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: 'var(--primary-color)',
                transition: 'width 0.2s ease'
              }}></div>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{progress}% hoàn tất</p>
          </div>
        ) : (
          <>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UploadCloud size={32} />
            </div>
            <div>
              <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>
                Kéo thả file PDF vào đây hoặc click để chọn file
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Dung lượng tối đa đề xuất: 20MB
              </p>
            </div>
          </>
        )}
      </form>

      {error && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: 'var(--danger-light)',
          border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{
        marginTop: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        borderTop: '1px solid var(--border-color)',
        paddingTop: '24px'
      }}>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Không có sẵn file PDF câu hỏi?</p>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleLoadSample();
          }}
          className="btn btn-secondary"
          style={{ width: '100%', maxWidth: '240px' }}
        >
          <FileText size={16} /> Thử Đề Thi Mẫu
        </button>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};
