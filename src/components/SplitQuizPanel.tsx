import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Send, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Key, 
  Play, 
  ArrowLeft, 
  BookOpen, 
  Trash2,
  Check,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { parseManualAnswers } from '../utils/pdfParser';
import { getQuizFile, updateQuizFileProgress, saveQuizFile } from '../utils/db';
import type { QuizFileRecord } from '../utils/db';

interface SplitQuizPanelProps {
  recordId: string;
  onExit: () => void;
}

export const SplitQuizPanel: React.FC<SplitQuizPanelProps> = ({ recordId, onExit }) => {
  const [record, setRecord] = useState<QuizFileRecord | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [step, setStep] = useState<'setup' | 'quiz' | 'result'>('setup');
  
  // Practice Mode State
  const [practiceMode, setPracticeMode] = useState<'range' | 'wrong_only'>('range');
  const [activeQuestionNumbers, setActiveQuestionNumbers] = useState<number[]>([]);

  // Setup States
  const [startQuestion, setStartQuestion] = useState<number>(1);
  const [endQuestion, setEndQuestion] = useState<number>(40);
  const [correctAnswersInput, setCorrectAnswersInput] = useState<string>('');
  
  // Quiz States
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, string>>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const timerRef = useRef<any | null>(null);

  // Manual Self-Grading States
  const [selfGrades, setSelfGrades] = useState<Record<number, 'correct' | 'incorrect'>>({});
  const [resultFilter, setResultFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
  
  // History Modal States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyModalTab, setHistoryModalTab] = useState<'active' | 'all_history'>('active');

  // Load record from IndexedDB on mount
  useEffect(() => {
    async function loadRecord() {
      const rec = await getQuizFile(recordId);
      if (rec) {
        setRecord(rec);
        
        // Reconstruct W3C File object from Blob
        const file = new File([rec.fileBlob], rec.name, { type: rec.fileBlob.type });
        
        // Generate native PDF URL
        const url = URL.createObjectURL(file);
        setPdfUrl(url);

        // Load saved states
        setUserAnswers(rec.userAnswers || {});
        setSelfGrades(rec.selfGrades || {});
        setElapsedTime(rec.elapsedTime || 0);

        // Load active range if it was in progress, otherwise suggest next range
        if (rec.activeStartQuestion && rec.activeEndQuestion) {
          setStartQuestion(rec.activeStartQuestion);
          setEndQuestion(rec.activeEndQuestion);
        } else if (rec.endQuestion && rec.endQuestion > 0) {
          const nextStart = rec.endQuestion + 1;
          setStartQuestion(nextStart);
          setEndQuestion(nextStart + 39);
        } else {
          setStartQuestion(1);
          setEndQuestion(40);
        }
      }
    }
    loadRecord();

    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [recordId]);

  // Cleanup PDF URL on change
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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

  // Parse answer key string
  const handleApplyCorrectAnswers = (inputStr: string) => {
    const parsedMap = parseManualAnswers(inputStr);
    const updatedCorrectAnswers: Record<number, string> = {};
    parsedMap.forEach((val, key) => {
      if (key >= startQuestion && key <= endQuestion) {
        updatedCorrectAnswers[key] = val;
      }
    });
    setCorrectAnswers(updatedCorrectAnswers);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Start standard range quiz
  const handleStartQuiz = async () => {
    if (startQuestion > endQuestion) {
      alert('Câu bắt đầu không thể lớn hơn câu kết thúc!');
      return;
    }
    handleApplyCorrectAnswers(correctAnswersInput);
    setPracticeMode('range');
    
    const rangeNums = Array.from({ length: endQuestion - startQuestion + 1 }, (_, i) => startQuestion + i);
    setActiveQuestionNumbers(rangeNums);
    setStep('quiz');
    setResultFilter('all');
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

  // Resume active quiz session
  const handleResumeQuiz = () => {
    if (!record) return;
    const activeStart = record.activeStartQuestion || 0;
    const activeEnd = record.activeEndQuestion || 0;
    if (activeStart === 0 || activeEnd === 0) return;

    setPracticeMode('range');
    setStartQuestion(activeStart);
    setEndQuestion(activeEnd);

    const rangeNums = Array.from(
      { length: activeEnd - activeStart + 1 },
      (_, i) => activeStart + i
    );
    setActiveQuestionNumbers(rangeNums);
    setStep('quiz');
    setResultFilter('all');
  };

  // Start wrong questions practice loop
  const handleStartWrongOnlyPractice = async () => {
    const wrongList = record?.wrongQuestions || [];
    if (wrongList.length === 0) return;

    setPracticeMode('wrong_only');
    setActiveQuestionNumbers(wrongList);
    setStep('quiz');
    setResultFilter('all');
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
    setResultFilter('all');
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

  // Select an option: auto-save immediately to database
  const handleSelectOption = async (qNum: number, option: string) => {
    const updatedAnswers = { ...userAnswers, [qNum]: option };
    setUserAnswers(updatedAnswers);
    
    await updateQuizFileProgress(recordId, {
      userAnswers: updatedAnswers,
      lastActiveAt: Date.now()
    });

    if (record) {
      setRecord({
        ...record,
        userAnswers: updatedAnswers,
        lastActiveAt: Date.now()
      });
    }
  };

  // Submit and grade answers
  const handleSubmitQuiz = async () => {
    setShowSubmitConfirm(false);
    
    const updatedGrades = { ...selfGrades };
    const newWrongQuestions = new Set<number>(record?.wrongQuestions || []);
    const updatedAttempts = { ...(record?.wrongAttempts || {}) };

    activeQuestionNumbers.forEach((qNum) => {
      const userAns = userAnswers[qNum];
      const correctAns = correctAnswers[qNum];

      if (correctAns) {
        if (userAns === correctAns) {
          updatedGrades[qNum] = 'correct';
          newWrongQuestions.delete(qNum);
        } else {
          updatedGrades[qNum] = 'incorrect';
          newWrongQuestions.add(qNum);
          updatedAttempts[qNum] = (updatedAttempts[qNum] || 0) + 1;
        }
      } else {
        if (!updatedGrades[qNum]) {
          updatedGrades[qNum] = 'incorrect'; // Default to incorrect until checked
        }
      }
    });

    const wrongList = Array.from(newWrongQuestions).sort((a, b) => a - b);
    setSelfGrades(updatedGrades);
    setStep('result');

    // Calculate new completed range only if we were doing a standard range practice
    const newEnd = practiceMode === 'range' ? Math.max(record?.endQuestion || 0, endQuestion) : (record?.endQuestion || 0);
    const newStart = practiceMode === 'range' ? Math.min(record?.startQuestion || 1, startQuestion) : (record?.startQuestion || 1);

    // Save progress to IndexedDB
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
      // Retain cumulative attempts, just resolve it from current active wrongQuestions
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

  // Mark a question as Mastered: reset wrong count to 0, mark as correct
  const handleMasterQuestion = async (qNum: number) => {
    if (!record) return;

    const newWrongs = (record.wrongQuestions || []).filter(x => x !== qNum);
    const updatedAttempts = { ...(record.wrongAttempts || {}) };
    delete updatedAttempts[qNum]; // Remove attempt counter completely

    const updatedGrades = { ...(record.selfGrades || {}), [qNum]: 'correct' as const };
    const updatedAnswers = { ...(record.userAnswers || {}), [qNum]: userAnswers[qNum] || 'A' }; // ensure it has a placeholder answer so it's not marked unanswered

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

  // Restart current round: wipes only this round's answers
  const handleRestart = () => {
    setStep('quiz');
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

    // Save reset to IndexedDB
    updateQuizFileProgress(recordId, {
      userAnswers: updatedAnswers,
      selfGrades: updatedGrades,
      wrongQuestions: Array.from(newWrongQuestions).sort((a, b) => a - b),
      elapsedTime: 0,
      lastActiveAt: Date.now()
    });
  };

  // Clear entire history and reset all progress
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
        setEndQuestion(40);
        setPracticeMode('range');
        setActiveQuestionNumbers([]);
        setShowHistoryModal(false);
        localStorage.removeItem(`eduquiz_history_${recordId}`);
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
  const answeredCount = () => {
    let count = 0;
    activeQuestionNumbers.forEach((qNum) => {
      if (userAnswers[qNum]) count++;
    });
    return count;
  };

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

  // Filtered list of questions for results screen
  const filteredQuestionNumbers = activeQuestionNumbers.filter((qNum) => {
    const userAns = userAnswers[qNum];
    const grade = selfGrades[qNum];
    
    if (resultFilter === 'correct') return grade === 'correct';
    if (resultFilter === 'incorrect') return grade === 'incorrect';
    if (resultFilter === 'unanswered') return !userAns;
    return true;
  });

  const activeWrongCount = record?.wrongQuestions.length || 0;
  const historyWrongCount = record?.wrongAttempts ? Object.keys(record.wrongAttempts).length : 0;
  const historyQuestionsList = record?.wrongAttempts 
    ? Object.keys(record.wrongAttempts).map(Number).sort((a, b) => a - b)
    : [];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 420px',
      gap: '24px',
      height: 'calc(100vh - 120px)',
      width: '100%',
      minHeight: '500px'
    }}>
      {/* Left Panel: Native PDF Viewer */}
      <div className="glass-panel" style={{
        height: '100%',
        overflow: 'hidden',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
          <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
            Tài liệu: {record?.name || ''}
          </span>
          <span className="badge badge-primary" style={{ fontSize: '11px' }}>
            {practiceMode === 'wrong_only' ? 'Luyện câu sai' : 'PDF Ảnh Quét'}
          </span>
        </div>
        <div style={{ flexGrow: 1, position: 'relative', width: '100%', height: '100%' }}>
          {pdfUrl ? (
            <iframe 
              src={`${pdfUrl}#toolbar=1`} 
              width="100%" 
              height="100%" 
              style={{ border: 'none', borderRadius: 'var(--radius-md)', backgroundColor: '#323639' }} 
              title="PDF Viewer"
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              Đang tải PDF...
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Setup, Quiz or Result Panel */}
      <div className="glass-panel" style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        
        {/* SETUP STEP */}
        {step === 'setup' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <button onClick={handleExit} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
                <ArrowLeft size={16} /> Quay lại
              </button>
              <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Cấu Hình Ôn Tập Theo Lượt</h3>
            </div>

            {/* File History Summary Card */}
            <div className="glass-panel" style={{
              padding: '16px',
              backgroundColor: 'var(--primary-light)',
              borderLeft: '4px solid var(--primary-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={16} style={{ color: 'var(--primary-color)' }} />
                <span>Tiến trình ôn tập của file này:</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                • Đã ôn tập đến câu: <strong>{record?.endQuestion || 0}</strong>
                <br />
                • Số câu cần sửa hiện tại: <strong style={{ color: activeWrongCount > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>{activeWrongCount} câu</strong>
                <br />
                • Số câu từng làm sai trong lịch sử: <strong>{historyWrongCount} câu</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button 
                  onClick={() => {
                    setHistoryModalTab('active');
                    setShowHistoryModal(true);
                  }} 
                  className="btn btn-outline" 
                  style={{ padding: '6px 10px', fontSize: '11px', flexGrow: 1 }}
                  disabled={!record || (activeWrongCount === 0 && historyWrongCount === 0)}
                >
                  Xem danh sách câu sai
                </button>
                <button 
                  onClick={handleClearHistory} 
                  className="btn btn-outline" 
                  style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                  title="Xóa lịch sử ôn tập file"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {record && record.activeStartQuestion !== undefined && record.activeEndQuestion !== undefined && record.activeStartQuestion > 0 && record.activeEndQuestion > 0 && (
              <div className="glass-panel animate-scale-in" style={{
                padding: '16px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '1px dashed var(--primary-color)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} /> Lượt làm bài chưa nộp
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  Bạn có lượt làm bài dở từ câu <strong>{record.activeStartQuestion}</strong> đến câu <strong>{record.activeEndQuestion}</strong> chưa nộp.
                </p>
                <button 
                  onClick={handleResumeQuiz}
                  className="btn btn-primary"
                  style={{ padding: '8px 12px', fontSize: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  Tiếp tục làm bài dở <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Question Range Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Bắt đầu từ câu:</label>
                <input 
                  type="number" 
                  min="1" 
                  value={startQuestion || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setStartQuestion(isNaN(val) ? 0 : val);
                  }}
                  onBlur={() => {
                    if (startQuestion < 1) {
                      setStartQuestion(1);
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontWeight: '700',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Đến hết câu:</label>
                <input 
                  type="number" 
                  min={startQuestion}
                  value={endQuestion || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setEndQuestion(isNaN(val) ? 0 : val);
                  }}
                  onBlur={() => {
                    if (endQuestion < startQuestion) {
                      setEndQuestion(startQuestion);
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontWeight: '700',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '-8px' }}>
              * Số lượng câu trong lượt này: <strong>{endQuestion - startQuestion + 1} câu</strong>.
            </div>

            {/* Answer key string */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} /> Đáp án đúng của đề (Tùy chọn):
              </label>
              <textarea 
                placeholder="Ví dụ: 1A 2B 3C 4.D 5-C..."
                value={correctAnswersInput}
                onChange={(e) => setCorrectAnswersInput(e.target.value)}
                rows={3}
                style={{
                  padding: '10px 14px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-sans)',
                  resize: 'vertical'
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                * Nếu không có đáp án đúng nhập sẵn, bạn vẫn làm bài bình thường và tự check Đúng/Sai sau khi nộp bài.
              </span>
            </div>

            <button 
              onClick={handleStartQuiz}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', marginTop: 'auto' }}
            >
              Bắt đầu làm bài <Play size={16} />
            </button>
          </div>
        )}

        {/* QUIZ STEP */}
        {step === 'quiz' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            
            {/* Header info */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={16} style={{ color: 'var(--primary-color)' }} />
                <span style={{ fontWeight: '800', fontSize: '16px' }}>{formatTime(elapsedTime)}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                {practiceMode === 'wrong_only' 
                  ? `Luyện câu sai | Lượt làm: ${answeredCount()} / ${totalQuestions} câu`
                  : `Khoảng: ${startQuestion} - ${endQuestion} | Đã chọn: ${answeredCount()} / ${totalQuestions} câu`
                }
              </div>
            </div>

            {/* Answer sheet list */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeQuestionNumbers.map((qNum) => {
                const selectedOpt = userAnswers[qNum];
                
                return (
                  <div 
                    key={qNum}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: selectedOpt ? 'var(--primary-light)' : 'var(--bg-secondary)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontWeight: '700', fontSize: '14px', width: '60px' }}>
                      Câu {qNum}:
                    </span>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {['A', 'B', 'C', 'D'].map((opt) => {
                        const isSelected = selectedOpt === opt;
                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelectOption(qNum, opt)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--primary-color)' : 'var(--border-color)',
                              backgroundColor: isSelected ? 'var(--primary-color)' : 'var(--bg-card)',
                              color: isSelected ? 'white' : 'var(--text-primary)',
                              fontWeight: '800',
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s'
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '12px'
            }}>
              <button 
                onClick={handleResetToSetup} 
                className="btn btn-secondary"
                style={{ flexGrow: 1 }}
              >
                Quay lại
              </button>
              <button 
                onClick={() => setShowSubmitConfirm(true)} 
                className="btn btn-primary"
                style={{ flexGrow: 2 }}
              >
                <Send size={16} /> Nộp bài
              </button>
            </div>
          </div>
        )}

        {/* RESULT STEP */}
        {step === 'result' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            
            {/* Header / Score Overview */}
            <div style={{
              padding: '20px 20px 16px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800' }}>
                {practiceMode === 'wrong_only'
                  ? `Kết quả Luyện Câu Sai`
                  : `Kết quả Lượt: Câu ${startQuestion} - ${endQuestion}`
                }
              </h3>

              <div style={{ display: 'flex', gap: '20px', fontSize: '13px', width: '100%', justifyContent: 'center' }}>
                <div style={{ color: 'var(--success)', fontWeight: '700' }}>Đúng: {correctCount}</div>
                <div style={{ color: 'var(--danger)', fontWeight: '700' }}>Sai: {incorrectCount}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Chưa làm: {unansweredCount}</div>
                <div style={{ color: 'var(--text-muted)' }}>Thời gian: {formatTime(elapsedTime)}</div>
              </div>

              {/* Result filter tabs */}
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-primary)', padding: '3px', borderRadius: 'var(--radius-sm)', width: '100%', marginTop: '6px' }}>
                {[
                  { id: 'all', label: `Tất cả (${totalQuestions})` },
                  { id: 'correct', label: `Đúng (${correctCount})` },
                  { id: 'incorrect', label: `Sai (${incorrectCount})` }
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setResultFilter(btn.id as any)}
                    className="btn"
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: '11px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: resultFilter === btn.id ? 'var(--bg-card)' : 'transparent',
                      color: resultFilter === btn.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                      border: 'none',
                      fontWeight: '600'
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scored Sheet List with Manual Correct/Incorrect grading check buttons */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredQuestionNumbers.map((qNum) => {
                const userAns = userAnswers[qNum];
                const grade = selfGrades[qNum];
                const attempts = record?.wrongAttempts?.[qNum] || 0;
                
                let rowBg = 'var(--bg-secondary)';
                if (grade === 'correct') {
                  rowBg = 'var(--success-light)';
                } else if (grade === 'incorrect') {
                  rowBg = 'var(--danger-light)';
                }

                return (
                  <div 
                    key={qNum}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: rowBg,
                      border: '1px solid',
                      borderColor: grade === 'correct' ? 'var(--success-border)' : grade === 'incorrect' ? 'var(--danger-border)' : 'var(--border-color)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px' }}>
                        Câu {qNum} {attempts > 0 && <span style={{ color: 'var(--danger)', fontSize: '11px', fontWeight: 'normal' }}>(đã sai {attempts} lần)</span>}:
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Bạn chọn: <strong style={{ color: 'var(--text-primary)' }}>{userAns || 'Chưa chọn'}</strong>
                        {correctAnswers[qNum] && (
                          <span style={{ marginLeft: '8px' }}>
                            (Đáp án: <strong>{correctAnswers[qNum]}</strong>)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Manual Check Buttons (Đúng / Sai) */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleMarkGrade(qNum, 'correct')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: grade === 'correct' ? 'var(--success)' : 'var(--bg-card)',
                          color: grade === 'correct' ? 'white' : 'var(--success)',
                          border: '1px solid var(--success-border)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <CheckCircle2 size={12} /> Đúng
                      </button>
                      <button
                        onClick={() => handleMarkGrade(qNum, 'incorrect')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: grade === 'incorrect' ? 'var(--danger)' : 'var(--bg-card)',
                          color: grade === 'incorrect' ? 'white' : 'var(--danger)',
                          border: '1px solid var(--danger-border)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <XCircle size={12} /> Sai
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions for Loop Practice */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              
              {/* Loop Practice wrong questions status / warning */}
              {practiceMode === 'wrong_only' && activeWrongCount === 0 && (
                <div style={{
                  padding: '12px',
                  backgroundColor: 'var(--success-light)',
                  border: '1px solid var(--success-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--success)',
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: '13px'
                }}>
                  🎉 Tuyệt vời! Bạn đã hoàn thành và trả lời đúng tất cả các câu làm sai!
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={handleRestart} 
                  className="btn btn-secondary"
                  style={{ flexGrow: 1 }}
                >
                  Làm lại lượt này
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
                    Qua lượt mới
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* History Modal (Displays wrong questions history with 2 tabs) */}
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--danger)' }}>
                              Câu {qNum}
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
                            title="Lưu kết quả đúng vĩnh viễn và đặt lại số lần sai về 0"
                          >
                            <Check size={12} /> Đã thuộc hoàn toàn
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: isActive ? 'var(--danger)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              Câu {qNum} 
                              <span className={`badge ${isActive ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
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
                            title="Xóa lịch sử làm sai của câu này"
                          >
                            <Check size={12} /> Đã thuộc hoàn toàn
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
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Nộp Bài Split View?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              Bạn đã chọn đáp án cho {answeredCount()} / {totalQuestions} câu hỏi. Bạn có chắc chắn muốn nộp bài và tự chấm điểm?
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
    </div>
  );
};
