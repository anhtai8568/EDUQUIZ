import React from 'react';
import { 
  FileText, 
  Clock, 
  Trash2, 
  Plus, 
  Calendar,
  ChevronRight
} from 'lucide-react';
import type { QuizFileRecord } from '../utils/db';

interface DashboardProps {
  files: QuizFileRecord[];
  onSelectFile: (record: QuizFileRecord) => void;
  onDeleteFile: (id: string) => void;
  onAddNewFile: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  files,
  onSelectFile,
  onDeleteFile,
  onAddNewFile
}) => {
  // Format elapsed time (seconds -> MM:SS or HH:MM:SS)
  const formatPracticeTime = (secs: number) => {
    if (secs === 0) return '00:00';
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins.toString().padStart(2, '0')}m`;
    }
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Format date relative or absolute
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    return `${days} ngày trước`;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '800', margin: 0, textAlign: 'left' }} className="text-gradient">
            Thư Viện Ôn Thi Của Bạn
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginTop: '4px' }}>
            Quản lý tiến độ luyện trắc nghiệm và câu sai tích lũy của từng file PDF.
          </p>
        </div>

        <button 
          onClick={onAddNewFile}
          className="btn btn-primary"
          style={{ padding: '12px 24px', boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.3)' }}
        >
          <Plus size={18} /> Thêm Đề PDF Mới
        </button>
      </div>

      {/* Empty State */}
      {files.length === 0 ? (
        <div className="glass-panel" style={{
          padding: '80px 40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          cursor: 'pointer'
        }} onClick={onAddNewFile}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileText size={40} />
          </div>
          <div style={{ maxWidth: '440px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>Chưa Có Đề Thi Nào</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
              Hãy tải lên file PDF câu hỏi trắc nghiệm tiếng Việt đầu tiên của bạn. Hệ thống sẽ lưu trữ và theo dõi tiến độ ôn luyện của bạn.
            </p>
          </div>
          <button className="btn btn-primary">
            <Plus size={16} /> Tải đề lên ngay
          </button>
        </div>
      ) : (
        /* Files Grid List */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '24px'
        }}>
          {files.map((file) => {
            const answeredCount = Object.keys(file.userAnswers).length;
            const activeWrongCount = file.wrongQuestions ? file.wrongQuestions.length : 0;
            const wrongHistoryCount = file.wrongAttempts ? Object.keys(file.wrongAttempts).length : 0;

            return (
              <div 
                key={file.id} 
                className="glass-panel file-card animate-scale-in"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '24px',
                  position: 'relative',
                  border: '1px solid var(--border-color)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer'
                }}
                onClick={() => onSelectFile(file)}
              >
                {/* File Header */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <FileText size={24} />
                  </div>
                  <div style={{ overflow: 'hidden', flexGrow: 1 }}>
                    <h3 
                      style={{ 
                        fontSize: '16px', 
                        fontWeight: '700', 
                        margin: 0, 
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={file.name}
                    >
                      {file.name}
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Calendar size={12} /> Thêm ngày: {formatDate(file.addedAt)}
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '12px', 
                  borderTop: '1px solid var(--border-color)', 
                  borderBottom: '1px solid var(--border-color)',
                  padding: '16px 0',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>TIẾN ĐỘ</span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {answeredCount > 0 ? `Đã làm ${answeredCount} câu` : 'Chưa làm câu nào'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>CÂU SAI CẦN LƯU Ý</span>
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: '800', 
                      color: activeWrongCount > 0 ? 'var(--danger)' : 'var(--text-secondary)' 
                    }}>
                      {activeWrongCount} câu {wrongHistoryCount > 0 ? `(từng sai ${wrongHistoryCount})` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>THỜI GIAN LUYỆN</span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {formatPracticeTime(file.elapsedTime)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>HOẠT ĐỘNG GẦN NHẤT</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {formatRelativeTime(file.lastActiveAt)}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: 'auto'
                }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Bạn có chắc chắn muốn xóa tài liệu "${file.name}" và toàn bộ kết quả ôn luyện không?`)) {
                        onDeleteFile(file.id);
                      }
                    }}
                    className="btn btn-outline"
                    style={{ 
                      padding: '8px 12px', 
                      fontSize: '13px', 
                      color: 'var(--danger)', 
                      borderColor: 'transparent',
                      backgroundColor: 'transparent'
                    }}
                    title="Xóa đề thi"
                  >
                    <Trash2 size={16} /> Xóa đề
                  </button>

                  <button 
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px', gap: '4px' }}
                  >
                    Vào ôn luyện <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hover Lift Style Injection */}
      <style>{`
        .file-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary-color) !important;
        }
      `}</style>
    </div>
  );
};
