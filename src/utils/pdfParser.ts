import * as pdfjs from 'pdfjs-dist';

// We import the worker from node_modules using Vite's ?url syntax
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface Option {
  key: string;
  text: string;
}

export interface Question {
  id: number;
  questionText: string;
  options: Option[];
  correctAnswer: string; // 'A', 'B', 'C', 'D'
  explanation?: string;
}

export interface ParseResult {
  questions: Question[];
  rawText: string;
  totalParsed: number;
  totalWithAnswers: number;
}

/**
 * Extract plain text from PDF File
 */
export async function extractTextFromPDF(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    let lastY: number | null = null;
    let pageText = '';

    for (const item of textContent.items) {
      if ('str' in item) {
        const currentY = item.transform[5];
        // If Y changes significantly, it's a new line
        if (lastY !== null && Math.abs(currentY - lastY) > 4) {
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = currentY;
      }
    }
    
    fullText += pageText + '\n\n';
    if (onProgress) {
      onProgress(Math.round((i / numPages) * 100));
    }
  }

  return fullText;
}

/**
 * Smart parse questions and answers from text content
 */
export function parseQuizText(rawText: string): ParseResult {
  const questions: Question[] = [];
  
  // 1. Try to find the Answer section at the end of the text
  // Vietnamese keywords: ĐÁP ÁN, BẢNG ĐÁP ÁN, HƯỚNG DẪN GIẢI, LỜI GIẢI, KEY, ĐÁP ÁN CHI TIẾT
  const answerKeywords = [
    /BẢNG ĐÁP ÁN/i,
    /ĐÁP ÁN/i,
    /HƯỚNG DẪN GIẢI/i,
    /LỜI GIẢI CHI TIẾT/i,
    /ĐÁP ÁN CHI TIẾT/i,
    /\bKEY\b/i,
    /\bANSWERS\b/i
  ];

  let answersSection = '';
  let questionsSection = rawText;
  let splitIndex = -1;

  for (const regex of answerKeywords) {
    const match = regex.exec(rawText);
    if (match) {
      // Find the last occurrence of the keyword to be safe
      const index = rawText.lastIndexOf(match[0]);
      if (index > splitIndex && index > rawText.length * 0.4) {
        splitIndex = index;
      }
    }
  }

  if (splitIndex !== -1) {
    questionsSection = rawText.substring(0, splitIndex);
    answersSection = rawText.substring(splitIndex);
  }

  // 2. Parse the Answer Key
  // We look for patterns like "1. A", "1-A", "Câu 1: A", "1A", "Câu 1. Chọn A"
  const answersMap = new Map<number, string>();
  
  // Regex 1: 1. A or 1 - A or 1: A or Câu 1: A
  // We capture group 1 as question number, group 2 as answer letter
  const answerRegex1 = /(?:Câu|Question\s*)?(\d+)\s*[:.\-\s]\s*([A-D])\b/gi;
  let match;
  while ((match = answerRegex1.exec(answersSection || rawText)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ans = match[2].toUpperCase();
    if (!answersMap.has(qNum)) {
      answersMap.set(qNum, ans);
    }
  }

  // Regex 2 (fallback for dense tables like 1A 2B 3C or 1.A 2.B)
  if (answersMap.size === 0) {
    const answerRegex2 = /\b(\d+)[\.\s]*([A-D])\b/gi;
    while ((match = answerRegex2.exec(answersSection || rawText)) !== null) {
      const qNum = parseInt(match[1], 10);
      const ans = match[2].toUpperCase();
      if (!answersMap.has(qNum)) {
        answersMap.set(qNum, ans);
      }
    }
  }

  // Regex 3 (Vietnamese specific: "Câu 1. Chọn A" or "1. Chọn A")
  const answerRegex3 = /(?:Câu\s*)?(\d+)\s*[:.\-\s]?\s*Chọn\s*([A-D])/gi;
  while ((match = answerRegex3.exec(answersSection || rawText)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ans = match[2].toUpperCase();
    answersMap.set(qNum, ans);
  }

  // 3. Parse Questions
  // Standard Vietnamese question patterns: "Câu 1:", "Câu 1.", "Câu 1 -", "Câu 1 ", "Câu 01."
  // Or simply numbers at the start of a line: "1.", "2."
  // Let's find all occurrences of "Câu \d+" or line starts with "\d+."
  const questionStartRegex = /(?:^|\n)(?:Câu|Question)\s*(\d+)\s*[:.\-\s]/gi;
  const questionMatches: { qNum: number; index: number; length: number }[] = [];
  
  while ((match = questionStartRegex.exec(questionsSection)) !== null) {
    questionMatches.push({
      qNum: parseInt(match[1], 10),
      index: match.index,
      length: match[0].length
    });
  }

  // Fallback: If no "Câu X" was matched, try parsing numbered lines (e.g., "1.", "2.")
  if (questionMatches.length === 0) {
    const lineStartNumberRegex = /(?:^|\n)\s*(\d+)[\.\)]\s+/g;
    while ((match = lineStartNumberRegex.exec(questionsSection)) !== null) {
      questionMatches.push({
        qNum: parseInt(match[1], 10),
        index: match.index,
        length: match[0].length
      });
    }
  }

  // Parse each question block
  for (let i = 0; i < questionMatches.length; i++) {
    const current = questionMatches[i];
    const next = questionMatches[i + 1];
    const startIdx = current.index + current.length;
    const endIdx = next ? next.index : questionsSection.length;
    const blockText = questionsSection.substring(startIdx, endIdx).trim();

    // Parse options A, B, C, D inside the block
    // We look for patterns like A. B. C. D. or A) B) C) D) with word boundaries or space prefixes
    const optionRegex = /(?:^|\s)([A-D])\s*[\.\)]/g;
    const optionMatches: { key: string; index: number; length: number }[] = [];
    
    let optMatch;
    while ((optMatch = optionRegex.exec(blockText)) !== null) {
      // Clean index to point to the option key rather than the leading space
      const leadingSpaceLen = optMatch[0].match(/^\s/) ? 1 : 0;
      optionMatches.push({
        key: optMatch[1].toUpperCase(),
        index: optMatch.index + leadingSpaceLen,
        length: optMatch[0].length - leadingSpaceLen
      });
    }

    let questionText = blockText;
    const options: Option[] = [];

    // Filter matches to make sure they are in proper order (A -> B -> C -> D)
    // or at least look like valid options (unique keys, not random occurrences)
    const validOptionMatches: typeof optionMatches = [];
    const keysSeen = new Set<string>();
    
    for (const opt of optionMatches) {
      if (!keysSeen.has(opt.key)) {
        // If it's A, or if we already have A and this is B, etc.
        // To be flexible, we just check if it's A, B, C, D and unique in this block
        keysSeen.add(opt.key);
        validOptionMatches.push(opt);
      }
    }

    // Sort by index just in case
    validOptionMatches.sort((a, b) => a.index - b.index);

    if (validOptionMatches.length > 0) {
      // Question text is everything before the first option
      questionText = blockText.substring(0, validOptionMatches[0].index).trim();
      
      // Extract option texts
      for (let j = 0; j < validOptionMatches.length; j++) {
        const oStart = validOptionMatches[j].index + validOptionMatches[j].length;
        const oEnd = j < validOptionMatches.length - 1 ? validOptionMatches[j + 1].index : blockText.length;
        options.push({
          key: validOptionMatches[j].key,
          text: blockText.substring(oStart, oEnd).trim().replace(/^[:.\-\s]+/, '') // Clean up separators
        });
      }
    }

    // Clean question text (remove any trailing garbage)
    questionText = questionText.replace(/^[:.\-\s]+/, '');

    // Get correct answer from answer map
    const correctAnswer = answersMap.get(current.qNum) || '';

    // Push the parsed question
    questions.push({
      id: current.qNum,
      questionText,
      options,
      correctAnswer
    });
  }

  // Sort questions by their ID
  questions.sort((a, b) => a.id - b.id);

  // If questions are found but answers aren't, or if IDs mismatch,
  // we can also try to search the question text block for bold choices, underlined choices or markers
  // but standard answersMap is the primary mechanism.
  const totalParsed = questions.length;
  const totalWithAnswers = questions.filter(q => q.correctAnswer).length;

  return {
    questions,
    rawText,
    totalParsed,
    totalWithAnswers
  };
}

/**
 * Utility to parse a manual answer key string
 * Useful when the parser cannot auto-detect answers and the user inputs them manually
 * Format supported: "1A 2B 3C..." or "1.A, 2.B..." or standard CSV
 */
export function parseManualAnswers(answerStr: string): Map<number, string> {
  const answersMap = new Map<number, string>();
  const regex = /(\d+)\s*[:.\-\s]?\s*([A-D])/gi;
  let match;
  while ((match = regex.exec(answerStr)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ans = match[2].toUpperCase();
    answersMap.set(qNum, ans);
  }
  return answersMap;
}
