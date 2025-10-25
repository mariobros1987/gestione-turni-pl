import React from 'react';
import { AllEntryTypes } from './types/types';

export const AppContext = React.createContext<{ handleSaveEvent?: (entry: AllEntryTypes | AllEntryTypes[]) => void }>({});
