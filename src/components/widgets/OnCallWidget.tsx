import React from 'react';
import { OnCallCard } from '../OnCallCard';
import { CardProps, CollapsibleCardProps, OnCallEntry } from '../../types/types';

// Widget per dashboard: riusa la OnCallCard classica
const OnCallWidget: React.FC<CardProps<OnCallEntry> & CollapsibleCardProps & {
  filterName: string;
  setFilterName: (value: string) => void;
}> = (props) => {
  // Widget: sempre espanso, senza toggle
  return <OnCallCard {...props} isCollapsed={false} onToggleCollapse={() => {}} />;
};

export default OnCallWidget;
