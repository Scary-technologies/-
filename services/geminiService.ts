
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
