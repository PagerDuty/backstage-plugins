import { useState } from 'react';

export type ToastSeverity = 'success' | 'error';

export interface MappingCounts {
  created?: number;
  skipped?: number;
  errored?: number;
}

export function useMappingToast() {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('success');
  const [totalMatches, setTotalMatches] = useState(0);
  const [mappingCounts, setMappingCounts] = useState<MappingCounts>({});

  const showSuccess = (
    message: string,
    matchCount?: number,
    counts?: MappingCounts,
  ) => {
    setToastSeverity('success');
    setToastMessage(message);
    if (matchCount !== undefined) {
      setTotalMatches(matchCount);
    }
    if (counts) {
      setMappingCounts(counts);
    }
    setShowToast(true);
  };

  const showError = (message: string) => {
    setToastSeverity('error');
    setToastMessage(message);
    setShowToast(true);
  };

  const closeToast = () => {
    setShowToast(false);
    setMappingCounts({});
  };

  return {
    showToast,
    toastMessage,
    toastSeverity,
    totalMatches,
    mappingCounts,
    showSuccess,
    showError,
    closeToast,
  };
}
