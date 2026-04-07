'use client';

interface ModalProps {
    children: React.ReactNode;
    onClose: () => void;
    title?: string;
}

export default function Modal({ children, onClose, title }: ModalProps) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="panel w-full max-w-md animate-slide-up" onClick={e => e.stopPropagation()}>
                {title && <div className="panel-header">{title}</div>}
                {children}
            </div>
        </div>
    );
}
