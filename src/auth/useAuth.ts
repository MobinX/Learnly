import { useState, useEffect, useCallback } from 'react';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';

interface UseAuthReturn {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((userState) => {
      setUser(userState);
      setLoading(false);
    });

    return subscriber;
  }, []);

  const signInAnonymously = useCallback(async () => {
    try {
      await auth().signInAnonymously();
    } catch (error) {
      console.error('Anonymous Sign-In Error:', error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await auth().signOut();
    } catch (error) {
      console.error('Sign Out Error:', error);
      throw error;
    }
  }, []);

  return {
    user,
    loading,
    signInAnonymously,
    signOut,
  };
};
