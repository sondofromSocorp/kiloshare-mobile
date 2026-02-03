import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('auth.login.title', 'Connexion')}</Text>
          <Text style={styles.subtitle}>{t('auth.login.subtitle', 'Connectez-vous pour continuer')}</Text>

          <View style={styles.form}>
            <Text style={styles.label}>{t('auth.login.email', 'Email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@exemple.com"
              placeholderTextColor={colors.gray400}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>{t('auth.login.password', 'Mot de passe')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="********"
              placeholderTextColor={colors.gray400}
              secureTextEntry
            />

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotLink}>
                {t('auth.login.forgotPassword', 'Mot de passe oublié ?')}
              </Text>
            </TouchableOpacity>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>{t('auth.login.submit', 'Se connecter')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('auth.login.noAccount', "Pas encore de compte ?")}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}> {t('auth.login.register', "S'inscrire")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.gray900, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.gray500, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: '500', color: colors.gray700 },
  input: {
    borderWidth: 1, borderColor: colors.gray300, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.gray900,
    backgroundColor: colors.gray50,
  },
  forgotLink: { color: colors.primary, fontSize: 14, textAlign: 'right', marginTop: 4 },
  errorBox: { backgroundColor: colors.red50, padding: 12, borderRadius: 8 },
  errorText: { color: colors.red600, fontSize: 14 },
  button: {
    backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: colors.gray500, fontSize: 14 },
  footerLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
