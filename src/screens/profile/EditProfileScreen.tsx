import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { Profile } from '../../lib/types';

const AVAILABLE_LANGUAGES = [
  'fr', 'en', 'es', 'pt', 'ar', 'wo', 'sw', 'zh', 'de', 'it', 'nl', 'ru', 'ja', 'ko', 'hi', 'tr',
];

export function EditProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        const p = data as Profile;
        setFirstName(p.first_name ?? '');
        setLastName(p.last_name ?? '');
        setUsername(p.username ?? '');
        setPhone(p.phone ?? '');
        setStreetAddress(p.street_address ?? '');
        setPostalCode(p.postal_code ?? '');
        setCity(p.city ?? '');
        setCountry(p.country ?? '');
        setBio(p.bio ?? '');
        setLanguages(p.languages ?? []);
        setAvatarUrl(p.avatar_url ?? null);
      }
    } catch {
      Alert.alert(t('common.error'), t('profile.errors.loadFailed'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [user, t, navigation]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const pickAndUploadAvatar = async () => {
    if (!user) return;

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('common.error'), t('profile.errors.permissionDenied'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setUploadingAvatar(true);
      const asset = result.assets[0];

      // Create file name
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Fetch the image as blob
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      // Convert blob to array buffer
      const arrayBuffer = await new Response(blob).arrayBuffer();

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error('Avatar upload error:', err);
      Alert.alert(t('common.error'), t('profile.errors.avatarUploadFailed'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user || !avatarUrl) return;

    Alert.alert(
      t('profile.deleteAvatarTitle'),
      t('profile.deleteAvatarMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingAvatar(true);

              // Extract file path from URL
              const urlParts = avatarUrl.split('/');
              const filePath = urlParts.slice(-2).join('/');

              // Delete from storage
              await supabase.storage.from('avatars').remove([filePath]);

              // Update profile
              const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', user.id);

              if (error) throw error;

              setAvatarUrl(null);
            } catch (err) {
              console.error('Delete avatar error:', err);
              Alert.alert(t('common.error'), t('profile.errors.avatarDeleteFailed'));
            } finally {
              setUploadingAvatar(false);
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          username: username.trim(),
          phone: phone.trim() || null,
          street_address: streetAddress.trim() || null,
          postal_code: postalCode.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
          bio: bio.trim() || null,
          languages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        if (error.code === '23505' && error.message?.includes('username')) {
          Alert.alert(t('common.error'), t('profile.errors.usernameTaken'));
        } else {
          throw error;
        }
        return;
      }

      Alert.alert('', t('profile.updateSuccess'));
      navigation.goBack();
    } catch {
      Alert.alert(t('common.error'), t('profile.errors.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>{t('profile.edit')}</Text>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={pickAndUploadAvatar}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <View style={styles.avatarPlaceholder}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color={colors.white} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={14} color={colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>{t('profile.tapToChangeAvatar')}</Text>
          {avatarUrl && (
            <TouchableOpacity onPress={handleDeleteAvatar} disabled={uploadingAvatar}>
              <Text style={styles.deleteAvatarText}>{t('profile.deleteAvatar')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* First name */}
        <Text style={styles.label}>{t('profile.firstName')}</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder={t('profile.firstName')}
          placeholderTextColor={colors.gray400}
        />

        {/* Last name */}
        <Text style={styles.label}>{t('profile.lastName')}</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder={t('profile.lastName')}
          placeholderTextColor={colors.gray400}
        />

        {/* Username */}
        <Text style={styles.label}>{t('profile.username')}</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder={t('profile.username')}
          placeholderTextColor={colors.gray400}
          autoCapitalize="none"
        />

        {/* Phone */}
        <Text style={styles.label}>{t('profile.phone')}</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+33 6 12 34 56 78"
          placeholderTextColor={colors.gray400}
          keyboardType="phone-pad"
        />

        {/* Address */}
        <Text style={styles.label}>{t('profile.streetAddress')}</Text>
        <TextInput
          style={styles.input}
          value={streetAddress}
          onChangeText={setStreetAddress}
          placeholder={t('profile.streetAddressPlaceholder')}
          placeholderTextColor={colors.gray400}
        />

        {/* Postal code + City row */}
        <View style={styles.row}>
          <View style={styles.rowHalf}>
            <Text style={styles.label}>{t('profile.postalCode')}</Text>
            <TextInput
              style={styles.input}
              value={postalCode}
              onChangeText={setPostalCode}
              placeholder={t('profile.postalCodePlaceholder')}
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rowHalf}>
            <Text style={styles.label}>{t('profile.city')}</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder={t('profile.cityPlaceholder')}
              placeholderTextColor={colors.gray400}
            />
          </View>
        </View>

        {/* Country */}
        <Text style={styles.label}>{t('profile.country')}</Text>
        <TextInput
          style={styles.input}
          value={country}
          onChangeText={setCountry}
          placeholder={t('profile.selectCountry')}
          placeholderTextColor={colors.gray400}
        />

        {/* Bio */}
        <Text style={styles.label}>{t('publicProfile.bioLabel')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          placeholder={t('publicProfile.bioPlaceholder')}
          placeholderTextColor={colors.gray400}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Languages */}
        <Text style={styles.label}>{t('publicProfile.languagesLabel')}</Text>
        <View style={styles.languagesGrid}>
          {AVAILABLE_LANGUAGES.map((lang) => {
            const selected = languages.includes(lang);
            return (
              <TouchableOpacity
                key={lang}
                style={[styles.languageChip, selected && styles.languageChipSelected]}
                onPress={() => toggleLanguage(lang)}
              >
                <Text style={[styles.languageChipText, selected && styles.languageChipTextSelected]}>
                  {t(`languages.${lang}`, lang)}
                </Text>
                {selected && (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>{t('profile.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>{t('profile.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray700,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  avatarHint: {
    fontSize: 13,
    color: colors.gray400,
    marginTop: 8,
  },
  deleteAvatarText: {
    fontSize: 13,
    color: colors.red500,
    marginTop: 6,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.gray50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: colors.gray900,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowHalf: {
    flex: 1,
  },
  languagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  languageChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageChipText: {
    fontSize: 13,
    color: colors.gray600,
    fontWeight: '500',
  },
  languageChipTextSelected: {
    color: colors.white,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.gray600,
    fontWeight: '600',
    fontSize: 15,
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
