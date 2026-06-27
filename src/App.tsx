import { useState, useEffect } from 'react';
import { Sun, Moon, GraduationCap } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { PreviewParser } from './components/PreviewParser';
import { QuizPanel } from './components/QuizPanel';
import { QuizResult } from './components/QuizResult';
import { SplitQuizPanel } from './components/SplitQuizPanel';
import { Dashboard } from './components/Dashboard';
import type { Question, ParseResult } from './utils/pdfParser';
import { getAllQuizFiles, deleteQuizFile, saveQuizFile } from './utils/db';
import type { QuizFileRecord } from './utils/db';

type AppStep = 'dashboard' | 'upload' | 'preview' | 'quiz' | 'result' | 'split_quiz';

function App() {
  const [step, setStep] = useState<AppStep>('dashboard');
  const [dbFiles, setDbFiles] = useState<QuizFileRecord[]>([]);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  
  // Text-based Quiz states
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [timeSpent, setTimeSpent] = useState(0);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load files from IndexedDB on mount & step change
  const loadDBFiles = async () => {
    try {
      const files = await getAllQuizFiles();
      setDbFiles(files);
    } catch (e) {
      console.error('Error loading DB files:', e);
    }
  };

  useEffect(() => {
    loadDBFiles();
  }, [step]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Click on a file in Dashboard: load and practice it
  const handleSelectFile = (record: QuizFileRecord) => {
    setActiveRecordId(record.id);
    setStep('split_quiz');
  };

  // Delete a file from Dashboard
  const handleDeleteFile = async (id: string) => {
    try {
      await deleteQuizFile(id);
      localStorage.removeItem(`eduquiz_history_${id}`); // Clear legacy localStorage history if any
      loadDBFiles();
    } catch (e) {
      console.error('Error deleting file:', e);
    }
  };

  // File parsing successful
  const handleParseSuccess = async (result: ParseResult, file: File | null) => {
    setParseResult(result);
    setQuestions(result.questions);
    setFileObject(file);

    if (file) {
      // Save PDF and initial record state to IndexedDB
      const record: QuizFileRecord = {
        id: file.name,
        name: file.name,
        fileBlob: file,
        startQuestion: 1,
        endQuestion: 0,
        userAnswers: {},
        selfGrades: {},
        wrongQuestions: [],
        wrongAttempts: {},
        elapsedTime: 0,
        addedAt: Date.now(),
        lastActiveAt: Date.now()
      };
      await saveQuizFile(record);
      setActiveRecordId(file.name);
      loadDBFiles();
    }

    setStep('preview');
  };

  const handleConfirmQuestions = (confirmedQuestions: Question[]) => {
    setQuestions(confirmedQuestions);
    setStep('quiz');
  };

  const handleQuizSubmit = (answers: Record<number, string>, elapsed: number) => {
    setUserAnswers(answers);
    setTimeSpent(elapsed);
    setStep('result');
  };

  const handleRestart = () => {
    setUserAnswers({});
    setTimeSpent(0);
    setStep('quiz');
  };

  const handleUploadNew = () => {
    setParseResult(null);
    setQuestions([]);
    setUserAnswers({});
    setTimeSpent(0);
    setFileObject(null);
    setActiveRecordId(null);
    loadDBFiles();
    setStep('dashboard');
  };

  return (
    <>
      {/* Premium Sticky Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo-section" style={{ cursor: 'pointer' }} onClick={handleUploadNew}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
            }}>
              <GraduationCap size={24} />
            </div>
            <div>
              <span className="text-gradient">EduQuiz</span>
              <span style={{ fontSize: '12px', fontWeight: '500', display: 'block', color: 'var(--text-secondary)', marginTop: '-4px' }}>
                Ôn thi trắc nghiệm PDF
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme} 
              className="theme-toggle"
              aria-label="Toggle theme"
              title={theme === 'light' ? 'Chuyển sang chế độ Tối' : 'Chuyển sang chế độ Sáng'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer"
              className="theme-toggle"
              title="GitHub Repository"
            >
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 16 16" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path>
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container">
        {step === 'dashboard' && (
          <Dashboard 
            files={dbFiles} 
            onSelectFile={handleSelectFile} 
            onDeleteFile={handleDeleteFile} 
            onAddNewFile={() => setStep('upload')} 
          />
        )}

        {step === 'upload' && (
          <FileUpload 
            onParseSuccess={handleParseSuccess} 
            onBackToDashboard={dbFiles.length > 0 ? () => setStep('dashboard') : undefined} 
          />
        )}
        
        {step === 'preview' && parseResult && (
          <PreviewParser 
            parseResult={parseResult} 
            onConfirm={handleConfirmQuestions}
            onBack={handleUploadNew}
            onStartSplitView={() => setStep('split_quiz')}
            hasFile={!!fileObject}
          />
        )}
        
        {step === 'quiz' && (
          <QuizPanel 
            questions={questions}
            onSubmit={handleQuizSubmit}
            onExit={handleUploadNew}
          />
        )}
        
        {step === 'result' && (
          <QuizResult 
            questions={questions}
            userAnswers={userAnswers}
            timeSpent={timeSpent}
            onRestart={handleRestart}
            onUploadNew={handleUploadNew}
          />
        )}

        {step === 'split_quiz' && activeRecordId && (
          <SplitQuizPanel 
            recordId={activeRecordId}
            onExit={handleUploadNew}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{ 
        borderTop: '1px solid var(--border-color)', 
        padding: '24px', 
        textAlign: 'center', 
        fontSize: '13px', 
        color: 'var(--text-muted)',
        marginTop: 'auto'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <span>© {new Date().getFullYear()} EduQuiz. Trình luyện thi trắc nghiệm trích xuất từ file PDF.</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Bảo mật 100% dữ liệu (Lưu trữ cục bộ bằng cơ sở dữ liệu IndexedDB trình duyệt)</span>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
