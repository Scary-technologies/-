
import { AIRequestConfig } from "../types";

// Local, offline biography generator
export const generateBiography = async (config: AIRequestConfig): Promise<string> => {
  // Simulate delay for effect
  await new Promise(resolve => setTimeout(resolve, 800));

  const { name, birthDate, location, relation, extraContext } = config;
  const year = birthDate ? birthDate.split('/')[0] : 'نامشخص';
  
  let bio = `${name}`;
  
  if (relation === 'Root') {
      bio += `، بزرگ‌خاندان و موسس این شجره‌نامه،`;
  } else {
      bio += `، یکی از اعضای محترم این خاندان،`;
  }

  if (location && location !== 'Unknown') {
      bio += ` در ${location} دیده به جهان گشود.`;
  } else {
      bio += ` چشم به جهان گشود.`;
  }

  if (birthDate && birthDate !== 'Unknown') {
      bio += ` تاریخ تولد ایشان سال ${year} ثبت شده است.`;
  }

  if (extraContext && extraContext.includes('Occupation:')) {
      const occupation = extraContext.split('Occupation:')[1].split('.')[0].trim();
      if (occupation && occupation !== 'undefined') {
          bio += ` ایشان در طول زندگی خود به حرفه ${occupation} مشغول بودند و خدمات ارزنده‌ای ارائه کردند.`;
      }
  }

  bio += ` نام ایشان همواره در تاریخ این خانواده به نیکی یاد می‌شود و یادآور پیوندهای عمیق خانوادگی است.`;

  return bio;
};
