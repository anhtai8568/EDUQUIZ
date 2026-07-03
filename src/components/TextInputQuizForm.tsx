import React, { useState } from 'react';
import { Sparkles, ArrowLeft, Play } from 'lucide-react';
import { parseQuizText } from '../utils/pdfParser';
import type { ParseResult } from '../utils/pdfParser';

interface TextInputQuizFormProps {
  onParseSuccess: (result: ParseResult, title: string, rawText: string) => void;
  onBack: () => void;
}

export const TextInputQuizForm: React.FC<TextInputQuizFormProps> = ({
  onParseSuccess,
  onBack
}) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLoadSample = () => {
    setTitle('Đề Ôn Tập Tiếng Việt Mẫu');
    setText(`Câu 1: Thủ đô của Việt Nam là gì?
A. Thành phố Hồ Chí Minh
B. Hà Nội
C. Đà Nẵng
D. Hải Phòng

Câu 2: Trái Đất quay quanh Mặt Trời mất khoảng thời gian bao lâu?
A. 24 giờ
B. 30 ngày
C. 365 ngày (1 năm)
D. 12 tháng

Câu 3: Kim loại nào sau đây dẫn điện tốt nhất?
A. Sắt
B. Đồng
C. Bạc
D. Nhôm

ĐÁP ÁN:
1. B
2. C
3. C
`);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề của đề thi!');
      return;
    }
    if (!text.trim()) {
      setError('Vui lòng nhập nội dung danh sách câu hỏi!');
      return;
    }

    try {
      const result = parseQuizText(text);
      if (result.questions.length === 0) {
        setError('Không thể bóc tách câu hỏi nào từ nội dung văn bản. Vui lòng kiểm tra lại cấu trúc câu hỏi (Ví dụ: Câu 1:, A., B., C., D.)!');
        return;
      }
      onParseSuccess(result, title, text);
    } catch (e: any) {
      setError('Đã xảy ra lỗi khi phân tích cú pháp: ' + e.message);
    }
  };

  return (
    <div className="glass-panel animate-slide-up" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>
          Tạo Đề Thi Trắc Nghiệm Bằng Văn Bản
        </h2>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '-8px' }}>
        Sao chép và dán trực tiếp danh sách câu hỏi kèm đáp án ở cuối văn bản. Hệ thống sẽ bóc tách và tạo thành giao diện làm bài tương tác (kiểu Quizizz).
      </p>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--danger-light)',
          border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--danger)',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Title Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>Tiêu đề đề ôn tập:</label>
          <input 
            type="text" 
            placeholder="Ví dụ: Đề thi thử học kỳ 1 môn Địa lý"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: '12px 16px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: '600'
            }}
          />
        </div>

        {/* Text Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>Danh sách câu hỏi & Đáp án:</label>
            <button 
              type="button" 
              onClick={handleLoadSample} 
              className="btn btn-outline"
              style={{ padding: '4px 10px', fontSize: '11px', gap: '4px' }}
            >
              <Sparkles size={12} /> Tải văn bản mẫu
            </button>
          </div>

          <textarea 
            placeholder="Dán câu hỏi của bạn tại đây...&#10;Ví dụ:&#10;Câu 1: Câu hỏi?&#10;A. Đáp án 1&#10;B. Đáp án 2&#10;...&#10;ĐÁP ÁN:&#10;1. A"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            style={{
              padding: '14px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'monospace',
              lineHeight: '1.6',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Buttons */}
        <button 
          type="submit" 
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontWeight: '700', fontSize: '15px' }}
        >
          Phân Tích & Tạo Đề Thi Ngay <Play size={16} />
        </button>
      </form>
    </div>
  );
};
