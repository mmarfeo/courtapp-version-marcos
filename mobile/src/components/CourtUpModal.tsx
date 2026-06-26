import React from 'react';
// eslint-disable-next-line no-restricted-imports
import { DimensionValue, Modal, ModalProps, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

export interface CourtUpModalProps extends ModalProps {
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  children: React.ReactNode;
  height?: DimensionValue;
  position?: 'bottom' | 'center';
  hideHeader?: boolean;
  transparentBackground?: boolean;
}

export default function CourtUpModal({
  title,
  subtitle,
  onClose,
  children,
  height,
  position = 'bottom',
  hideHeader = false,
  transparentBackground = false,
  ...rest
}: CourtUpModalProps) {
  const theme = useTheme();
  const isCenter = position === 'center';

  return (
    <Modal
      animationType={isCenter ? 'fade' : 'slide'}
      transparent={true}
      onRequestClose={onClose}
      {...rest}
    >
      <View style={[styles.modalOverlay, isCenter && { justifyContent: 'center', padding: Spacing.xl }]}>
        <View style={[
          styles.modalContent, 
          { backgroundColor: transparentBackground ? 'transparent' : theme.card, height: height || (isCenter ? 'auto' : '85%') },
          isCenter && { borderRadius: Radius.xl },
          transparentBackground && { padding: 0 }
        ]}>
          {/* Header */}
          {!hideHeader && (title || onClose) && (
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.modalHeaderTitleRow}>
                {title ? (
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {title}
                  </Text>
                ) : <View />}
                {onClose && (
                  <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                )}
              </View>
              {subtitle && (
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {subtitle}
                </Text>
              )}
            </View>
          )}

          {/* Content */}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    height: '85%',
    padding: Spacing.base,
  },
  modalHeader: {
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    marginBottom: Spacing.sm,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeModalBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
});
