import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { LoginScreen } from '../src/screens/LoginScreen';
import { colors } from '../src/theme';

export default function LoginRoute() {
  const { ready, session } = useAuth();
  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }
  if (session) return <Redirect href="/" />;
  return <LoginScreen />;
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
});
