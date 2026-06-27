export interface QuizFileRecord {
  id: string;              // File name (e.g. "kiemthu1.pdf")
  name: string;            // Display name
  fileBlob: Blob;          // The PDF file blob itself
  startQuestion: number;   // Question range start
  endQuestion: number;     // Question range end
  userAnswers: Record<number, string>; // Selected answers (accumulated)
  selfGrades: Record<number, 'correct' | 'incorrect'>; // Hand-marked grades (accumulated)
  wrongQuestions: number[]; // Sorted list of active wrong question IDs
  wrongAttempts: Record<number, number>; // Question -> cumulative count of wrong attempts (retained)
  elapsedTime: number;     // Cumulative practice time in seconds
  activeStartQuestion?: number; // Start of current active test (unsubmitted)
  activeEndQuestion?: number;   // End of current active test (unsubmitted)
  addedAt: number;
  lastActiveAt: number;
}

const DB_NAME = 'EduQuizDatabase';
const DB_VERSION = 1;
const STORE_NAME = 'quiz_files';

/**
 * Initialize IndexedDB Database
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

/**
 * Save or Update a Quiz File Record
 */
export async function saveQuizFile(record: QuizFileRecord): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

/**
 * Get a specific Quiz File Record by ID
 */
export async function getQuizFile(id: string): Promise<QuizFileRecord | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = (event: any) => {
      resolve(event.target.result || null);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

/**
 * Get all Quiz File Records (for Dashboard display)
 */
export async function getAllQuizFiles(): Promise<QuizFileRecord[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event: any) => {
      const results = event.target.result as QuizFileRecord[];
      // Sort by last active time desc
      results.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
      resolve(results);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

/**
 * Delete a Quiz File Record
 */
export async function deleteQuizFile(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

/**
 * Update only progress details of a Quiz File Record
 */
export async function updateQuizFileProgress(
  id: string,
  progress: Partial<Omit<QuizFileRecord, 'id' | 'name' | 'fileBlob' | 'addedAt'>>
): Promise<void> {
  const record = await getQuizFile(id);
  if (!record) {
    throw new Error(`Record with ID ${id} not found.`);
  }

  const updatedRecord: QuizFileRecord = {
    ...record,
    ...progress,
    lastActiveAt: Date.now()
  } as QuizFileRecord;

  await saveQuizFile(updatedRecord);
}
