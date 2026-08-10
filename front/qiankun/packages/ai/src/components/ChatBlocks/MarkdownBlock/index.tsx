import { useEffect, useMemo, useRef } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const md = new MarkdownIt({
  html: false,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {
        // fallthrough
      }
    }
    return ''; // 使用默认转义
  },
});

interface MarkdownBlockProps {
  content: string;
}

export default function MarkdownBlock({ content }: MarkdownBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  const html = useMemo(() => md.render(content), [content]);

  useEffect(() => {
    if (ref.current) {
      ref.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [html]);

  return (
    <div
      ref={ref}
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
