import React from 'react';
import SimpleQuill from './SimpleQuill';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  readonly?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = (props) => {
  return <SimpleQuill {...props} />;
};

export default RichTextEditor;