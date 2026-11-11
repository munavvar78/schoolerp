import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { login } from '../api/client';
import { errorText } from '../api/errors';
import { Button, ErrorBanner, TextField } from '../components/ui';
import { hapticSuccess } from '../lib/haptics';
import { colors, fonts, radius, space } from '../theme';

export function LoginScreen() {
  const [email, setEmail] = useState('admin@bharatvidya.edu');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
      await hapticSuccess();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <View style={styles.glow} />
      <View style={styles.card}>
        <View style={styles.brandRow}>
          <View style={styles.mark}>
            <Ionicons name="school" size={22} color={colors.white} />
          </View>
          <View>
            <Text style={styles.brand}>BharatVidya</Text>
            <Text style={styles.brandSub}>School ERP</Text>
          </View>
        </View>
        <Text style={styles.heading}>Sign in</Text>
        <Text style={styles.copy}>Use the same campus account as the web app.</Text>
        <TextField
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
        />
        <TextField
          label="Password"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
        />
        {error ? <ErrorBanner message={error} /> : null}
        <Button label="Sign in" loading={loading} onPress={() => void onSubmit()} />
        <Pressable disabled>
          <Text style={styles.demo}>
            Demo password is Password123! — admin, teacher, accounts, or parent @bharatvidya.edu
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.brandDark,
    justifyContent: 'center',
    padding: space.lg,
  },
  glow: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(99, 102, 241, 0.45)',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: space.xl,
    gap: space.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  brandSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  heading: { fontFamily: fonts.bold, fontSize: 28, color: colors.text, marginTop: space.sm },
  copy: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted, lineHeight: 22 },
  demo: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: space.md,
  },
});
