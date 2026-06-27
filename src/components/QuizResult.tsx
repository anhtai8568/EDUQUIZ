import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  RotateCcw, 
  Upload, 
  BookOpen
} from 'lucide-react';
import type { Question } from '../utils/pdfParser';

interface QuizResultProps {
  questions: Question[];
  userAnswers: Record<number, string>;
  timeSpent: number;
  onRestart: () => void;
  onUploadNew: () => void;
}

export const QuizResult: React.FC<QuizResultProps> = ({
  questions,
  userAnswers,
  timeSpent,
  onRestart,
  onUploadNew
}) => {
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');

  const totalQuestions = questions.length;
  
  // Calculate statistics
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  questions.forEach((q) => {
    const userAns = userAnswers[q.id];
    if (!userAns) {
      unansweredCount++;
    } else if (userAns === q.correctAnswer) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

  // Format time (seconds -> MM:SS)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const getScoreMessage = (percentage: number) => {
    if (percentage >= 90) return { title: 'Xuất sắc!', desc: 'Bạn đã làm bài rất tốt! Hãy tiếp tục phát huy.', color: 'var(--success)' };
    if (percentage >= 70) return { title: 'Khá tốt!', desc: 'Kết quả khả quan, chỉ cần ôn luyện thêm một chút là hoàn hảo.', color: 'var(--primary-color)' };
    if (percentage >= 50) return { title: 'Đạt yêu cầu!', desc: 'Bạn đã nắm được kiến thức cơ bản. Cần cố gắng thêm.', color: 'var(--warning)' };
    return { title: 'Cần nỗ lực hơn!', desc: 'Đừng nản chí, hãy xem lại các câu sai và ôn tập lại nhé.', color: 'var(--danger)' };
  };

  const message = getScoreMessage(scorePercentage);

  // SVG Chart Config
  const radius = 50;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke dashes
  const correctOffset = circumference - (correctCount / totalQuestions) * circumference;

  // Filtered Questions
  const filteredQuestions = questions.filter((q) => {
    const userAns = userAnswers[q.id];
    if (filter === 'correct') return userAns === q.correctAnswer;
    if (filter === 'incorrect') return userAns && userAns !== q.correctAnswer;
    if (filter === 'unanswered') return !userAns;
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
      
      {/* Top Banner & Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', alignItems: 'stretch' }}>
        
        {/* Score message card */}
        <div className="glass-panel" style={{ padding: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', color: message.color, marginBottom: '12px' }}>
            {message.title}
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '480px' }}>
            {message.desc}
          </p>
          
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button onClick={onRestart} className="btn btn-primary">
              <RotateCcw size={16} /> Làm Lại Đề Này
            </button>
            <button onClick={onUploadNew} className="btn btn-secondary">
              <Upload size={16} /> Tải Đề Thi Mới
            </button>
          </div>
        </div>

        {/* Circular Chart card */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', width: '140px', height: '140px' }}>
            {/* SVG circle donut chart */}
            <svg width="140" height="140" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="transparent"
                stroke="var(--bg-secondary)"
                strokeWidth={strokeWidth}
              />
              {/* Correct answers circle segment */}
              {correctCount > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="var(--success)"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={correctOffset}
                  strokeLinecap="round"
                />
              )}
            </svg>
            
            {/* Center percentage text */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '32px', fontWeight: '800', display: 'block', lineHeight: '1' }}>
                {scorePercentage}%
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                {correctCount}/{totalQuestions} Câu
              </span>
            </div>
          </div>

          {/* Quick legend stats */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
              <span>Đúng: {correctCount}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--danger)' }}></span>
              <span>Sai: {incorrectCount}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }}></span>
              <span>Chưa làm: {unansweredCount}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', width: '100%', justifyContent: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <Clock size={14} /> <span>Thời gian làm bài: <strong>{formatTime(timeSpent)}</strong></span>
          </div>
        </div>
      </div>

      {/* Filter and Details List Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} /> Chi Tiết Từng Câu Hỏi
          </h3>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            {[
              { id: 'all', label: `Tất cả (${totalQuestions})` },
              { id: 'correct', label: `Câu đúng (${correctCount})` },
              { id: 'incorrect', label: `Câu sai (${incorrectCount})` },
              { id: 'unanswered', label: `Chưa làm (${unansweredCount})` }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id as any)}
                className={`btn`}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: filter === btn.id ? 'var(--bg-card)' : 'transparent',
                  color: filter === btn.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                  boxShadow: filter === btn.id ? 'var(--shadow-sm)' : 'none'
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Questions list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredQuestions.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Không có câu hỏi nào khớp với bộ lọc đã chọn.
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const userAns = userAnswers[q.id];
              const isCorrect = userAns === q.correctAnswer;
              
              let leftBorderColor = 'var(--text-muted)';
              if (userAns) {
                leftBorderColor = isCorrect ? 'var(--success)' : 'var(--danger)';
              }

              return (
                <div 
                  key={q.id} 
                  className="glass-panel" 
                  style={{ 
                    padding: '24px', 
                    borderLeft: `4px solid ${leftBorderColor}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="badge badge-primary">Câu {q.id}</span>
                      {userAns ? (
                        isCorrect ? (
                          <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> Đúng
                          </span>
                        ) : (
                          <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <XCircle size={12} /> Sai
                          </span>
                        )
                      ) : (
                        <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={12} /> Chưa làm
                        </span>
                      )}
                    </div>
                  </div>

                  <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '18px', color: 'var(--text-primary)' }}>
                    {q.questionText}
                  </h4>

                  {/* Options display with correct/incorrect markers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', paddingLeft: '8px' }}>
                    {q.options.map((opt) => {
                      const isUserSelected = userAns === opt.key;
                      const isOptionCorrect = q.correctAnswer === opt.key;

                      let itemBorder = 'var(--border-color)';
                      let itemBg = 'var(--bg-card)';
                      let itemColor = 'var(--text-primary)';

                      if (isOptionCorrect) {
                        itemBorder = 'var(--success)';
                        itemBg = 'var(--success-light)';
                        itemColor = 'var(--success)';
                      } else if (isUserSelected && !isCorrect) {
                        itemBorder = 'var(--danger)';
                        itemBg = 'var(--danger-light)';
                        itemColor = 'var(--danger)';
                      }

                      return (
                        <div
                          key={opt.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid',
                            borderColor: itemBorder,
                            backgroundColor: itemBg,
                            color: itemColor,
                            fontSize: '14px',
                            fontWeight: isUserSelected || isOptionCorrect ? '600' : '400'
                          }}
                        >
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: isOptionCorrect 
                              ? 'var(--success)' 
                              : isUserSelected 
                                ? 'var(--danger)' 
                                : 'var(--bg-secondary)',
                            color: isOptionCorrect || isUserSelected ? '#ffffff' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '800',
                            fontSize: '12px',
                            flexShrink: 0
                          }}>
                            {opt.key}
                          </span>
                          <span style={{ flexGrow: 1 }}>{opt.text}</span>
                          
                          {isOptionCorrect && <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                          {isUserSelected && !isCorrect && <XCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation (if any) */}
                  {q.explanation && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '12px 16px', 
                      backgroundColor: 'var(--info-light)', 
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      color: 'var(--info)',
                      borderLeft: '3px solid var(--info)'
                    }}>
                      <strong>Giải thích:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
