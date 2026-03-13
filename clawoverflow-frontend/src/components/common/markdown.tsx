'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  content: string;
  className?: string;
  allowHtml?: boolean;
}

// Simple markdown parser (no external deps)
function parseMarkdown(text: string, allowHtml: boolean = false): string {
  let html = text;

  // Escape HTML if not allowed
  if (!allowHtml) {
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
  }

  // Code blocks (```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="code-block" data-lang="${lang}"><code>${code.trim()}</code></pre>`;
  });

  // Inline code (`)
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Headers (# ## ### etc)
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Strikethrough (~~text~~)
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="markdown-image" />');

  // Blockquotes (> text)
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules (---, ***, ___)
  html = html.replace(/^[-*_]{3,}$/gm, '<hr />');

  // Unordered lists (- item or * item)
  html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists (1. item)
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Task lists (- [ ] or - [x])
  html = html.replace(/<li>\[\s\]\s+(.+)<\/li>/g, '<li class="task-item"><input type="checkbox" disabled /> $1</li>');
  html = html.replace(/<li>\[x\]\s+(.+)<\/li>/gi, '<li class="task-item"><input type="checkbox" checked disabled /> $1</li>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br />');

  // Wrap in paragraph
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr \/>)/g, '$1');

  return html;
}

// Syntax highlighter (basic)
function highlightCode(code: string, language: string): string {
  const keywords: Record<string, string[]> = {
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'interface', 'type', 'enum', 'implements', 'extends'],
    python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'try', 'except', 'raise', 'with', 'as', 'lambda', 'yield', 'async', 'await'],
  };

  const langKeywords = keywords[language.toLowerCase()] || [];
  let highlighted = code;

  // Strings
  highlighted = highlighted.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span class="string">$&</span>');
  
  // Comments
  highlighted = highlighted.replace(/(\/\/.*$|#.*$)/gm, '<span class="comment">$1</span>');
  highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');

  // Keywords
  langKeywords.forEach(keyword => {
    highlighted = highlighted.replace(
      new RegExp(`\\b(${keyword})\\b`, 'g'),
      '<span class="keyword">$1</span>'
    );
  });

  // Numbers
  highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>');

  return highlighted;
}

export function Markdown({ content, className, allowHtml = false }: MarkdownProps) {
  const html = React.useMemo(() => parseMarkdown(content, allowHtml), [content, allowHtml]);

  return (
    <div 
      className={cn('prose-moltbook markdown-content', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Code block component
export function CodeBlock({ code, language, showLineNumbers = true }: { code: string; language?: string; showLineNumbers?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const highlighted = React.useMemo(() => language ? highlightCode(code, language) : code, [code, language]);
  const lines = code.split('\n');

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper relative group rounded-lg overflow-hidden border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <span className="text-xs text-muted-foreground font-mono">{language || 'plaintext'}</span>
        <button
          onClick={copyToClipboard}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      
      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm">
          <code>
            {showLineNumbers ? (
              <table className="border-collapse">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="pr-4 text-muted-foreground select-none text-right w-8">{i + 1}</td>
                      <td dangerouslySetInnerHTML={{ __html: language ? highlightCode(line, language) : line }} />
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: highlighted }} />
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}

// Spoiler component
export function Spoiler({ children, label = 'Spoiler' }: { children: React.ReactNode; label?: string }) {
  const [revealed, setRevealed] = React.useState(false);

  return (
    <div className="spoiler-wrapper">
      {revealed ? (
        <div className="spoiler-content p-3 rounded-lg bg-muted">
          {children}
          <button 
            onClick={() => setRevealed(false)}
            className="text-xs text-muted-foreground hover:text-foreground mt-2"
          >
            Hide
          </button>
        </div>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          🔒 {label} (click to reveal)
        </button>
      )}
    </div>
  );
}

// Quote component
export function Quote({ children, author, source }: { children: React.ReactNode; author?: string; source?: string }) {
  return (
    <blockquote className="border-l-4 border-primary pl-4 py-2 my-4">
      <div className="italic">{children}</div>
      {(author || source) && (
        <footer className="text-sm text-muted-foreground mt-2">
          {author && <span>— {author}</span>}
          {source && <cite className="ml-1">({source})</cite>}
        </footer>
      )}
    </blockquote>
  );
}

// Table component
export function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i} className="px-4 py-2 text-left font-medium border-b bg-muted/50">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 border-b">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
