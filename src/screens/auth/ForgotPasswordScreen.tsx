import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess(true);
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
          <Text style={styles.title}>{t('auth.forgotPassword.title', 'Mot de passe oublié')}</Text>
          <Text style={styles.subtitle}>
            {t('auth.forgotPassword.subtitle', 'Entrez votre email pour recevoir un lien de réinitialisation')}
          </Text>

          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                {t('auth.forgotPassword.success', 'Un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception.')}
              </Text>
              <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
                <Text style={styles.buttonText}>{t('auth.login.submit', 'Se connecter')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>{t('auth.forgotPassword.email', 'Email')}</Text>
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

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>{t('auth.forgotPassword.submit', 'Envoyer')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>{t('common.back', 'Retour')}</Text>
          </TouchableOpacity>
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
  backLink: { alignItems: 'center', marginTop: 24 },
  backText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
