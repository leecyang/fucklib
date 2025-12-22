import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../lib/utils';

type DialogVariant = 'default' | 'success' | 'error' | 'warning';

interface DialogProps {
  title: string;
  content: React.ReactNode;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  isOpen?: boolean;
}

const Dialog: React.FC<DialogProps> = ({
  title,
  content,
  variant = 'default',
  confirmText = '确定',
  cancelText,
  onConfirm,
  onCancel,
  isOpen = true,
}) => {
  const [show, setShow] = useState(isOpen);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
      requestAnimationFrame(() => setAnimate(true));
    } else {
      setAnimate(false);
      const timer = setTimeout(() => setShow(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!show) return null;

  const getIcon = () => {
    switch (variant) {
      case 'success': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-6 h-6 text-rose-500" />;
      case 'warning': return <AlertCircle className="w-6 h-6 text-amber-500" />;
      default: return <Info className="w-6 h-6 text-indigo-500" />;
    }
  };

  const getHeaderBg = () => {
     switch (variant) {
      case 'success': return 'bg-emerald-50 border-emerald-100';
      case 'error': return 'bg-rose-50 border-rose-100';
      case 'warning': return 'bg-amber-50 border-amber-100';
      default: return 'bg-indigo-50 border-indigo-100';
    }
  };

  return (
    <div className={cn("fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200", animate ? "bg-slate-900/40 backdrop-blur-sm opacity-100" : "bg-transparent opacity-0")}>
      <div 
        className={cn(
            "bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-100 transform transition-all duration-200 overflow-hidden",
            animate ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-4 opacity-0"
        )}
      >
        <div className={cn("px-6 py-4 border-b flex items-center gap-3", getHeaderBg())}>
            {getIcon()}
            <h3 className="font-bold text-lg text-slate-800">{title}</h3>
            <button 
                onClick={onCancel} 
                className="ml-auto p-1 hover:bg-black/5 rounded-full transition-colors"
            >
                <X className="w-5 h-5 text-slate-500" />
            </button>
        </div>
        
        <div className="p-6">
            <div className="text-slate-600 text-sm leading-relaxed">
                {content}
            </div>
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
            {cancelText && (
                <button 
                    onClick={onCancel}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors text-sm"
                >
                    {cancelText}
                </button>
            )}
            <button 
                onClick={onConfirm}
                className={cn(
                    "px-6 py-2 rounded-xl text-white font-bold shadow-sm transition-all hover:scale-105 active:scale-95 text-sm",
                    variant === 'error' ? "bg-rose-500 hover:bg-rose-600 shadow-rose-200" : 
                    variant === 'success' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200" :
                    "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                )}
            >
                {confirmText}
            </button>
        </div>
      </div>
    </div>
  );
};

// Singleton for imperative calls
let dialogContainer: HTMLDivElement | null = null;
let root: any = null;

export const showDialog = (props: Omit<DialogProps, 'isOpen'>) => {
  if (!dialogContainer) {
    dialogContainer = document.createElement('div');
    document.body.appendChild(dialogContainer);
    root = createRoot(dialogContainer);
  }

  const handleClose = () => {
    root.render(<Dialog {...props} isOpen={false} />);
    // Don't unmount immediately to allow animation
    setTimeout(() => {
        // Optional: root.unmount() if you want to clean up completely, 
        // but keeping the root is more efficient for repeated calls.
    }, 300);
  };

  root.render(
    <Dialog 
        {...props} 
        isOpen={true} 
        onConfirm={() => { props.onConfirm?.(); handleClose(); }}
        onCancel={() => { props.onCancel?.(); handleClose(); }}
    />
  );
};

export const alert = (message: string, title = '提示') => {
    return new Promise<void>((resolve) => {
        showDialog({
            title,
            content: message,
            confirmText: '知道了',
            onConfirm: resolve,
            onCancel: resolve,
            variant: title.includes('失败') || title.includes('错误') || message.includes('失败') ? 'error' : 'default'
        });
    });
};

export const confirm = (message: React.ReactNode, title = '确认操作') => {
    return new Promise<boolean>((resolve) => {
        showDialog({
            title,
            content: message,
            variant: 'warning',
            confirmText: '确认',
            cancelText: '取消',
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false)
        });
    });
};

export default Dialog;