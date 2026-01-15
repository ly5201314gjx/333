import React from 'react';
import { BookOpen, Scale, Lightbulb, BrainCircuit, BarChart3, Plus, Trash2, Calendar, X, ChevronRight, Trophy, Flame, Target, PenTool, Quote, History, Send, Clock, Download, FileText, FileSpreadsheet, File, RotateCcw } from 'lucide-react';

export const Icons = {
  BookOpen,
  Scale,
  Lightbulb,
  BrainCircuit,
  BarChart3,
  Plus,
  Trash2,
  Calendar,
  X,
  ChevronRight,
  Trophy,
  Flame,
  Target,
  PenTool,
  Quote,
  History,
  Send,
  Clock,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  RotateCcw
};

interface IconProps {
  name: keyof typeof Icons;
  size?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 18, className }) => {
  const LucideIcon = Icons[name];
  return <LucideIcon size={size} className={className} />;
};