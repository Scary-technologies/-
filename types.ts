import { HierarchyPointNode } from 'd3';

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
  birthDate?: string;
  deathDate?: string;
  location?: string;
  occupation?: string;
  bio?: string;
  events?: LifeEvent[];
  imageUrl?: string;
  gallery?: string[]; // Array of image URLs
  voiceNotes?: VoiceNote[];
  tags?: Tag[];
  gender: 'male' | 'female' | 'other';
  children?: FamilyMember[];
  isExpanded?: boolean;
  connections?: Connection[];
}

export interface TreeNode extends HierarchyPointNode<FamilyMember> {
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

export type AppTheme = 'modern' | 'vintage' | 'dark';