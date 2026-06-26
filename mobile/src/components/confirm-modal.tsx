import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Brand, Spacing, Radius, Shadow } from '@/constants/theme';
import CourtUpModal from '@/components/CourtUpModal';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  type?: 'confirm' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loading = false,
  type = 'confirm',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const theme = useTheme();

  return (
    <CourtUpModal
      visible={visible}
      onClose={loading ? undefined : onCancel}
      height="auto"
      position="center"
      hideHeader
      transparentBackground
    >
      <View style={{ alignItems: 'center', width: '100%' }}>
        <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Accent Orange Bar */}
          <View style={styles.accentBar} />

          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnConfirm]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnConfirmText}>{confirmText}</Text>
              )}
            </TouchableOpacity>

            {type === 'confirm' && onCancel && (
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel, { borderColor: theme.border }]}
                onPress={onCancel}
                disabled={loading}
              >
                <Text style={[styles.btnCancelText, { color: theme.textSecondary }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </CourtUpModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: Brand.orange,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  actions: {
    flexDirection: 'column',
    gap: Spacing.sm,
    width: '100%',
  },
  btn: {
    width: '100%',
    height: 46,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: {
    borderWidth: 1,
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnConfirm: {
    backgroundColor: Brand.orange,
  },
  btnConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
