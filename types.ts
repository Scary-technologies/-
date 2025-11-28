
export interface Connection {
  targetId: string;
  label: string;
}

export interface LifeEvent {
  id: string;
  title: string;
  date: string;
  location?: string;
  description?: string;
}

export interface Tag {
  id: string;
  label: string;
  color: string;
}

export interface VoiceNote {
  id: string;
  title: string;
  url?: string; // In a real app, this would be a blob URL
  date: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation?: string; // e.g., Father, Mother, Self
  code?: string; // Unique ID code
  birthDate?: string;
  deathDate?: string;
  location?: string;
  occupation?: string;
  events?: LifeEvent[];
  imageUrl?: string;
  voiceNotes?: VoiceNote[];
  tags?: Tag[];
  gender: 'male' | 'female' | 'other';
  children?: FamilyMember[];
  isExpanded?: boolean;
  connections?: Connection[];
}

// Decoupled from d3 to avoid import errors
export interface TreeNode {
  x: number;
  y: number;
  data: FamilyMember;
  parent?: TreeNode | null;
  children?: TreeNode[] | null;
  depth?: number;
  height?: number;
  x0?: number;
  y0?: number;
}

export interface AIRequestConfig {
  name: string;
  birthDate?: string;
  location?: string;
  relation?: string;
  extraContext?: string;
}

export interface TreeSettings {
  showSpouseConnections: boolean;
  showParentChildConnections: boolean;
  showLabels: boolean;
  showDates: boolean;
  showAvatars: boolean;
  showGenderIcons: boolean;
  // New Features
  isCompact: boolean;
  colorMode: 'default' | 'branch';
  fontStyle: 'modern' | 'classic'; // Modern = Vazirmatn, Classic = Naskh
  showAge: boolean;
  showGenerationLabels: boolean;
}

export type AppTheme = 'modern' | 'dark';
