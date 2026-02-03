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
import { registerSchema } from '../../lib/validation';
import { colors } from '../../theme/colors';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export function RegisterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    setError(null);
    setLoading(true);

    try {
      const validated = registerSchema.parse({ email, password, confirmPassword });

      const { error: signUpError } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: { username: validated.email.split('@')[0] },
        },
      });

      if (signUpError) {
        if (signUpError.message?.includes('already registered')) {
          setError(t('auth.register.errors.userExists', 'Un compte existe déjà avec cet email'));
        } else {
          throw signUpError;
        }
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      if (err.errors) {
        setError(err.errors[0]?.message || 'Validation error');
      } else {
        setError(err.message || t('auth.register.errors.generic', 'Erreur lors de l\'inscription'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('auth.register.title', 'Créer un compte')}</Text>
          <Text style={styles.subtitle}>{t('auth.register.subtitle', 'Rejoignez la communauté Yemalo')}</Text>

          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                {t('auth.register.success', 'Inscription réussie ! Vérifiez votre email pour confirmer votre compte.')}
              </Text>
              <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.buttonText}>{t('auth.login.submit', 'Se connecter')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>{t('auth.register.email', 'Email')}</Text>
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

              <Text style={styles.label}>{t('auth.register.password', 'Mot de passe')}</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="********"
                placeholderTextColor={colors.gray400}
                secureTextEntry
              />

              <Text style={styles.label}>{t('auth.register.confirmPassword', 'Confirmer le mot de passe')}</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="********"
                placeholderTextColor={colors.gray400}
                secureTextEntry
              />

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>{t('auth.register.submit', "S'inscrire")}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.register.alreadyHaveAccount', 'Déjà un compte ?')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}> {t('auth.register.login', 'Se connecter')}</Text>
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
  label: { fontSize: 14, fontWeight: '600', color: colors.gray700 },
  input: {
    borderWidth: 1, borderColor: colors.gray300, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.gray900,
    backgroundColor: colors.gray50,
  },
  errorBox: { backgroundColor: colors.red50, padding: 12, borderRadius: 8 },
  errorText: { color: colors.red600, fontSize: 14 },
  successBox: { backgroundColor: colors.green50, padding: 16, borderRadius: 8, gap: 16 },
  successText: { color: colors.green700, fontSize: 14 },
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
