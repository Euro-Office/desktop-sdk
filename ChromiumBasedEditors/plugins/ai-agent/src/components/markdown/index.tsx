"use client";

import "@assistant-ui/react-markdown/styles/dot.css";

import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import defaultComponents from "./Markdown.utils";

const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      components={defaultComponents}
    />
  );
};

const MarkdownContentImpl = ({ children }: { children: string }) => {
  return (
    <div className="aui-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={defaultComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
export const MarkdownContent = memo(MarkdownContentImpl);
