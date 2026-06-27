import React, { useState } from 'react';
import { Check, Edit2, Play, AlertTriangle, Key, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { parseManualAnswers } from '../utils/pdfParser';
import type { Question, ParseResult } from '../utils/pdfParser';

interface PreviewParserProps {
  parseResult: ParseResult;
  onConfirm: (questions: Question[]) => void;
  onBack: () => void;
  onStartSplitView: () => void;
  hasFile: boolean;
}

export const PreviewParser: React.FC<PreviewParserProps> = ({
  parseResult,
  onConfirm,
  onBack,
  onStartSplitView,
  hasFile
}) => {
  const [questions, setQuestions] = useState<Question[]>(parseResult.questions);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [manualAnswerStr, setManualAnswerStr] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [editForm, setEditForm] = useState<Question | null>(null);

  // Count status
  const totalQuestions = questions.length;
  const missingAnswersCount = questions.filter((q) => !q.correctAnswer).length;

  // Apply manual answer key
  const handleApplyManualAnswers = () => {
    if (!manualAnswerStr.trim()) return;
    const manualAnswers = parseManualAnswers(manualAnswerStr);
    
    const updated = questions.map((q) => {
      if (manualAnswers.has(q.id)) {
        return { ...q, correctAnswer: manualAnswers.get(q.id)! };
      }
      return q;
    });
    
    setQuestions(updated);
    setManualAnswerStr('');
    setShowManualInput(false);
  };

  // Start editing a question
  const startEditing = (q: Question) => {
    setEditingId(q.id);
    setEditForm(JSON.parse(JSON.stringify(q))); // Deep copy
  };

  // Handle edit form change
  const handleEditChange = (field: keyof Question, value: any) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  };

  const handleOptionChange = (index: number, text: string) => {
    if (!editForm) return;
    const newOptions = [...editForm.options];
    newOptions[index] = { ...newOptions[index], text };
    setEditForm({ ...editForm, options: newOptions });
  };

  // Save edited question
  const saveEdit = () => {
    if (!editForm) return;
    setQuestions(questions.map((q) => (q.id === editForm.id ? editForm : q)));
    setEditingId(null);
    setEditForm(null);
  };

  // Delete question
  const deleteQuestion = (id: number) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  // Add new blank question
  const addQuestion = () => {
    const nextId = questions.length > 0 ? Math.max(...questions.map(q => q.id)) + 1 : 1;
    const newQ: Question = {
      id: nextId,
      questionText: `Câu hỏi số ${nextId}`,
      options: [
        { key: 'A', text: '' },
        { key: 'B', text: '' },
        { key: 'C', text: '' },
        { key: 'D', text: '' }
      ],
      correctAnswer: 'A'
    };
    setQuestions([...questions, newQ]);
    startEditing(newQ);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeft size={18} /> Quay lại
          </button>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Xem Trước & Khớp Đáp Án</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Đã trích xuất {totalQuestions} câu hỏi.
              {missingAnswersCount > 0 ? (
                <span style={{ color: 'var(--danger)', fontWeight: '600', marginLeft: '8px' }}>
                  ({missingAnswersCount} câu chưa có đáp án)
                </span>
              ) : (
                <span style={{ color: 'var(--success)', fontWeight: '600', marginLeft: '8px' }}>
                  (Tất cả đã khớp đáp án)
                </span>
              )}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setShowManualInput(!showManualInput)} 
            className="btn btn-secondary"
          >
            <Key size={16} /> Nhập Đáp Án Tay
          </button>
          <button 
            onClick={addQuestion} 
            className="btn btn-outline"
          >
            <Plus size={16} /> Thêm Câu Hỏi
          </button>
          {hasFile && (
            <button 
              onClick={onStartSplitView} 
              className="btn btn-outline"
              style={{ borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}
            >
              Split View
            </button>
          )}
          <button 
            onClick={() => onConfirm(questions)} 
            className="btn btn-primary"
            disabled={totalQuestions === 0}
          >
            Bắt đầu làm bài <Play size={16} />
          </button>
        </div>
      </div>

      {/* Manual Answer Input Drawer */}
      {showManualInput && (
        <div className="glass-panel animate-slide-up" style={{ padding: '20px', borderLeft: '4px solid var(--primary-color)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Nhập Nhanh Bảng Đáp Án</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Dán bảng đáp án từ PDF (Ví dụ: 1A 2B 3C 4.D hoặc 1.A, 2.B...). Hệ thống sẽ tự động ghép vào các câu hỏi tương ứng.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Ví dụ: 1B 2A 3D 4C 5A..."
              value={manualAnswerStr}
              onChange={(e) => setManualAnswerStr(e.target.value)}
              style={{
                flexGrow: 1,
                padding: '10px 16px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px'
              }}
            />
            <button onClick={handleApplyManualAnswers} className="btn btn-primary" style={{ padding: '10px 20px' }}>
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* Missing Answers Warning Alert */}
      {missingAnswersCount > 0 && (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--warning-light)',
          border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--warning)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px'
        }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Cảnh báo:</strong> Có {missingAnswersCount} câu hỏi chưa có đáp án đúng. Bạn vẫn có thể bắt đầu làm bài, nhưng những câu này sẽ không thể chấm điểm chính xác trừ khi bạn chỉnh sửa thiết lập đáp án cho chúng.
          </div>
        </div>
      )}

      {/* Questions Preview List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {questions.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--warning-light)',
              color: 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={28} />
            </div>
            
            <div style={{ maxWidth: '480px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>
                Không Thể Trích Xuất Tự Động Câu Hỏi
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Hệ thống không tìm thấy nội dung văn bản câu hỏi nào. Điều này thường xảy ra nếu file PDF của bạn là <strong>dạng ảnh quét (scanned PDF)</strong> hoặc có định dạng bảng biểu quá phức tạp.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {hasFile && (
                <button onClick={onStartSplitView} className="btn btn-primary" style={{ padding: '12px 24px' }}>
                  Làm bài ở chế độ Chia đôi màn hình (Split View)
                </button>
              )}
              <button onClick={onBack} className="btn btn-secondary">
                Tải file PDF khác
              </button>
            </div>
          </div>
        ) : (
          questions.map((q) => {
            const isEditing = editingId === q.id;

            return (
              <div 
                key={q.id} 
                className="glass-panel" 
                style={{ 
                  padding: '24px', 
                  borderLeft: isEditing 
                    ? '4px solid var(--primary-color)' 
                    : !q.correctAnswer 
                      ? '4px solid var(--danger)' 
                      : '4px solid transparent',
                  transition: 'border-color 0.2s'
                }}
              >
                {isEditing && editForm ? (
                  // Edit Mode Form
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span className="badge badge-primary" style={{ fontSize: '14px', padding: '6px 12px' }}>
                        Câu {editForm.id}
                      </span>
                      <input 
                        type="text" 
                        value={editForm.questionText} 
                        onChange={(e) => handleEditChange('questionText', e.target.value)}
                        style={{
                          flexGrow: 1,
                          padding: '8px 12px',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          fontSize: '15px',
                          fontWeight: '600'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {editForm.options.map((opt, idx) => (
                        <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', width: '20px' }}>{opt.key}.</span>
                          <input 
                            type="text" 
                            value={opt.text} 
                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                            placeholder={`Phương án ${opt.key}`}
                            style={{
                              flexGrow: 1,
                              padding: '8px 12px',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Đáp án đúng:</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {['A', 'B', 'C', 'D'].map((letter) => (
                            <button
                              key={letter}
                              onClick={() => handleEditChange('correctAnswer', letter)}
                              className={`btn`}
                              style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: editForm.correctAnswer === letter ? 'var(--success)' : 'var(--bg-secondary)',
                                color: editForm.correctAnswer === letter ? 'white' : 'var(--text-primary)',
                                border: '1px solid var(--border-color)'
                              }}
                            >
                              {letter}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setEditingId(null)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }}>
                          Hủy
                        </button>
                        <button onClick={saveEdit} className="btn btn-success" style={{ padding: '8px 16px', fontSize: '14px' }}>
                          <Check size={16} /> Lưu lại
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Read-Only Preview Mode
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <span className="badge badge-primary" style={{ marginTop: '2px' }}>
                          Câu {q.id}
                        </span>
                        <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                          {q.questionText || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Không có nội dung câu hỏi</span>}
                        </h4>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button 
                          onClick={() => startEditing(q)} 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 10px', fontSize: '13px' }}
                          title="Sửa câu hỏi"
                        >
                          <Edit2 size={14} /> Sửa
                        </button>
                        <button 
                          onClick={() => deleteQuestion(q.id)} 
                          className="btn btn-outline" 
                          style={{ padding: '6px 10px', fontSize: '13px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                          title="Xóa câu hỏi"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Options list */}
                    {q.options.length > 0 && (
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                        gap: '8px',
                        paddingLeft: '32px'
                      }}>
                        {q.options.map((opt) => (
                          <div 
                            key={opt.key} 
                            style={{ 
                              fontSize: '14px', 
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              gap: '6px'
                            }}
                          >
                            <span style={{ fontWeight: '700' }}>{opt.key}.</span>
                            <span>{opt.text || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Trống</span>}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Correct Answer Display */}
                    <div style={{ 
                      paddingLeft: '32px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      fontSize: '13px',
                      marginTop: '4px'
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>Đáp án:</span>
                      {q.correctAnswer ? (
                        <span className="badge badge-success" style={{ fontWeight: '700' }}>
                          {q.correctAnswer}
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ fontWeight: '700' }}>
                          Chưa có đáp án!
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
