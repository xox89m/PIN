import React, { createContext, useContext } from 'react';
import { SiteCopy, UI_COPY } from '../content/letters';

export const SiteCopyContext = createContext<SiteCopy>(UI_COPY);

export function useSiteCopy(): SiteCopy {
  return useContext(SiteCopyContext);
}
