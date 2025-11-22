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

// Local, offline research suggester
export const suggestResearch = async (treeData: string): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  let suggestions = "تحلیل ساختار شجره‌نامه:\n\n";
  
  try {
      const data = JSON.parse(treeData);
      
      const checkNode = (node: any) => {
          if (!node.birthDate) {
              suggestions += `• تاریخ تولد برای "${node.name}" ثبت نشده است. جستجو در اسناد سجلی توصیه می‌شود.\n`;
          }
          if (!node.location) {
              suggestions += `• محل زندگی "${node.name}" نامشخص است.\n`;
          }
          if (node.children) {
              node.children.forEach(checkNode);
          }
      };
      
      if (data.children) {
          data.children.forEach(checkNode);
      } else {
          checkNode(data);
      }
      
      if (suggestions === "تحلیل ساختار شجره‌نامه:\n\n") {
          suggestions += "اطلاعات شجره‌نامه کامل به نظر می‌رسد. می‌توانید روی افزودن تصاویر و زندگینامه دقیق‌تر تمرکز کنید.";
      }
      
  } catch (e) {
      suggestions = "خطا در تحلیل داده‌ها.";
  }
  
  return suggestions;
};