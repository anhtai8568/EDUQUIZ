import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Play, 
  ArrowLeft, 
  BookOpen, 
  Trash2,
  Check,
  ChevronRight,
  RotateCcw,
  Home
} from 'lucide-react';
import { getQuizFile, updateQuizFileProgress, saveQuizFile } from '../utils/db';
import type { QuizFileRecord } from '../utils/db';
import type { Question } from '../utils/pdfParser';

interface InteractiveQuizPanelProps {
  recordId: string;
  onExit: () => void;
}

export const InteractiveQuizPanel: React.FC<InteractiveQuizPanelProps> = ({
  recordId,
  onExit
}) => {
  const [record, setRecord] = useState<QuizFileRecord | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState<'setup' | 'quiz' | 'result'>('setup');
  
  // Practice Mode State
  const [practiceMode, setPracticeMode] = useState<'range' | 'wrong_only'>('range');
  const [activeQuestionNumbers, setActiveQuestionNumbers] = useState<number[]>([]);
  
  // Quiz Active State
  const [currentIdx, setCurrentIdx] = useState(0); // Index in activeQuestionNumbers
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasAnsweredCurrent, setHasAnsweredCurrent] = useState(false);

  // Setup States
  const [startQuestion, setStartQuestion] = useState<number>(1);
  const [endQuestion, setEndQuestion] = useState<number>(40);
  
  // Quiz Answers States
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [selfGrades, setSelfGrades] = useState<Record<number, 'correct' | 'incorrect'>>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const timerRef = useRef<any | null>(null);

  // Manual Self-Grading States
  const [resultFilter, setResultFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
  
  // History Modal States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyModalTab, setHistoryModalTab] = useState<'active' | 'all_history'>('active');

  // Load record from IndexedDB on mount
  useEffect(() => {
    async function loadRecord() {
      const rec = await getQuizFile(recordId);
      if (rec && rec.parsedQuestions) {
        setRecord(rec);
        setQuestions(rec.parsedQuestions);

        // Load saved states
        setUserAnswers(rec.userAnswers || {});
        setSelfGrades(rec.selfGrades || {});
        setElapsedTime(rec.elapsedTime || 0);

        const totalQCount = rec.parsedQuestions.length;

        // Suggest next question range based on last practiced questions
        if (rec.endQuestion && rec.endQuestion > 0) {
          const nextStart = rec.endQuestion + 1;
          setStartQuestion(nextStart > totalQCount ? 1 : nextStart);
          setEndQuestion(Math.min(nextStart + 39, totalQCount));
        } else {
          setStartQuestion(1);
          setEndQuestion(Math.min(40, totalQCount));
        }
      }
    }
    loadRecord();
  }, [recordId]);

  // Start/Stop Timer and Auto-save elapsedTime to DB
  useEffect(() => {
    if (step === 'quiz') {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => {
          const next = prev + 1;
          // Auto-save time to IndexedDB every 5 seconds
          if (next % 5 === 0) {
            updateQuizFileProgress(recordId, { elapsedTime: next });
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, recordId]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Start standard range quiz
  const handleStartQuiz = async () => {
    const totalQCount = questions.length;
    if (startQuestion > endQuestion) {
      alert('Câu bắt đầu không thể lớn hơn câu kết thúc!');
      return;
    }
    if (endQuestion > totalQCount) {
      alert(`Đề thi này chỉ có tối đa ${totalQCount} câu!`);
      return;
    }

    setPracticeMode('range');
    
    const rangeNums = Array.from({ length: endQuestion - startQuestion + 1 }, (_, i) => startQuestion + i);
    setActiveQuestionNumbers(rangeNums);
    setStep('quiz');
    setCurrentIdx(0);
    setSelectedOption(null);
    setHasAnsweredCurrent(false);
    setElapsedTime(0);

    // Clear answers and grades for only this range to allow clean re-practice
    const updatedAnswers = { ...userAnswers };
    const updatedGrades = { ...selfGrades };
    rangeNums.forEach((qNum) => {
      delete updatedAnswers[qNum];
      delete updatedGrades[qNum];
    });

    setUserAnswers(updatedAnswers);
    setSelfGrades(updatedGrades);

    // Update active ranges in database (keep endQuestion as last submitted progress)
    await updateQuizFileProgress(recordId, {
      activeStartQuestion: startQuestion,
      activeEndQuestion: endQuestion,
      userAnswers: updatedAnswers,
      selfGrades: updatedGrades,
      lastActiveAt: Date.now()
    });

    if (record) {
      setRecord({
        ...record,
        activeStartQuestion: startQuestion,
        activeEndQuestion: endQuestion,
        userAnswers: updatedAnswers,
        selfGrades: updatedGrades,
        lastActiveAt: Date.now()
      });
    }
  };

  // Start wrong questions practice loop
  const handleStartWrongOnlyPractice = async () => {
    const wrongList = record?.wrongQuestions || [];
    if (wrongList.length === 0) return;

    setPracticeMode('wrong_only');
    setActiveQuestionNumbers(wrongList);
    setStep('quiz');
    setCurrentIdx(0);
    setSelectedOption(null);
    setHasAnsweredCurrent(false);
    setElapsedTime(0);
    setShowHistoryModal(false);

    // Clear answers and grades for wrong questions to let the user redo them
    const updatedAnswers = { ...userAnswers };
    const updatedGrades = { ...selfGrades };
    wrongList.forEach((qNum) => {
      delete updatedAnswers[qNum];
      delete updatedGrades[qNum];
    });

    setUserAnswers(updatedAnswers);
    setSelfGrades(updatedGrades);

    await updateQuizFileProgress(recordId, {
      userAnswers: updatedAnswers,
      selfGrades: updatedGrades,
      lastActiveAt: Date.now()
    });

    if (record) {
      setRecord({
        ...record,
        userAnswers: updatedAnswers,
        selfGrades: updatedGrades,
        lastActiveAt: Date.now()
      });
    }
  };

  // Start practicing all historical wrong questions (even corrected ones)
  const handleStartAllHistoryWrongPractice = async () => {
    const historyList = record?.wrongAttempts ? Object.keys(record.wrongAttempts).map(Number).sort((a, b) => a - b) : [];
    if (historyList.length === 0) return;

    setPracticeMode('wrong_only');
    setActiveQuestionNumbers(historyList);
    setStep('quiz');
    setCurrentIdx(0);
    setSelectedOption(null);
    setHasAnsweredCurrent(false);
    setElapsedTime(0);
    setShowHistoryModal(false);

    // Clear user answers and grades for all historical wrong questions, and place them back in wrongQuestions active list
    const updatedAnswers = { ...userAnswers };
    const updatedGrades = { ...selfGrades };
    const newWrongs = new Set<number>(record?.wrongQuestions || []);

    historyList.forEach((qNum) => {
      delete updatedAnswers[qNum];
      delete updatedGrades[qNum];
      newWrongs.add(qNum);
    });

    const wrongList = Array.from(newWrongs).sort((a, b) => a - b);
    setUserAnswers(updatedAnswers);
    setSelfGrades(updatedGrades);

    await updateQuizFileProgress(recordId, {
      userAnswers: updatedAnswers,
      selfGrades: updatedGrades,
      wrongQuestions: wrongList,
      lastActiveAt: Date.now()
    });

    if (record) {
      setRecord({
        ...record,
        userAnswers: updatedAnswers,
        selfGrades: updatedGrades,
        wrongQuestions: wrongList,
        lastActiveAt: Date.now()
      });
    }
  };

  // Handle choosing an option (Interactive Quizizz Mode)
  const handleSelectOption = async (qNum: number, optionKey: string) => {
    if (hasAnsweredCurrent) return; // Prevent clicking again

    setSelectedOption(optionKey);
    setHasAnsweredCurrent(true);

    const targetQuestion = questions.find(q => q.id === qNum);
    const correctAns = targetQuestion?.correctAnswer;

    const updatedAnswers = { ...userAnswers, [qNum]: optionKey };
    setUserAnswers(updatedAnswers);

    const updatedGrades = { ...selfGrades };
    const newWrongQuestions = new Set<number>(record?.wrongQuestions || []);
    const updatedAttempts = { ...(record?.wrongAttempts || {}) };

    // Auto grading if we have correct answer
    if (correctAns) {
      if (optionKey === correctAns) {
        updatedGrades[qNum] = 'correct';
        newWrongQuestions.delete(qNum);
      } else {
        updatedGrades[qNum] = 'incorrect';
        newWrongQuestions.add(qNum);
        updatedAttempts[qNum] = (updatedAttempts[qNum] || 0) + 1;
      }
    } else {
      // Default to correct when selected in case no answer key
      updatedGrades[qNum] = 'correct';
    }

    const wrongList = Array.from(newWrongQuestions).sort((a, b) => a - b);
    setSelfGrades(updatedGrades);

    // Save choice to database instantly
    await updateQuizFileProgress(recordId, {
      userAnswers: updatedAnswers,
      selfGrades: updatedGrades,
      wrongQuestions: wrongList,
      wrongAttempts: updatedAttempts,
      lastActiveAt: Date.now()
    });

    if (record) {
      setRecord({
        ...record,
        userAnswers: updatedAnswers,
        selfGrades: updatedGrades,
        wrongQuestions: wrongList,
        wrongAttempts: updatedAttempts,
        lastActiveAt: Date.now()
      });
    }
  };

  // Go to next question
  const handleNextQuestion = () => {
    if (currentIdx < activeQuestionNumbers.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedOption(null);
      setHasAnsweredCurrent(false);
    } else {
      // Finished all questions in this round, automatically submit!
      handleSubmitQuiz();
    }
  };

  // Submit and show results
  const handleSubmitQuiz = async () => {
    setShowSubmitConfirm(false);
    
    const updatedGrades = { ...selfGrades };
    const newWrongQuestions = new Set<number>(record?.wrongQuestions || []);
    const updatedAttempts = { ...(record?.wrongAttempts || {}) };

    activeQuestionNumbers.forEach((qNum) => {
      const userAns = userAnswers[qNum];
      const targetQ = questions.find(q => q.id === qNum);
      const correctAns = targetQ?.correctAnswer;

      if (!userAns) {
        updatedGrades[qNum] = 'incorrect';
        newWrongQuestions.add(qNum);
        return;
      }

      if (correctAns) {
        if (userAns === correctAns) {
          updatedGrades[qNum] = 'correct';
          newWrongQuestions.delete(qNum);
        } else {
          updatedGrades[qNum] = 'incorrect';
          newWrongQuestions.add(qNum);
          if (updatedAttempts[qNum] === undefined || (userAnswers[qNum] && !hasAnsweredCurrent)) {
            // Only increment once if not already incremented in active mode
            updatedAttempts[qNum] = (updatedAttempts[qNum] || 0) + 1;
          }
        }
      }
    });

    const wrongList = Array.from(newWrongQuestions).sort((a, b) => a - b);
    setSelfGrades(updatedGrades);
    setStep('result');

    // Calculate new completed range
    const newEnd = practiceMode === 'range' ? Math.max(record?.endQuestion || 0, endQuestion) : (record?.endQuestion || 0);
    const newStart = practiceMode === 'range' ? Math.min(record?.startQuestion || 1, startQuestion) : (record?.startQuestion || 1);

    await updateQuizFileProgress(recordId, {
      startQuestion: newStart,
      endQuestion: newEnd,
      activeStartQuestion: 0,
      activeEndQuestion: 0,
      selfGrades: updatedGrades,
      wrongQuestions: wrongList,
      wrongAttempts: updatedAttempts,
      elapsedTime,
      lastActiveAt: Date.now()
    });

    if (record) {
      setRecord({
        ...record,
        startQuestion: newStart,
        endQuestion: newEnd,
        activeStartQuestion: 0,
        activeEndQuestion: 0,
        selfGrades: updatedGrades,
        wrongQuestions: wrongList,
        wrongAttempts: updatedAttempts,
        elapsedTime,
        lastActiveAt: Date.now()
      });
    }
  };

  // Mark a question as Mastered: reset wrong count to 0, mark as correct
  const handleMasterQuestion = async (qNum: number) => {
    if (!record) return;

    const newWrongs = (record.wrongQuestions || []).filter(x => x !== qNum);
    const updatedAttempts = { ...(record.wrongAttempts || {}) };
    delete updatedAttempts[qNum];

    const updatedGrades = { ...(record.selfGrades || {}), [qNum]: 'correct' as const };
    const updatedAnswers = { ...(record.userAnswers || {}), [qNum]: userAnswers[qNum] || 'A' };

    await updateQuizFileProgress(recordId, {
      wrongQuestions: newWrongs,
      wrongAttempts: updatedAttempts,
      selfGrades: updatedGrades,
      userAnswers: updatedAnswers,
      lastActiveAt: Date.now()
    });

    setRecord({
      ...record,
      wrongQuestions: newWrongs,
      wrongAttempts: updatedAttempts,
      selfGrades: updatedGrades,
      userAnswers: updatedAnswers,
      lastActiveAt: Date.now()
    });

    setSelfGrades(updatedGrades);
    setUserAnswers(updatedAnswers);
  };

  // Mark grade manually: auto-saves immediately to database
  const handleMarkGrade = async (qNum: number, grade: 'correct' | 'incorrect') => {
    const updatedGrades = { ...selfGrades, [qNum]: grade };
    setSelfGrades(updatedGrades);

    const newWrongQuestions = new Set<number>(record?.wrongQuestions || []);
    const updatedAttempts = { ...(record?.wrongAttempts || {}) };

    if (grade === 'incorrect') {
      newWrongQuestions.add(qNum);
      updatedAttempts[qNum] = (updatedAttempts[qNum] || 0) + 1;
    } else {
      newWrongQuestions.delete(qNum);
    }

    const wrongList = Array.from(newWrongQuestions).sort((a, b) => a - b);

    await updateQuizFileProgress(recordId, {
      selfGrades: updatedGrades,
      wrongQuestions: wrongList,
      wrongAttempts: updatedAttempts,
      lastActiveAt: Date.now()
    });

    if (record) {
      setRecord({
        ...record,
        selfGrades: updatedGrades,
        wrongQuestions: wrongList,
        wrongAttempts: updatedAttempts,
        lastActiveAt: Date.now()
      });
    }
  };

  // Restart current round
  const handleRestart = () => {
    setStep('quiz');
    setCurrentIdx(0);
    setSelectedOption(null);
    setHasAnsweredCurrent(false);
    const updatedAnswers = { ...userAnswers };
    const updatedGrades = { ...selfGrades };
    const newWrongQuestions = new Set<number>(record?.wrongQuestions || []);

    activeQuestionNumbers.forEach((qNum) => {
      delete updatedAnswers[qNum];
      delete updatedGrades[qNum];
      newWrongQuestions.delete(qNum);
    });

    setUserAnswers(updatedAnswers);
    setSelfGrades(updatedGrades);
    setElapsedTime(0);
    setResultFilter('all');

    updateQuizFileProgress(recordId, {
      userAnswers: updatedAnswers,
      selfGrades: updatedGrades,
      wrongQuestions: Array.from(newWrongQuestions).sort((a, b) => a - b),
      elapsedTime: 0,
      lastActiveAt: Date.now()
    });
  };

  // Clear entire history
  const handleClearHistory = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử câu sai và tiến độ của file này không?')) {
      if (record) {
        const clearedRecord: QuizFileRecord = {
          ...record,
          userAnswers: {},
          selfGrades: {},
          wrongQuestions: [],
          wrongAttempts: {},
          elapsedTime: 0,
          startQuestion: 1,
          endQuestion: 0,
          lastActiveAt: Date.now()
        };
        await saveQuizFile(clearedRecord);
        setRecord(clearedRecord);
        setUserAnswers({});
        setSelfGrades({});
        setElapsedTime(0);
        setStartQuestion(1);
        setEndQuestion(Math.min(40, questions.length));
        setPracticeMode('range');
        setActiveQuestionNumbers([]);
        setShowHistoryModal(false);
      }
    }
  };

  const handleResetToSetup = () => {
    setStep('setup');
    setPracticeMode('range');
  };

  const handleExit = async () => {
    await updateQuizFileProgress(recordId, {
      elapsedTime,
      lastActiveAt: Date.now()
    });
    onExit();
  };

  // Stats calculation
  const totalQuestions = activeQuestionNumbers.length;
  const activeWrongCount = record?.wrongQuestions.length || 0;
  const historyWrongCount = record?.wrongAttempts ? Object.keys(record.wrongAttempts).length : 0;
  const historyQuestionsList = record?.wrongAttempts 
    ? Object.keys(record.wrongAttempts).map(Number).sort((a, b) => a - b)
    : [];

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  activeQuestionNumbers.forEach((qNum) => {
    const userAns = userAnswers[qNum];
    const grade = selfGrades[qNum];

    if (!userAns) {
      unansweredCount++;
    }
    
    if (grade === 'correct') {
      correctCount++;
    } else if (grade === 'incorrect') {
      incorrectCount++;
    }
  });

  const filteredQuestionNumbers = activeQuestionNumbers.filter((qNum) => {
    const userAns = userAnswers[qNum];
    const grade = selfGrades[qNum];
    
    if (resultFilter === 'correct') return grade === 'correct';
    if (resultFilter === 'incorrect') return grade === 'incorrect';
    if (resultFilter === 'unanswered') return !userAns;
    return true;
  });

  // Interactive Quiz Active Variables
  const activeQNum = activeQuestionNumbers[currentIdx];
  const activeQuestion = questions.find(q => q.id === activeQNum);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', minHeight: '600px' }}>
      
      {/* SETUP STEP */}
      {step === 'setup' && (
        <div className="glass-panel animate-slide-up" style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={handleExit} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
              <ArrowLeft size={16} /> Quay lại Dashboard
            </button>
            <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Cấu Hình Ôn Tập Trắc Nghiệm</h3>
          </div>

          {/* Setup Header Summary */}
          <div className="glass-panel" style={{
            padding: '20px',
            backgroundColor: 'var(--primary-light)',
            borderLeft: '4px solid var(--primary-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={18} style={{ color: 'var(--primary-color)' }} />
              <span>Tiến trình: <strong>{record?.name}</strong></span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              • Tổng số câu hỏi: <strong>{questions.length} câu</strong>
              <br />
              • Đã ôn tập đến câu: <strong>{record?.endQuestion || 0}</strong>
              <br />
              • Số câu cần sửa hiện tại: <strong style={{ color: activeWrongCount > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>{activeWrongCount} câu</strong>
              <br />
              • Số câu từng làm sai trong lịch sử: <strong>{historyWrongCount} câu</strong>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button 
                onClick={() => {
                  setHistoryModalTab('active');
                  setShowHistoryModal(true);
                }} 
                className="btn btn-outline" 
                style={{ padding: '8px 16px', fontSize: '13px', flexGrow: 1 }}
                disabled={activeWrongCount === 0 && historyWrongCount === 0}
              >
                Xem danh sách câu sai
              </button>
              <button 
                onClick={handleClearHistory} 
                className="btn btn-outline" 
                style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                title="Xóa lịch sử ôn tập file"
              >
                <Trash2 size={16} /> Xóa lịch sử đề
              </button>
            </div>
          </div>

          {/* Range input */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: '700', fontSize: '13px' }}>Bắt đầu từ câu:</label>
              <input 
                type="number" 
                min="1" 
                max={questions.length}
                value={startQuestion || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setStartQuestion(isNaN(val) ? 0 : val);
                }}
                onBlur={() => {
                  if (startQuestion < 1) setStartQuestion(1);
                  if (startQuestion > questions.length) setStartQuestion(questions.length);
                }}
                className="form-input"
                style={{ padding: '10px 14px', fontSize: '14px', fontWeight: '700' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: '700', fontSize: '13px' }}>Đến hết câu:</label>
              <input 
                type="number" 
                min={startQuestion}
                max={questions.length}
                value={endQuestion || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setEndQuestion(isNaN(val) ? 0 : val);
                }}
                onBlur={() => {
                  if (endQuestion < startQuestion) setEndQuestion(startQuestion);
                  if (endQuestion > questions.length) setEndQuestion(questions.length);
                }}
                className="form-input"
                style={{ padding: '10px 14px', fontSize: '14px', fontWeight: '700' }}
              />
            </div>
          </div>

          <button 
            onClick={handleStartQuiz}
            className="btn btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '15px' }}
          >
            Bắt đầu luyện tập <Play size={16} />
          </button>
        </div>
      )}

      {/* QUIZ STEP (Quizizz-Style Interactive Card) */}
      {step === 'quiz' && activeQuestion && (
        <div className="glass-panel animate-scale-in" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '500px' }}>
          
          {/* Top Bar Stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              <Clock size={16} />
              <span style={{ fontWeight: '700' }}>{formatTime(elapsedTime)}</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
              Câu hỏi {currentIdx + 1} / {totalQuestions}
            </span>
            <button 
              onClick={() => setShowSubmitConfirm(true)} 
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
            >
              Nộp bài & Kết thúc
            </button>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden', marginTop: '-12px' }}>
            <div style={{
              width: `${((currentIdx + 1) / totalQuestions) * 100}%`,
              height: '100%',
              backgroundColor: 'var(--primary-color)',
              transition: 'width 0.3s ease'
            }} />
          </div>

          {/* Question Text */}
          <div style={{
            padding: '24px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            minHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', lineHeight: '1.6', margin: 0 }}>
              Câu {activeQNum}: {activeQuestion.questionText}
            </h2>
          </div>

          {/* Options Grid (Quizizz Style) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            margin: '12px 0'
          }}>
            {activeQuestion.options.map((opt) => {
              const isSelected = selectedOption === opt.key;
              const isCorrectAnswer = activeQuestion.correctAnswer === opt.key;
              const hasAnswered = hasAnsweredCurrent;
              
              let btnBg = 'var(--bg-card)';
              let btnColor = 'var(--text-primary)';
              let btnBorder = '1px solid var(--border-color)';

              if (hasAnswered) {
                if (isCorrectAnswer) {
                  btnBg = 'var(--success)';
                  btnColor = 'white';
                  btnBorder = '1px solid var(--success-border)';
                } else if (isSelected) {
                  btnBg = 'var(--danger)';
                  btnColor = 'white';
                  btnBorder = '1px solid var(--danger-border)';
                } else {
                  btnBg = 'var(--bg-primary)';
                  btnColor = 'var(--text-muted)';
                  btnBorder = '1px solid var(--border-color)';
                }
              } else {
                // Hover effect styled inside button
              }

              return (
                <button
                  key={opt.key}
                  onClick={() => handleSelectOption(activeQNum, opt.key)}
                  className="quiz-option-btn"
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    border: btnBorder,
                    backgroundColor: btnBg,
                    color: btnColor,
                    fontSize: '15px',
                    fontWeight: '700',
                    textAlign: 'left',
                    cursor: hasAnswered ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.15s'
                  }}
                  disabled={hasAnswered}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isSelected || (hasAnswered && isCorrectAnswer) ? 'rgba(255, 255, 255, 0.25)' : 'var(--primary-light)',
                    color: isSelected || (hasAnswered && isCorrectAnswer) ? 'white' : 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    flexShrink: 0
                  }}>
                    {opt.key}
                  </div>
                  <span style={{ lineHeight: '1.4' }}>{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive feedback & Next button */}
          {hasAnsweredCurrent && (
            <div className="animate-fade-in" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: activeQuestion.correctAnswer === selectedOption ? 'var(--success-light)' : 'var(--danger-light)',
              border: '1px solid',
              borderColor: activeQuestion.correctAnswer === selectedOption ? 'var(--success-border)' : 'var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              marginTop: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {activeQuestion.correctAnswer === selectedOption ? (
                  <>
                    <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
                    <span style={{ fontWeight: '800', color: 'var(--success)', fontSize: '15px' }}>Chính xác! Bạn làm rất tốt.</span>
                  </>
                ) : (
                  <>
                    <XCircle size={24} style={{ color: 'var(--danger)' }} />
                    <span style={{ fontWeight: '800', color: 'var(--danger)', fontSize: '15px' }}>
                      Chưa chính xác! (Đáp án đúng: {activeQuestion.correctAnswer})
                    </span>
                  </>
                )}
              </div>

              <button 
                onClick={handleNextQuestion} 
                className="btn btn-primary"
                style={{ padding: '10px 20px', gap: '6px' }}
              >
                {currentIdx < activeQuestionNumbers.length - 1 ? 'Câu tiếp theo' : 'Xem kết quả'} 
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* RESULT STEP */}
      {step === 'result' && (
        <div className="glass-panel animate-scale-in" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header Score Overview */}
          <div style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
            <h3 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }} className="text-gradient">
              Kết Quả Ôn Luyện
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
              {practiceMode === 'wrong_only' ? 'Đợt Luyện Tập Câu Làm Sai' : `Lượt ôn tập: Câu ${startQuestion} - ${endQuestion}`}
            </p>

            <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '20px' }}>
              <div style={{ padding: '12px 24px', backgroundColor: 'var(--success-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '700' }}>ĐÚNG</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--success)' }}>{correctCount}</div>
              </div>
              <div style={{ padding: '12px 24px', backgroundColor: 'var(--danger-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '700' }}>SAI</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--danger)' }}>{incorrectCount}</div>
              </div>
              <div style={{ padding: '12px 24px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>THỜI GIAN</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{formatTime(elapsedTime)}</div>
              </div>
            </div>
          </div>

          {/* Result Filter Tabs */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-primary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            {[
              { id: 'all', label: `Tất cả (${totalQuestions})` },
              { id: 'correct', label: `Đúng (${correctCount})` },
              { id: 'incorrect', label: `Sai (${incorrectCount})` }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setResultFilter(btn.id as any)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: resultFilter === btn.id ? 'var(--bg-card)' : 'transparent',
                  color: resultFilter === btn.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Question List Review */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredQuestionNumbers.map((qNum) => {
              const userAns = userAnswers[qNum];
              const targetQ = questions.find(q => q.id === qNum);
              const correctAns = targetQ?.correctAnswer;
              const grade = selfGrades[qNum];
              const attempts = record?.wrongAttempts?.[qNum] || 0;

              let rowBg = 'var(--bg-secondary)';
              let rowBorder = 'var(--border-color)';
              if (grade === 'correct') {
                rowBg = 'var(--success-light)';
                rowBorder = 'var(--success-border)';
              } else if (grade === 'incorrect') {
                rowBg = 'var(--danger-light)';
                rowBorder = 'var(--danger-border)';
              }

              return (
                <div 
                  key={qNum}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: rowBg,
                    border: '1px solid ' + rowBorder,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: '800', fontSize: '15px' }}>
                      Câu {qNum}: {targetQ?.questionText}
                    </span>
                    {grade === 'incorrect' && (
                      <span style={{ color: 'var(--danger)', fontSize: '11px', fontWeight: '700' }}>
                        (Đã sai {attempts} lần)
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div>Lựa chọn của bạn: <strong style={{ color: grade === 'correct' ? 'var(--success)' : 'var(--danger)' }}>{userAns || 'Không trả lời'}</strong></div>
                    {correctAns && <div>Đáp án đúng: <strong style={{ color: 'var(--success)' }}>{correctAns}</strong></div>}
                  </div>

                  {/* Manual Override Buttons (Đúng/Sai) in case they want to adjust manual check */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button
                      onClick={() => handleMarkGrade(qNum, 'correct')}
                      className="btn btn-outline"
                      style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--success)', borderColor: 'var(--success-border)', backgroundColor: 'white', gap: '4px' }}
                    >
                      <CheckCircle2 size={12} /> Sửa thành Đúng
                    </button>
                    <button
                      onClick={() => handleMarkGrade(qNum, 'incorrect')}
                      className="btn btn-outline"
                      style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)', borderColor: 'var(--danger-border)', backgroundColor: 'white', gap: '4px' }}
                    >
                      <XCircle size={12} /> Sửa thành Sai
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Loop Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
            {practiceMode === 'wrong_only' && activeWrongCount === 0 && (
              <div style={{
                padding: '16px',
                backgroundColor: 'var(--success-light)',
                border: '1px solid var(--success-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--success)',
                textAlign: 'center',
                fontWeight: '800',
                fontSize: '14px'
              }}>
                🎉 Tuyệt vời! Bạn đã trả lời đúng tất cả các câu làm sai!
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={handleRestart}
                className="btn btn-secondary"
                style={{ flexGrow: 1, gap: '6px' }}
              >
                <RotateCcw size={16} /> Làm lại lượt này
              </button>

              {practiceMode === 'wrong_only' && activeWrongCount > 0 ? (
                <button 
                  onClick={handleStartWrongOnlyPractice} 
                  className="btn btn-primary"
                  style={{ flexGrow: 2, backgroundColor: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                >
                  Luyện tiếp câu còn sai ({activeWrongCount} câu)
                </button>
              ) : (
                <button 
                  onClick={handleResetToSetup} 
                  className="btn btn-primary"
                  style={{ flexGrow: 1 }}
                >
                  Trở lại thiết lập
                </button>
              )}

              <button 
                onClick={handleExit} 
                className="btn btn-outline"
                style={{ gap: '6px' }}
              >
                <Home size={16} /> Bảng điều khiển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal (Wrong Questions Dual-Tab) */}
      {showHistoryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass-panel animate-scale-in" style={{
            padding: '24px 32px 32px',
            maxWidth: '600px',
            width: '95%',
            backgroundColor: 'var(--bg-card)',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Modal Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} style={{ color: 'var(--danger)' }} />
                <span>Danh Sách Câu Hỏi Làm Sai</span>
              </h3>
              <button 
                onClick={() => setShowHistoryModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px', fontWeight: '600' }}
              >
                ×
              </button>
            </div>

            {/* Modal Tabs Selector */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-primary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
              <button
                onClick={() => setHistoryModalTab('active')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: historyModalTab === 'active' ? 'var(--bg-card)' : 'transparent',
                  color: historyModalTab === 'active' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cần ôn luyện ({activeWrongCount})
              </button>
              <button
                onClick={() => setHistoryModalTab('all_history')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: historyModalTab === 'all_history' ? 'var(--bg-card)' : 'transparent',
                  color: historyModalTab === 'all_history' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Tất cả câu từng sai ({historyWrongCount})
              </button>
            </div>

            {/* Tab 1: Active wrong questions list */}
            {historyModalTab === 'active' && (
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Đây là những câu hỏi hiện tại bạn đang làm sai (chưa sửa lại đúng):
                </p>
                <div style={{
                  flexGrow: 1,
                  overflowY: 'auto',
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {activeWrongCount === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>
                      Không có câu hỏi nào cần sửa!
                    </div>
                  ) : (
                    record?.wrongQuestions.map((qNum) => {
                      const attempts = record.wrongAttempts?.[qNum] || 1;
                      const targetQ = questions.find(q => q.id === qNum);
                      return (
                        <div 
                          key={qNum}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            backgroundColor: 'var(--danger-light)',
                            border: '1px solid var(--danger-border)',
                            borderRadius: 'var(--radius-md)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '70%' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--danger)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Câu {qNum}: {targetQ?.questionText}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Số lần làm sai: <strong>{attempts} lần</strong>
                            </span>
                          </div>

                          <button
                            onClick={() => handleMasterQuestion(qNum)}
                            className="btn btn-outline"
                            style={{ 
                              padding: '5px 10px', 
                              fontSize: '11px', 
                              color: 'var(--success)', 
                              borderColor: 'var(--success-border)',
                              backgroundColor: 'white',
                              gap: '4px'
                            }}
                          >
                            <Check size={12} /> Đã thuộc
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: All wrong questions history list with frequency */}
            {historyModalTab === 'all_history' && (
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Danh sách toàn bộ các câu bạn **từng làm sai** trong quá khứ và số lần nhầm lẫn:
                </p>
                <div style={{
                  flexGrow: 1,
                  overflowY: 'auto',
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {historyQuestionsList.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: '13px' }}>
                      Chưa từng làm sai câu hỏi nào!
                    </div>
                  ) : (
                    historyQuestionsList.map((qNum) => {
                      const attempts = record?.wrongAttempts?.[qNum] || 0;
                      const isActive = record?.wrongQuestions.includes(qNum);
                      const targetQ = questions.find(q => q.id === qNum);
                      
                      return (
                        <div 
                          key={qNum}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            backgroundColor: isActive ? 'var(--danger-light)' : 'var(--success-light)',
                            border: '1px solid',
                            borderColor: isActive ? 'var(--danger-border)' : 'var(--success-border)',
                            borderRadius: 'var(--radius-md)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '70%' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: isActive ? 'var(--danger)' : 'var(--success)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Câu {qNum}: {targetQ?.questionText} 
                              <span className={`badge ${isActive ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '9px', padding: '2px 6px', marginLeft: '6px' }}>
                                {isActive ? 'Chưa sửa' : 'Đã sửa'}
                              </span>
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Số lần làm sai trong lịch sử: <strong style={{ color: 'var(--danger)' }}>{attempts} lần</strong>
                            </span>
                          </div>

                          <button
                            onClick={() => handleMasterQuestion(qNum)}
                            className="btn btn-outline"
                            style={{ 
                              padding: '5px 10px', 
                              fontSize: '11px', 
                              color: 'var(--primary-color)', 
                              borderColor: 'var(--border-color)',
                              backgroundColor: 'white',
                              gap: '4px'
                            }}
                          >
                            <Check size={12} /> Đã thuộc
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px', flexWrap: 'wrap' }}>
              <button 
                onClick={handleClearHistory}
                className="btn btn-outline"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
              >
                Xóa tất cả lịch sử đề
              </button>
              
              {historyModalTab === 'active' ? (
                <button 
                  onClick={handleStartWrongOnlyPractice} 
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                  disabled={activeWrongCount === 0}
                >
                  Luyện tập câu chưa sửa ({activeWrongCount})
                </button>
              ) : (
                <button 
                  onClick={handleStartAllHistoryWrongPractice} 
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                  disabled={historyWrongCount === 0}
                >
                  Luyện lại tất cả câu từng sai ({historyWrongCount})
                </button>
              )}

              <button 
                onClick={() => setShowHistoryModal(false)} 
                className="btn btn-secondary"
                style={{ padding: '10px 24px' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className="glass-panel animate-scale-in" style={{ padding: '32px', maxWidth: '400px', width: '90%', textAlign: 'center', backgroundColor: 'var(--bg-card)' }}>
            <AlertTriangle size={48} style={{ color: 'var(--warning)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Nộp Bài Luyện Tập?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              Bạn đang làm dở lượt luyện tập. Bạn có chắc chắn muốn nộp bài và xem kết quả ngay?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setShowSubmitConfirm(false)} className="btn btn-secondary" style={{ flexGrow: 1 }}>
                Hủy
              </button>
              <button onClick={handleSubmitQuiz} className="btn btn-primary" style={{ flexGrow: 1 }}>
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled Option Button Hover Effects */}
      <style>{`
        .quiz-option-btn:hover:not(:disabled) {
          border-color: var(--primary-color) !important;
          background-color: var(--primary-light) !important;
          transform: translateY(-2px);
          box-shadow: var(--shadow-md) !important;
        }
      `}</style>
    </div>
  );
};
