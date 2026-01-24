'use client';

import { useState, useRef, useEffect } from 'react';
import { BuildingStorefrontIcon, ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useCurrentBranch, Branch } from '@/lib/contexts/CurrentBranchContext';

export default function BranchSwitcher() {
  const { currentBranch, userBranches, setCurrentBranch, isLoading, hasMultipleBranches } = useCurrentBranch();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track if component is mounted to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle branch selection
  const handleBranchSelect = (branch: Branch) => {
    setCurrentBranch(branch);
    setIsOpen(false);
  };

  // Show loading state or not mounted (prevent hydration mismatch)
  if (!mounted || isLoading) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-lg animate-pulse">
        <BuildingStorefrontIcon className="h-4 w-4 text-gray-400" />
        <span className="text-xs text-gray-400">جاري التحميل...</span>
      </div>
    );
  }

  // Show warning if no branch is selected
  if (!currentBranch) {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 rounded-lg">
        <BuildingStorefrontIcon className="h-4 w-4 text-yellow-400" />
        <span className="text-sm text-yellow-300">لم يتم تحديد فرع</span>
      </div>
    );
  }

  // If only one branch, show it without dropdown
  if (!hasMultipleBranches) {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 rounded-lg">
        <BuildingStorefrontIcon className="h-4 w-4 text-blue-400" />
        <span className="text-sm text-blue-300 font-medium">{currentBranch.name}</span>
      </div>
    );
  }

  // Show dropdown if multiple branches
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
        title="تغيير الفرع"
      >
        <BuildingStorefrontIcon className="h-4 w-4 text-blue-400" />
        <span className="text-sm text-blue-300 font-medium">{currentBranch.name}</span>
        <ChevronDownIcon className={`h-4 w-4 text-blue-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-[#2B3544] border border-gray-600 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="py-1 max-h-64 overflow-y-auto">
            {userBranches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => handleBranchSelect(branch)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-right hover:bg-gray-700/50 transition-colors ${
                  branch.id === currentBranch.id ? 'bg-blue-500/20' : ''
                }`}
              >
                <BuildingStorefrontIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className={`text-sm flex-grow ${branch.id === currentBranch.id ? 'text-blue-300' : 'text-gray-300'}`}>
                  {branch.name}
                </span>
                {branch.id === currentBranch.id && (
                  <CheckIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
