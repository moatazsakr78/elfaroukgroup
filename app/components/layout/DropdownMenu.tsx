'use client';

import { useRef, useEffect } from 'react';
import {
  ClipboardDocumentListIcon,
  UserIcon
} from '@heroicons/react/24/outline';

interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DropdownMenu({ isOpen, onClose }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={menuRef}
      className="fixed top-12 left-4 z-50 bg-[#374151] border border-gray-600 rounded-lg shadow-lg min-w-[200px] overflow-hidden"
    >
      <div className="py-2">
        <button
          onClick={() => {
            // Handle Orders List navigation
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-3 text-white hover:bg-[#4B5563] transition-colors text-right"
        >
          <ClipboardDocumentListIcon className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">قائمة الطلبات</span>
        </button>
        
        <button
          onClick={() => {
            // Handle Profile navigation
            onClose();
          }}
          className="flex items-center gap-3 w-full px-4 py-3 text-white hover:bg-[#4B5563] transition-colors text-right"
        >
          <UserIcon className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">الملف الشخصي</span>
        </button>
      </div>
    </div>
  );
}