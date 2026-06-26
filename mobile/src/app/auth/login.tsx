import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  Linking,
  Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Spacing, Radius } from '@/constants/theme';
import { ConfirmModal } from '@/components/confirm-modal';
import * as ExpoLinking from 'expo-linking';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [selectedRole, setSelectedRole] = useState<'jugador' | 'profesor'>('jugador');
  const [categoria, setCategoria] = useState<string>('C');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmType, setConfirmType] = useState<'info' | 'confirm'>('info');
  
  // Input focus states for glowing borders
  const [nombreFocused, setNombreFocused] = useState(false);
  const [telefonoFocused, setTelefonoFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Refs to allow focusing inputs when tapping anywhere on the wrapper
  const nombreInputRef = useRef<TextInput>(null);
  const telefonoInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const { signIn } = useAuth();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Reanimated Shared Values for Background Orb Animations
  const orb1X = useSharedValue(-50);
  const orb1Y = useSharedValue(-50);
  const orb2X = useSharedValue(SCREEN_WIDTH - 150);
  const orb2Y = useSharedValue(SCREEN_HEIGHT / 2);
  const orb3X = useSharedValue(SCREEN_WIDTH / 2);
  const orb3Y = useSharedValue(SCREEN_HEIGHT - 100);

  // Gentle floating animation to avoid 3D touch coordinates distortion bugs
  const cardFloatY = useSharedValue(0);

  // Shiny Glass Reflection Sweep Shared Value
  const reflectionOffset = useSharedValue(-150);

  // Button pulse/glow animation
  const buttonGlow = useSharedValue(1);

  // Set up animations on mount
  useEffect(() => {
    // 1. Background Orbs drifting slowly in loops
    orb1X.value = withRepeat(
      withSequence(
        withTiming(SCREEN_WIDTH - 200, { duration: 15000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-50, { duration: 12000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    orb1Y.value = withRepeat(
      withSequence(
        withTiming(SCREEN_HEIGHT / 3, { duration: 13000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-50, { duration: 14000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    orb2X.value = withRepeat(
      withSequence(
        withTiming(50, { duration: 16000, easing: Easing.inOut(Easing.ease) }),
        withTiming(SCREEN_WIDTH - 150, { duration: 14000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    orb2Y.value = withRepeat(
      withSequence(
        withTiming(SCREEN_HEIGHT - 300, { duration: 15000, easing: Easing.inOut(Easing.ease) }),
        withTiming(SCREEN_HEIGHT / 2, { duration: 13000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    orb3X.value = withRepeat(
      withSequence(
        withTiming(-100, { duration: 18000, easing: Easing.inOut(Easing.ease) }),
        withTiming(SCREEN_WIDTH / 2, { duration: 16000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    orb3Y.value = withRepeat(
      withSequence(
        withTiming(100, { duration: 14000, easing: Easing.inOut(Easing.ease) }),
        withTiming(SCREEN_HEIGHT - 100, { duration: 17000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // 2. Slow floating motion loop (completely safe for input touch points)
    cardFloatY.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-4, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // 3. Shiny gradient sweep repeating every 5 seconds
    reflectionOffset.value = withRepeat(
      withSequence(
        withTiming(SCREEN_WIDTH + 150, { duration: 1800, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withDelay(3200, withTiming(-150, { duration: 0 }))
      ),
      -1
    );

    // 4. Button pulsing subtle scale
    buttonGlow.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.99, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  // Animated styles
  const animOrb1 = useAnimatedStyle(() => ({
    transform: [{ translateX: orb1X.value }, { translateY: orb1Y.value }],
  }));

  const animOrb2 = useAnimatedStyle(() => ({
    transform: [{ translateX: orb2X.value }, { translateY: orb2Y.value }],
  }));

  const animOrb3 = useAnimatedStyle(() => ({
    transform: [{ translateX: orb3X.value }, { translateY: orb3Y.value }],
  }));

  const animCardFloat = useAnimatedStyle(() => ({
    transform: [
      { translateY: cardFloatY.value }
    ],
  }));

  const animReflection = useAnimatedStyle(() => ({
    transform: [{ translateX: reflectionOffset.value }],
  }));

  const animButton = useAnimatedStyle(() => ({
    transform: [{ scale: buttonGlow.value }],
  }));

  const handleSupportPress = () => {
    Linking.openURL('mailto:courtupro@gmail.com?subject=Soporte%20CourtUp&body=Hola%20equipo%20de%20CourtUp,%20necesito%20soporte%20con%20mi%20cuenta...');
  };

  const handleAction = async () => {
    if (isSignUp) {
      await handleSignUp();
    } else {
      await handleLogin();
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setConfirmTitle('Campos Incompletos');
      setConfirmMsg('Por favor completá tu email y contraseña para ingresar.');
      setConfirmType('info');
      setConfirmVisible(true);
      return;
    }

    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);

    if (error) {
      setConfirmTitle('Error al iniciar sesión');
      // Special check for unconfirmed email
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setConfirmMsg('Debes confirmar tu email antes de iniciar sesión. Revisá tu casilla de correo y la carpeta de spam.');
      } else {
        setConfirmMsg(error.message || 'Credenciales incorrectas');
      }
      setConfirmType('info');
      setConfirmVisible(true);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !nombre) {
      setConfirmTitle('Campos Incompletos');
      setConfirmMsg('Completá todos los campos para poder registrarte.');
      setConfirmType('info');
      setConfirmVisible(true);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: ExpoLinking.createURL('/'),
          data: {
            nombre: nombre.trim(),
            full_name: nombre.trim(), // Necesario para el trigger de base de datos
            rol: selectedRole === 'profesor' ? 'Profesor' : 'Jugador',
            categoria: selectedRole === 'jugador' ? categoria : null,
            telefono: telefono.trim() || null
          }
        }
      });

      if (error) throw error;

      if (data?.user) {
        // Update user profile in perfiles_usuarios table
        const { error: profileError } = await supabase
          .from('perfiles_usuarios')
          .update({
            rol: selectedRole === 'profesor' ? 'Profesor' : 'Jugador',
            categoria: selectedRole === 'jugador' ? categoria : null
          })
          .eq('id', data.user.id);
        
        if (profileError) {
          console.error("Error updating profile table:", profileError);
        }
      }

      if (data?.session) {
        // Automatically sign in the user if session is provided
        const { error: signInError } = await signIn(email.trim().toLowerCase(), password);
        if (signInError) throw signInError;
      } else {
        // Email confirmation is required
        setConfirmTitle('¡Cuenta Creada!');
        setConfirmMsg('Por favor revisá tu casilla de correo (y la carpeta de spam) para confirmar tu cuenta antes de iniciar sesión.');
        setConfirmType('info');
        setConfirmVisible(true);
        setIsSignUp(false); // Switch back to login form
      }
      
    } catch (err: any) {
      setConfirmTitle('Error al registrarse');
      setConfirmMsg(err.message || 'No se pudo crear la cuenta');
      setConfirmType('info');
      setConfirmVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleForgotPassword = async () => {
    setResetStatus(null);
    if (!resetEmail) {
      setResetStatus({ type: 'error', message: 'Por favor ingresá tu email para recuperar la contraseña.' });
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim().toLowerCase(), {
        // Updated to use the vercel URL or production URL dynamically. Note: This URL must be whitelisted in Supabase Dashboard -> Authentication -> URL Configuration
        redirectTo: 'https://court-up-mu.vercel.app/reset-password',
      });
      if (error) throw error;
      setResetStatus({ type: 'success', message: 'Te enviamos un correo con las instrucciones para recuperar tu contraseña.' });
      setResetEmail('');
    } catch (err: any) {
      setResetStatus({ type: 'error', message: err.message || 'Hubo un error al intentar recuperar la contraseña.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFocusScroll = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" />

      {/* Deep Gradient Background with subtle mesh coloring */}
      <LinearGradient
        colors={['#040302', '#140c08', '#030201']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Dynamic Floating Glowing Orbs (Atmospheric Light Orbs) */}
      <Animated.View style={[styles.glowingOrb, styles.orbGreen, animOrb1]} />
      <Animated.View style={[styles.glowingOrb, styles.orbOrange, animOrb2]} />
      <Animated.View style={[styles.glowingOrb, styles.orbLime, animOrb3]} />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          keyboardVisible && { justifyContent: 'flex-start', paddingVertical: Spacing.md }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
      >
        {/* Header Branding */}
        {!keyboardVisible && (
          <View style={styles.header}>
            <Animated.View style={styles.logoGlowContainer}>
              <LinearGradient
                colors={['#ff6b35', '#fa4a0a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoCircle}
              >
                <Text style={styles.logoEmoji}>🎾</Text>
              </LinearGradient>
            </Animated.View>

            <Text style={styles.title}>
              Court<Text style={styles.titleHighlight}>Up</Text>
            </Text>
            <Text style={styles.subtitle}>Tu conexión inteligente al tenis y pádel</Text>
          </View>
        )}

        {/* Tab switcher: Iniciar Sesión / Registrarse */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, !isSignUp && styles.tabActive]}
            onPress={() => {
              setIsSignUp(false);
              setShowPassword(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, !isSignUp && styles.tabTextActive]}>Iniciar Sesión</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, isSignUp && styles.tabActive]}
            onPress={() => {
              setIsSignUp(true);
              setShowPassword(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, isSignUp && styles.tabTextActive]}>Registrarse</Text>
          </TouchableOpacity>
        </View>

        {/* Card Container with gentle floating motion (no 3D tilt coordinates distortion) */}
        <Animated.View style={[styles.cardContainer, animCardFloat]} pointerEvents="box-none">
          
          {/* Layer 1: Glass Background Card (pointerEvents none) */}
          <View style={[StyleSheet.absoluteFill, styles.cardBg]} pointerEvents="none">
            {/* Glass Specular Reflection Highlight */}
            <Animated.View style={[styles.reflectionSweep, animReflection]} pointerEvents="none">
              <LinearGradient
                colors={['transparent', 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.08)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.reflectionBar}
              />
            </Animated.View>
          </View>

          {/* Layer 2: Flat Interactive Content (Tappable and fully functional) */}
          <View style={[styles.cardContent, { zIndex: 10 }]} pointerEvents="box-none">
            
            <Text style={styles.cardTitle}>
              {isSignUp ? 'Crear Nueva Cuenta' : 'Ingreso a la Cancha'}
            </Text>

            {/* Name Input Field (SignUp only) */}
            {isSignUp && (
              <View style={styles.field}>
                <Text style={styles.label}>Nombre Completo</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => nombreInputRef.current?.focus()}
                  style={[
                    styles.inputWrapper, 
                    nombreFocused && styles.inputWrapperFocused,
                    nombreFocused && { borderColor: '#ff6b35' }
                  ]}
                >
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    ref={nombreInputRef}
                    style={styles.input}
                    placeholder="Tu Nombre"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    value={nombre}
                    onChangeText={setNombre}
                    autoCapitalize="words"
                    onFocus={() => {
                      setNombreFocused(true);
                      handleFocusScroll();
                    }}
                    onBlur={() => setNombreFocused(false)}
                  />
                </TouchableOpacity>
              </View>
            )}

            {isSignUp && (
              <View style={styles.field}>
                <Text style={styles.label}>Teléfono (Opcional)</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => telefonoInputRef.current?.focus()}
                  style={[styles.inputWrapper, telefonoFocused && styles.inputWrapperFocused]}
                >
                  <TextInput
                    ref={telefonoInputRef}
                    style={styles.input}
                    placeholder="Ej: 1122334455"
                    placeholderTextColor="#666"
                    value={telefono}
                    onChangeText={setTelefono}
                    keyboardType="number-pad"
                    onFocus={() => { setTelefonoFocused(true); handleFocusScroll(); }}
                    onBlur={() => setTelefonoFocused(false)}
                    returnKeyType="next"
                    onSubmitEditing={() => emailInputRef.current?.focus()}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Email Input Field */}
            <View style={styles.field}>
              <Text style={styles.label}>Email del Jugador</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => emailInputRef.current?.focus()}
                style={[
                  styles.inputWrapper, 
                  emailFocused && styles.inputWrapperFocused,
                  emailFocused && { borderColor: '#ff6b35' }
                ]}
              >
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  ref={emailInputRef}
                  style={styles.input}
                  placeholder="tu@email.com"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onFocus={() => {
                    setEmailFocused(true);
                    handleFocusScroll();
                  }}
                  onBlur={() => setEmailFocused(false)}
                />
              </TouchableOpacity>
            </View>

            {/* Password Input Field */}
            <View style={styles.field}>
              <Text style={styles.label}>Contraseña</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => passwordInputRef.current?.focus()}
                style={[
                  styles.inputWrapper, 
                  passwordFocused && styles.inputWrapperFocused,
                  passwordFocused && { borderColor: '#ff6b35' }
                ]}
              >
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  onFocus={() => {
                    setPasswordFocused(true);
                    handleFocusScroll();
                  }}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeEmoji}>{showPassword ? '👁️' : '🙈'}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>



            {/* Category/Level Selector (SignUp and Jugador only) */}
            {isSignUp && selectedRole === 'jugador' && (
              <View style={styles.field}>
                <Text style={styles.label}>Nivel / Categoría</Text>
                <View style={styles.categoryGrid}>
                  {['SuperA', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryBtn,
                        categoria === cat && styles.categoryBtnActive,
                      ]}
                      onPress={() => setCategoria(cat)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.categoryBtnText,
                          categoria === cat && styles.categoryBtnTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Animated Neon Button */}
            <Animated.View style={animButton}>
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleAction}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#ff6b35', '#fa4a0a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.btnText}>
                      {isSignUp ? 'Crear Cuenta' : 'Ingresar'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {isSignUp ? (
              <Text style={styles.hint}>
                Al registrarte podrás reservar canchas y clases con los profesores autorizados del club.
              </Text>
            ) : (
              <View style={{ gap: Spacing.sm, marginTop: Spacing.xs }}>
                <TouchableOpacity onPress={() => {
                  setResetStatus(null);
                  setForgotPasswordVisible(true);
                }} activeOpacity={0.7}>
                  <Text style={[styles.hint, { color: '#ff6b35', fontWeight: 'bold' }]}>
                    ¿Olvidaste tu contraseña? Recuperala aquí.
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSupportPress} activeOpacity={0.7}>
                  <Text style={styles.hint}>
                    ¿Necesitas ayuda adicional? <Text style={styles.hintLink}>Contacta a soporte.</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Custom Forgot Password Modal */}
        {forgotPasswordVisible && (
          <View style={[StyleSheet.absoluteFill, styles.modalOverlay]} pointerEvents="box-none">
            <View style={styles.modalBackdrop} />
            <Animated.View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Recuperar Contraseña</Text>
                <TouchableOpacity onPress={() => setForgotPasswordVisible(false)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {resetStatus && (
                <View style={{
                  backgroundColor: resetStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  borderColor: resetStatus.type === 'success' ? '#10b981' : '#ef4444',
                  borderWidth: 1,
                  padding: Spacing.base,
                  borderRadius: Radius.md,
                  marginBottom: Spacing.md
                }}>
                  <Text style={{
                    color: resetStatus.type === 'success' ? '#10b981' : '#ef4444',
                    fontSize: 14,
                    textAlign: 'center',
                    fontWeight: '600'
                  }}>
                    {resetStatus.message}
                  </Text>
                </View>
              )}

              {resetStatus?.type !== 'success' && (
                <>
                  <Text style={styles.modalDesc}>
                    Ingresá el email de tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
                  </Text>
                  
                  <View style={styles.field}>
                    <View style={[styles.inputWrapper, { borderColor: 'rgba(255, 107, 53, 0.4)' }]}>
                      <Text style={styles.inputIcon}>✉️</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="tu@email.com"
                        placeholderTextColor="rgba(255, 255, 255, 0.3)"
                        value={resetEmail}
                        onChangeText={setResetEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoFocus
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.btn, loading && styles.btnDisabled, { marginTop: Spacing.md }]}
                    onPress={handleForgotPassword}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#ff6b35', '#fa4a0a']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.btnGradient, { paddingVertical: 12 }]}
                    >
                      {loading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={[styles.btnText, { fontSize: 15 }]}>
                          Enviar Enlace
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {resetStatus?.type === 'success' && (
                <TouchableOpacity
                  style={[styles.btn, { marginTop: Spacing.md }]}
                  onPress={() => setForgotPasswordVisible(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#333', '#1a1a1a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.btnGradient, { paddingVertical: 12, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]}
                  >
                    <Text style={[styles.btnText, { fontSize: 15 }]}>
                      Cerrar
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        )}

        {/* Premium footer branding */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>CourtUp Premium System</Text>
          <Text style={styles.footerVersion}>v2.4.0 • Logi Pop Design</Text>
        </View>
      </ScrollView>

      {/* Reusable Confirm Modal for Alerts */}
      <ConfirmModal
        visible={confirmVisible}
        title={confirmTitle}
        message={confirmMsg}
        type={confirmType}
        confirmText="Aceptar"
        onConfirm={() => setConfirmVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040302',
  },
  glowingOrb: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.15,
  },
  orbGreen: {
    backgroundColor: '#ff6b35',
    top: -50,
    left: -50,
    transform: [{ scale: 1.5 }],
  },
  orbOrange: {
    backgroundColor: '#fa4a0a',
    bottom: 100,
    right: -50,
  },
  orbLime: {
    backgroundColor: '#f4d35e',
    top: SCREEN_HEIGHT / 2 - 125,
    left: SCREEN_WIDTH / 2 - 125,
    opacity: 0.08,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoGlowContainer: {
    marginBottom: Spacing.base,
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 53, 0.4)',
  },
  logoEmoji: {
    fontSize: 44,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1.5,
  },
  titleHighlight: {
    color: '#ff6b35',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 4,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#ff6b35',
  },
  cardContainer: {
    position: 'relative',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  cardBg: {
    backgroundColor: 'rgba(32, 28, 26, 0.75)',
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 107, 53, 0.18)',
  },
  cardContent: {
    padding: Spacing.xl,
  },
  reflectionSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 150,
  },
  reflectionBar: {
    flex: 1,
    transform: [{ rotate: '25deg' }],
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: Spacing.xl,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  field: {
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.45)',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
  },
  inputWrapperFocused: {
    borderColor: 'rgba(255, 107, 53, 0.6)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  eyeBtn: {
    padding: Spacing.xs,
  },
  eyeEmoji: {
    fontSize: 18,
    opacity: 0.8,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radius.md,
  },
  roleBtnActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderColor: 'rgba(255, 107, 53, 0.4)',
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  roleBtnTextActive: {
    color: '#ff6b35',
  },
  btn: {
    borderRadius: Radius.lg,
    marginTop: Spacing.lg,
    overflow: 'hidden',
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  btnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  hintLink: {
    color: '#ff6b35',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  footerContainer: {
    marginTop: Spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.2)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footerVersion: {
    color: 'rgba(255, 255, 255, 0.15)',
    fontSize: 11,
    marginTop: 2,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  categoryBtn: {
    width: '22%',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  categoryBtnActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderColor: 'rgba(255, 107, 53, 0.4)',
  },
  categoryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  categoryBtnTextActive: {
    color: '#ff6b35',
  },
  modalOverlay: {
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.3)',
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalCloseText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 'bold',
  },
  modalDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
});
