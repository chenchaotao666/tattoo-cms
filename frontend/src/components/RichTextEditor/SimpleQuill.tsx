import React from 'react';
import ReactQuillWrapper from './ReactQuillWrapper';

interface SimpleQuillProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  readonly?: boolean;
}

const SimpleQuill: React.FC<SimpleQuillProps> = (props) => {
  return <ReactQuillWrapper {...props} />;
};

export default React.memo(SimpleQuill);