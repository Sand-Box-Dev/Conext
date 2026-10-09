import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { ArrowUp, LoaderCircle, BookOpen, HelpCircle, Layers, PenTool } from 'lucide-react';
import { api } from '../services/api';
import type { ReviewerCitation, StudyMode } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: ReviewerCitation[];
}

interface ReviewerChatProps {
  documentId: number;
  filename: string;
  isProcessing?: boolean;
  hasProcessingError?: boolean;
  onOpenStudyMode: (mode: StudyMode, documentId: number) => void;
}

const answerMarkdownComponents: Components = {
  p: ({ children }) => <p className="leading-7 [&:not(:first-child)]:mt-3">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6 marker:text-slate-500">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6 marker:text-slate-500">{children}</ol>,
  li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  h1: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold text-slate-100">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold text-slate-100">{children}</h3>,
  h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-100">{children}</h3>,
  blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-slate-600 pl-3 text-slate-300">{children}</blockquote>,
};

export const ReviewerChat: React.FC<ReviewerChatProps> = ({ documentId, filename, isProcessing = false, hasProcessingError = false, onOpenStudyMode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setIsLoadingHistory(true);
    api.getReviewerChat(documentId)
      .then((saved) => {
        if (active) setMessages(saved.map(({ role, content, citations }) => ({ role, content, citations })));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load saved chat.');
      })
      .finally(() => {
        if (active) setIsLoadingHistory(false);
      });
    return () => { active = false; };
  }, [documentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const queuedTokensRef = useRef<string>('');
  const displayedTextRef = useRef<string>('');
  const isStreamActiveRef = useRef<boolean>(false);
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop typewriter timer on unmount
  useEffect(() => {
    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, []);

  const sendQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    const asked = question.trim();
    if (!asked || isSending) return;
    setQuestion('');
    setError(null);

    // Clear streaming buffer refs
    queuedTokensRef.current = '';
    displayedTextRef.current = '';
    isStreamActiveRef.current = true;
    if (streamTimerRef.current) clearInterval(streamTimerRef.current);

    // Add user question and initial empty assistant placeholder
    setMessages((current) => [
      ...current,
      { role: 'user', content: asked },
      { role: 'assistant', content: '', citations: [] },
    ]);
    setIsSending(true);

    let citationsHolder: ReviewerCitation[] = [];

    // Setup smooth word-by-word release timer
    streamTimerRef.current = setInterval(() => {
      const remaining = queuedTokensRef.current.slice(displayedTextRef.current.length);
      if (remaining.length > 0) {
        const nextSpaceIdx = remaining.indexOf(' ');
        let stepLen = 1;
        if (nextSpaceIdx !== -1 && nextSpaceIdx < 12) {
          stepLen = nextSpaceIdx + 1;
        } else {
          stepLen = Math.min(3, remaining.length);
        }
        displayedTextRef.current += remaining.slice(0, stepLen);
        const currentText = displayedTextRef.current;

        setMessages((current) => {
          if (current.length === 0) return current;
          const updated = [...current];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: currentText,
            };
          }
          return updated;
        });
      } else if (!isStreamActiveRef.current) {
        // Stream completed and buffer fully flushed: reveal citations now!
        if (streamTimerRef.current) {
          clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
        }
        setMessages((current) => {
          if (current.length === 0) return current;
          const updated = [...current];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: queuedTokensRef.current || displayedTextRef.current,
              citations: citationsHolder,
            };
          }
          return updated;
        });
        setIsSending(false);
      }
    }, 25);

    try {
      await api.askReviewerStream(documentId, asked, {
        onChunk: (delta) => {
          queuedTokensRef.current += delta;
        },
        onDone: (result) => {
          isStreamActiveRef.current = false;
          queuedTokensRef.current = result.answer;
          citationsHolder = result.citations || [];
        },
        onError: (streamErr) => {
          isStreamActiveRef.current = false;
          setError(streamErr.message || 'Stream encountered an error.');
          setIsSending(false);
        },
      });
    } catch (err) {
      isStreamActiveRef.current = false;
      setError(err instanceof Error ? err.message : 'Could not answer that question.');
      setMessages((current) => {
        if (current.length > 0 && current[current.length - 1].role === 'assistant' && !current[current.length - 1].content) {
          return current.slice(0, -1);
        }
        return current;
      });
      setIsSending(false);
    }
  };

  return (
    <section className="conext-chat flex min-h-0 flex-1 flex-col bg-[#0b0f17]">
      <div className="chat-transcript mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {isLoadingHistory && messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Loading saved conversation…
          </div>
        ) : messages.length === 0 && isProcessing ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
            <h2 className="chat-greeting text-2xl font-medium tracking-tight text-slate-100 sm:text-3xl">
              Getting your reviewer ready.
            </h2>
            <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-400">
              <LoaderCircle className="h-4 w-4 animate-spin" />Preparing {filename} for conversation…
            </p>
          </div>
        ) : messages.length === 0 && hasProcessingError ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
            <h2 className="chat-greeting text-2xl font-medium tracking-tight text-slate-100 sm:text-3xl">We couldn’t prepare this reviewer.</h2>
            <p role="alert" className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
              Check that the file contains readable text, then upload it again to start a conversation.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
            <h2 className="chat-greeting text-2xl font-medium tracking-tight text-slate-100 sm:text-3xl">
              Where should we begin?
            </h2>
            <div className="chat-composer mt-7 w-full rounded-3xl border border-slate-700 bg-slate-900 shadow-lg transition focus-within:border-slate-500">
              <form onSubmit={sendQuestion} className="flex items-center gap-3 px-4 py-3">
                <input
                  className="min-w-0 flex-1 bg-transparent py-1 text-sm text-white outline-none placeholder:text-slate-500"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask about your reviewer"
                  maxLength={2000}
                  disabled={isSending}
                  aria-label="Question about the reviewer"
                  autoFocus
                />
                <button className="chat-send-button btn btn-circle btn-sm" type="submit" disabled={!question.trim() || isSending} aria-label="Send question">
                  {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
                </button>
              </form>
            </div>
            {error && <div role="alert" className="alert alert-error mt-3 py-2 text-xs">{error}</div>}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn btn-sm rounded-full border-slate-700 bg-slate-900/70 text-xs font-normal text-slate-300 hover:bg-slate-800 gap-1.5" onClick={() => onOpenStudyMode('quiz', documentId)}>
                <HelpCircle className="h-3.5 w-3.5 text-primary" />
                <span>Generate Quiz</span>
              </button>
              <button type="button" className="btn btn-sm rounded-full border-slate-700 bg-slate-900/70 text-xs font-normal text-slate-300 hover:bg-slate-800 gap-1.5" onClick={() => onOpenStudyMode('flashcards', documentId)}>
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span>Generate Flash-Card</span>
              </button>
              <button type="button" className="btn btn-sm rounded-full border-slate-700 bg-slate-900/70 text-xs font-normal text-slate-300 hover:bg-slate-800 gap-1.5" onClick={() => onOpenStudyMode('essay', documentId)}>
                <PenTool className="h-3.5 w-3.5 text-primary" />
                <span>Generate Essay</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-7 overflow-y-auto no-scrollbar py-8" aria-live="polite">
              {messages.map((message, index) => (
                <div key={`${index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] sm:max-w-[82%] ${message.role === 'user' ? 'user-question rounded-3xl bg-slate-800 px-5 py-3.5 text-slate-100' : 'text-slate-200'}`}>
                    {message.role === 'assistant' ? (
                      <div className="assistant-answer text-sm leading-7">
                        {message.content ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={answerMarkdownComponents}
                          >
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400">
                            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                            <span>Formulating response from reviewer...</span>
                          </div>
                        )}
                        {isSending && index === messages.length - 1 && message.content && (
                          <span className="inline-block h-4 w-1.5 ml-1 bg-primary animate-pulse align-middle" />
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-7">{message.content}</div>
                    )}
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-5 border-t border-slate-700/60 pt-3">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <BookOpen className="h-3.5 w-3.5 text-primary" />
                          <span>Sources & Referenced Passages ({message.citations.length})</span>
                        </div>
                        <div className="space-y-2">
                          {message.citations.map((citation) => (
                            <details
                              key={citation.passage_id}
                              className="answer-citation collapse collapse-arrow rounded-xl border border-slate-800 bg-slate-900/80 transition-colors hover:border-slate-700 cursor-pointer"
                            >
                              <summary className="collapse-title min-h-0 py-2.5 px-3.5 text-xs font-medium text-primary select-none flex items-center justify-between">
                                <span>Passage {citation.passage_id} · Page {citation.page_number}</span>
                              </summary>
                              <div className="collapse-content px-3.5 pb-3 text-xs leading-relaxed text-slate-300 border-t border-slate-800/60 pt-2">
                                <p className="italic text-slate-400">"{citation.excerpt}"</p>
                              </div>
                            </details>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            {error && <div role="alert" className="alert alert-error mb-3 py-2 text-xs">{error}</div>}
            <form onSubmit={sendQuestion} className="chat-composer mb-4 rounded-3xl border border-slate-700 bg-slate-900 shadow-lg transition focus-within:border-slate-500">
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  className="min-w-0 flex-1 bg-transparent py-1 text-sm text-white outline-none placeholder:text-slate-500"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a follow-up"
                  maxLength={2000}
                  disabled={isSending}
                  aria-label="Ask a follow-up question"
                />
                <button className="chat-send-button btn btn-circle btn-sm" type="submit" disabled={!question.trim() || isSending} aria-label="Send question">
                  {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
                </button>
              </div>
              <p className="pb-2 text-center text-[10px] text-slate-500">Chat is saved with this reviewer · answers cite retrieved passages.</p>
            </form>
          </>
        )}
      </div>
    </section>
  );
};
