import React from 'react';
import { stripMarkdown } from '../utils/labels';

interface ReportTextProps {
  text: string;
}

type Block = { kind: 'heading' | 'paragraph'; text: string } | { kind: 'list'; items: string[] };

function toBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    if (list.length) blocks.push({ kind: 'list', items: list });
    paragraph = [];
    list = [];
  };

  source.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || /^-{3,}$/.test(line)) {
      flush();
    } else if (/^#{1,6}\s/.test(line)) {
      flush();
      blocks.push({ kind: 'heading', text: stripMarkdown(line) });
    } else if (/^[-*•]\s/.test(line)) {
      if (paragraph.length) flush();
      list.push(stripMarkdown(line.replace(/^[-*•]\s+/, '')));
    } else {
      if (list.length) flush();
      paragraph.push(stripMarkdown(line));
    }
  });
  flush();
  return blocks;
}

/** Renders generated report text (light markdown) as plain, readable paragraphs. */
export const ReportText: React.FC<ReportTextProps> = ({ text }) => {
  const blocks = toBlocks(text);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-stone-700">
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return (
            <h3 key={i} className="pt-2 text-sm font-semibold text-stone-900 first:pt-0">
              {block.text}
            </h3>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block.text}</p>;
      })}
    </div>
  );
};
