import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Bookmark, 
  Grid, 
  List, 
  Clock, 
  AlertTriangle, 
  Send, 
  Compass
} from 'lucide-react';
import type { Question } from '../utils/pdfParser';

interface QuizPanelProps {
  questions: Question[];
  onSubmit: (userAnswers: Record<number, string>, timeSpent: number) => void;
  onExit: () => void;
}

export const QuizPanel: React.FC<QuizPanelProps> = ({ questions, onSubmit, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [bookmarks, setBookmarks] = useState<Record<number, boolean>>({});
  const [viewMode, setViewMode] = useState<'single' | 'list'>('single');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const timerRef = useRef<any | null>(null);

  // Start timer on mount
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Format time (seconds -> MM:SS)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (questionId: number, optionKey: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const toggleBookmark = (questionId: number) => {
    setBookmarks((prev) => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(userAnswers).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex(currentIndex + 1);
  };

  const handleSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onSubmit(userAnswers, elapsedTime);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px', width: '100%', alignItems: 'start' }}>
      {/* Left side: Questions Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Toggle Mode and Exit bar */}
        <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onExit} className="btn btn-outline" style={{ padding: '8px 16px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
            Thoát bài thi
          </button>
          
          <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button 
              onClick={() => setViewMode('single')}
              className={`btn`}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: viewMode === 'single' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'single' ? 'var(--primary-color)' : 'var(--text-secondary)',
                boxShadow: viewMode === 'single' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <Compass size={14} /> Từng câu một
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`btn`}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'list' ? 'var(--primary-color)' : 'var(--text-secondary)',
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <List size={14} /> Danh sách đầy đủ
            </button>
          </div>
        </div>

        {/* View Mode: Single Question */}
        {viewMode === 'single' && currentQuestion && (
          <div className="glass-panel animate-scale-in" style={{ padding: '40px', position: 'relative' }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <span className="badge badge-primary" style={{ fontSize: '14px', padding: '6px 14px' }}>
                Câu {currentIndex + 1} / {totalQuestions}
              </span>
              <button 
                onClick={() => toggleBookmark(currentQuestion.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: bookmarks[currentQuestion.id] ? 'var(--warning)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                <Bookmark size={18} fill={bookmarks[currentQuestion.id] ? 'var(--warning)' : 'none'} />
                {bookmarks[currentQuestion.id] ? 'Đã đánh dấu' : 'Đánh dấu câu hỏi'}
              </button>
            </div>

            {/* Question Text */}
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '32px', lineHeight: '1.5' }}>
              {currentQuestion.questionText}
            </h3>

            {/* Options list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
              {currentQuestion.options.map((opt) => {
                const isSelected = userAnswers[currentQuestion.id] === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectOption(currentQuestion.id, opt.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '18px 24px',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid',
                      borderColor: isSelected ? 'var(--primary-color)' : 'var(--border-color)',
                      backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: isSelected ? '600' : '400',
                      transition: 'all 0.2s ease',
                      width: '100%'
                    }}
                  >
                    <span style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isSelected ? 'var(--primary-color)' : 'var(--bg-secondary)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '16px',
                      flexShrink: 0
                    }}>
                      {opt.key}
                    </span>
                    <span style={{ flexGrow: 1 }}>{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
              <button 
                onClick={handlePrev} 
                className="btn btn-secondary" 
                disabled={currentIndex === 0}
              >
                <ChevronLeft size={16} /> Câu trước
              </button>
              <button 
                onClick={handleNext} 
                className="btn btn-secondary" 
                disabled={currentIndex === totalQuestions - 1}
              >
                Câu tiếp <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* View Mode: List View */}
        {viewMode === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {questions.map((q, idx) => (
              <div 
                key={q.id} 
                className="glass-panel" 
                style={{ 
                  padding: '28px',
                  borderLeft: currentIndex === idx ? '4px solid var(--primary-color)' : '4px solid transparent'
                }}
                onClick={() => setCurrentIndex(idx)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <span className="badge badge-primary">Câu {idx + 1}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBookmark(q.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: bookmarks[q.id] ? 'var(--warning)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    <Bookmark size={16} fill={bookmarks[q.id] ? 'var(--warning)' : 'none'} />
                  </button>
                </div>
                
                <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>{q.questionText}</h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {q.options.map((opt) => {
                    const isSelected = userAnswers[q.id] === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectOption(q.id, opt.key);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--primary-color)' : 'var(--border-color)',
                          backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: isSelected ? '600' : '400',
                          width: '100%'
                        }}
                      >
                        <span style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: isSelected ? 'var(--primary-color)' : 'var(--bg-secondary)',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800',
                          fontSize: '12px',
                          flexShrink: 0
                        }}>
                          {opt.key}
                        </span>
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right side: Dashboard Info (Sticky panel) */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '24px', 
          position: 'sticky', 
          top: '90px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '24px' 
        }}
      >
        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '24px', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <Clock size={24} style={{ color: 'var(--primary-color)' }} />
          <span>{formatTime(elapsedTime)}</span>
        </div>

        {/* Progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
            <span>Tiến độ</span>
            <span>{answeredCount} / {totalQuestions} câu</span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: 'var(--primary-color)',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
        </div>

        {/* Question Grid Map */}
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Grid size={16} /> Sơ đồ câu hỏi
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '8px',
            maxHeight: '260px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {questions.map((q, idx) => {
              const isAnswered = !!userAnswers[q.id];
              const isBookmarked = !!bookmarks[q.id];
              const isCurrent = currentIndex === idx;

              let bgColor = 'var(--bg-secondary)';
              let textColor = 'var(--text-secondary)';
              let borderColor = 'transparent';

              if (isCurrent) {
                borderColor = 'var(--primary-color)';
              }

              if (isAnswered) {
                bgColor = 'var(--primary-light)';
                textColor = 'var(--primary-color)';
              }

              if (isBookmarked) {
                bgColor = 'var(--warning-light)';
                textColor = 'var(--warning)';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px solid',
                    borderColor,
                    backgroundColor: bgColor,
                    color: textColor,
                    fontWeight: '700',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  {q.id}
                  {isBookmarked && (
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      width: '4px',
                      height: '4px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--warning)'
                    }}></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Panel */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={() => setShowSubmitConfirm(true)} 
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px' }}
          >
            <Send size={16} /> Nộp bài
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showSubmitConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel animate-scale-in" style={{ padding: '32px', maxWidth: '440px', width: '90%', textAlign: 'center', backgroundColor: 'var(--bg-card)' }}>
            <AlertTriangle size={48} style={{ color: 'var(--warning)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Xác Nhận Nộp Bài?</h3>
            
            {answeredCount < totalQuestions ? (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                Bạn mới chỉ làm xong <strong>{answeredCount} / {totalQuestions}</strong> câu hỏi. Nộp bài bây giờ các câu chưa làm sẽ được tính là sai.
              </p>
            ) : (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                Bạn đã hoàn thành toàn bộ <strong>{totalQuestions}</strong> câu hỏi. Bạn có chắc chắn muốn nộp bài và xem kết quả?
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowSubmitConfirm(false)} 
                className="btn btn-secondary"
                style={{ flexGrow: 1 }}
              >
                Hủy, làm tiếp
              </button>
              <button 
                onClick={handleSubmit} 
                className="btn btn-primary"
                style={{ flexGrow: 1 }}
              >
                Nộp bài ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
