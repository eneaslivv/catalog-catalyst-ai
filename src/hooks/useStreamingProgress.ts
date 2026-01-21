import { useState, useCallback, useRef } from 'react';

export interface ProgressEvent {
  step: string;
  message: string;
  percent?: number;
  details?: string;
}

interface StreamingProgressResult {
  progress: ProgressEvent | null;
  isStreaming: boolean;
  error: string | null;
  startStream: (body: any) => Promise<any>;
  reset: () => void;
}

export function useStreamingProgress(): StreamingProgressResult {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setProgress(null);
    setIsStreaming(false);
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const startStream = useCallback(async (body: any): Promise<any> => {
    reset();
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), 300000); // 5 min timeout

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-import?stream=true`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Error ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      // If it's a stream, parse SSE events
      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult: any = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                
                if (eventType === 'progress') {
                  setProgress(parsed);
                } else if (eventType === 'complete') {
                  finalResult = parsed;
                } else if (eventType === 'error') {
                  throw new Error(parsed.message || 'Error en el procesamiento');
                }
              } catch (e) {
                // Ignore parse errors for partial data
              }
            }
          }
        }

        setIsStreaming(false);
        return finalResult;
      } else {
        // Regular JSON response
        const data = await response.json();
        setIsStreaming(false);
        if (data.error) throw new Error(data.error);
        return data;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error 
        ? (err.name === 'AbortError' ? 'Tiempo de espera agotado' : err.message)
        : 'Error desconocido';
      setError(message);
      setIsStreaming(false);
      throw new Error(message);
    }
  }, [reset]);

  return { progress, isStreaming, error, startStream, reset };
}
