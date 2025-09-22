import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import 'react-quill/dist/quill.snow.css';

interface ReactQuillWrapperProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  readonly?: boolean;
}

// 为了避免 findDOMNode 问题，我们创建一个兼容的包装器
const ReactQuillWrapper: React.FC<ReactQuillWrapperProps> = ({
  value,
  onChange,
  placeholder = '请输入内容...',
  height = 300,
  readonly = false,
}) => {
  const quillRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 配置工具栏和模块
  const modules = useMemo(() => ({
    toolbar: readonly ? false : [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['blockquote', 'code-block'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false // 改善粘贴体验
    }
  }), [readonly]);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'indent',
    'align',
    'link', 'image',
    'blockquote', 'code-block'
  ];

  const handleChange = useCallback((content: string) => {
    onChange?.(content);
  }, [onChange]);

  // 使用原生 Quill 初始化，避免 findDOMNode
  useEffect(() => {
    let mounted = true;

    const initQuill = async () => {
      try {
        // 动态导入 Quill 而不是 ReactQuill
        const { default: Quill } = await import('quill');

        if (!mounted || !containerRef.current) return;

        // 创建编辑器
        const editor = new Quill(containerRef.current.querySelector('.quill-editor'), {
          theme: 'snow',
          placeholder,
          readOnly: readonly,
          modules,
          formats,
        });

        // 设置初始值
        if (value) {
          editor.root.innerHTML = value;
        }

        // 监听内容变化
        editor.on('text-change', () => {
          const content = editor.root.innerHTML;
          if (content !== value) {
            handleChange(content);
          }
        });

        quillRef.current = editor;

      } catch (error) {
        console.error('Failed to initialize Quill:', error);
      }
    };

    initQuill();

    return () => {
      mounted = false;
      if (quillRef.current) {
        // 清理编辑器
        try {
          quillRef.current = null;
        } catch (e) {
          // 忽略清理错误
        }
      }
    };
  }, []);

  // 当 value 从外部改变时更新编辑器
  useEffect(() => {
    console.log('ReactQuillWrapper value changed:', value);
    if (quillRef.current && value !== undefined) {
      const currentContent = quillRef.current.root.innerHTML;
      console.log('Current content:', currentContent);
      if (currentContent !== value) {
        quillRef.current.root.innerHTML = value || '';
        console.log('Updated quill content to:', value);
      }
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        height: height + 42
      }}
    >
      <div
        className="quill-editor"
        style={{
          height: height,
          backgroundColor: readonly ? '#f5f5f5' : '#fff',
        }}
      />
    </div>
  );
};

export default React.memo(ReactQuillWrapper);