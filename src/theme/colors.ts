import { useColorScheme } from 'react-native';

export interface Colors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  success: string;
  error: string;
  warning: string;
  chatHuman: string;
  chatAI: string;
  quizOption: string;
  quizOptionSelected: string;
  quizOptionCorrect: string;
  quizOptionIncorrect: string;
  inputBackground: string;
  inputBorder: string;
  badge: string;
  loading: string;
}

export const lightColors: Colors = {
  background: '#f0f0f0',
  surface: '#ffffff',
  surfaceSecondary: '#F8F8F8',
  border: '#E0E0E0',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#999999',
  primary: '#007AFF',
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',
  chatHuman: '#007AFF',
  chatAI: '#F2F2F7',
  quizOption: '#F5F5F5',
  quizOptionSelected: '#E8F4FF',
  quizOptionCorrect: '#E8F8ED',
  quizOptionIncorrect: '#FFE5E5',
  inputBackground: '#F5F5F5',
  inputBorder: '#E0E0E0',
  badge: '#E8F4FF',
  loading: 'rgba(0, 122, 255, 0.05)',
};

export const darkColors: Colors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',
  border: '#38383A',
  text: '#FFFFFF',
  textSecondary: '#98989D',
  textTertiary: '#636366',
  primary: '#0A84FF',
  success: '#30D158',
  error: '#FF453A',
  warning: '#FF9F0A',
  chatHuman: '#0A84FF',
  chatAI: '#2C2C2E',
  quizOption: '#2C2C2E',
  quizOptionSelected: '#1C3A5C',
  quizOptionCorrect: '#1C3A2E',
  quizOptionIncorrect: '#3A1C1C',
  inputBackground: '#2C2C2E',
  inputBorder: '#38383A',
  badge: '#1C3A5C',
  loading: 'rgba(10, 132, 255, 0.1)',
};

export const useTheme = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
    colorScheme,
  };
};
