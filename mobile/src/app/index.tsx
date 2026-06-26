import { View, ActivityIndicator } from 'react-native';
import { Brand } from '@/constants/theme';

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={Brand.green} />
    </View>
  );
}
