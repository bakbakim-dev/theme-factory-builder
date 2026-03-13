import { useState, useEffect } from 'react';
import JSZip from 'jszip';

export const useJSZip = () => {
  const [jszip, setJszip] = useState<typeof JSZip | null>(null);

  useEffect(() => {
    // In a real implementation we might lazy load this, 
    // but here we just expose the imported library.
    setJszip(() => JSZip);
  }, []);

  return { jszip };
};